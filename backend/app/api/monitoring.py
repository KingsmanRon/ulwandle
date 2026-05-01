"""
Water monitoring endpoints. Sensor ingestion is authenticated via per-sensor
HMAC; reads require an authenticated user.
"""

import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.auth.security import (
    compute_ingest_hmac, constant_time_eq, hash_password, verify_password,
)
from app.core.config import settings
from app.db.database import db_session, get_db
from app.models.models import (
    AuditLog, District, FlowReading, LeakDetection, PressureReading,
    Sensor, User, UserRole,
)
from app.services.websocket_manager import websocket_manager

router = APIRouter()


# ---------- Schemas ----------

class SensorCreate(BaseModel):
    sensor_id: str = Field(min_length=1, max_length=50)
    sensor_type: str = Field(pattern="^(flow|pressure|ph|tds|turbidity|chlorine|temperature)$")
    district_id: int
    location_name: Optional[str] = Field(default=None, max_length=200)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class FlowReadingCreate(BaseModel):
    sensor_id: int
    flow_rate: float = Field(ge=0, le=100_000)
    total_volume: Optional[float] = Field(default=None, ge=0)


class PressureReadingCreate(BaseModel):
    sensor_id: int
    pressure: float = Field(ge=0, le=10_000)


# ---------- Sensor admin ----------

@router.post("/sensors", status_code=201)
def create_sensor(
    body: SensorCreate,
    current: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    if db.query(Sensor).filter(Sensor.sensor_id == body.sensor_id).first():
        raise HTTPException(409, "Sensor already exists")
    if not db.query(District).filter(District.id == body.district_id).first():
        raise HTTPException(404, "District not found")

    plaintext_secret = secrets.token_urlsafe(32)
    sensor = Sensor(**body.model_dump(),
                    ingest_secret_hash=hash_password(plaintext_secret))
    db.add(sensor)
    db.flush()
    db.commit()
    db.refresh(sensor)
    # Secret returned ONCE; client must store it. Server keeps only the hash.
    return {
        "id": sensor.id,
        "sensor_id": sensor.sensor_id,
        "ingest_secret": plaintext_secret,
        "warning": "Store this secret now; it will not be shown again.",
    }


@router.get("/sensors")
def list_sensors(
    district_id: Optional[int] = None,
    sensor_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Sensor)
    if district_id:
        q = q.filter(Sensor.district_id == district_id)
    if sensor_type:
        q = q.filter(Sensor.sensor_type == sensor_type)
    items = q.all()
    return {
        "count": len(items),
        "sensors": [
            {
                "id": s.id,
                "sensor_id": s.sensor_id,
                "sensor_type": s.sensor_type,
                "district_id": s.district_id,
                "location_name": s.location_name,
                "is_active": s.is_active,
                "last_reading_at": s.last_reading_at.isoformat() if s.last_reading_at else None,
            }
            for s in items
        ],
    }


# ---------- HMAC-authenticated ingestion ----------

def _verify_sensor_hmac(
    sensor: Sensor,
    body_bytes: bytes,
    timestamp: str,
    signature: str,
    plaintext_secret: str | None,
) -> None:
    if not sensor.is_active:
        raise HTTPException(403, "Sensor is not active")
    if not sensor.ingest_secret_hash:
        raise HTTPException(403, "Sensor has no ingest secret provisioned")
    # Time window check.
    try:
        ts_dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Invalid X-Timestamp")
    skew = abs((datetime.now(timezone.utc) - ts_dt).total_seconds())
    if skew > settings.SENSOR_HMAC_TIMESTAMP_SKEW_SECONDS:
        raise HTTPException(401, "Timestamp outside skew window")
    # Verify the plaintext secret against the stored Argon2 hash.
    if not plaintext_secret or not verify_password(sensor.ingest_secret_hash, plaintext_secret):
        raise HTTPException(401, "Invalid sensor credentials")
    expected = compute_ingest_hmac(plaintext_secret, body_bytes, timestamp)
    if not constant_time_eq(expected, signature):
        raise HTTPException(401, "Invalid HMAC signature")


@router.post("/flow-readings", status_code=201)
async def add_flow_reading(
    request: Request,
    background: BackgroundTasks,
    x_sensor_secret: str | None = Header(default=None, alias="X-Sensor-Secret"),
    x_signature: str | None = Header(default=None, alias="X-Signature"),
    x_timestamp: str | None = Header(default=None, alias="X-Timestamp"),
    db: Session = Depends(get_db),
):
    if settings.SENSOR_INGEST_HMAC_REQUIRED and not all((x_sensor_secret, x_signature, x_timestamp)):
        raise HTTPException(401, "Missing ingest authentication headers")
    raw = await request.body()
    if len(raw) > 16_000:
        raise HTTPException(413, "Payload too large")
    try:
        payload = FlowReadingCreate.model_validate_json(raw)
    except Exception:
        raise HTTPException(400, "Invalid payload")

    sensor = db.query(Sensor).filter(Sensor.id == payload.sensor_id).first()
    if not sensor:
        raise HTTPException(404, "Sensor not found")
    if settings.SENSOR_INGEST_HMAC_REQUIRED:
        _verify_sensor_hmac(sensor, raw, x_timestamp or "", x_signature or "", x_sensor_secret)

    reading = FlowReading(**payload.model_dump())
    db.add(reading)
    sensor.last_reading_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reading)

    background.add_task(_flag_anomaly_if_needed, reading.id, sensor.id)

    return {"reading_id": reading.id, "recorded_at": reading.recorded_at.isoformat()}


@router.post("/pressure-readings", status_code=201)
async def add_pressure_reading(
    request: Request,
    x_sensor_secret: str | None = Header(default=None, alias="X-Sensor-Secret"),
    x_signature: str | None = Header(default=None, alias="X-Signature"),
    x_timestamp: str | None = Header(default=None, alias="X-Timestamp"),
    db: Session = Depends(get_db),
):
    if settings.SENSOR_INGEST_HMAC_REQUIRED and not all((x_sensor_secret, x_signature, x_timestamp)):
        raise HTTPException(401, "Missing ingest authentication headers")
    raw = await request.body()
    if len(raw) > 16_000:
        raise HTTPException(413, "Payload too large")
    try:
        payload = PressureReadingCreate.model_validate_json(raw)
    except Exception:
        raise HTTPException(400, "Invalid payload")

    sensor = db.query(Sensor).filter(Sensor.id == payload.sensor_id).first()
    if not sensor:
        raise HTTPException(404, "Sensor not found")
    if settings.SENSOR_INGEST_HMAC_REQUIRED:
        _verify_sensor_hmac(sensor, raw, x_timestamp or "", x_signature or "", x_sensor_secret)

    reading = PressureReading(**payload.model_dump())
    db.add(reading)
    sensor.last_reading_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reading)
    return {"reading_id": reading.id, "recorded_at": reading.recorded_at.isoformat()}


# ---------- Reads ----------

@router.get("/flow-readings")
def list_flow_readings(
    sensor_id: Optional[int] = None,
    district_id: Optional[int] = None,
    hours: int = Query(24, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = db.query(FlowReading).filter(FlowReading.recorded_at >= cutoff)
    if sensor_id:
        q = q.filter(FlowReading.sensor_id == sensor_id)
    elif district_id:
        sensor_ids = [s.id for s in db.query(Sensor).filter(Sensor.district_id == district_id).all()]
        q = q.filter(FlowReading.sensor_id.in_(sensor_ids or [-1]))
    rows = q.order_by(FlowReading.recorded_at.desc()).limit(1000).all()
    return {
        "count": len(rows),
        "readings": [
            {"id": r.id, "sensor_id": r.sensor_id, "flow_rate": r.flow_rate,
             "is_anomaly": r.is_anomaly, "recorded_at": r.recorded_at.isoformat()}
            for r in rows
        ],
    }


@router.get("/leaks")
def list_leaks(
    district_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(LeakDetection)
    if district_id:
        q = q.filter(LeakDetection.district_id == district_id)
    rows = q.order_by(LeakDetection.detected_at.desc()).limit(500).all()
    return {
        "count": len(rows),
        "leaks": [
            {"id": l.id, "district_id": l.district_id,
             "estimated_loss_lpm": l.estimated_loss_lpm,
             "confidence_score": l.confidence_score,
             "is_confirmed": l.is_confirmed, "is_repaired": l.is_repaired,
             "detected_at": l.detected_at.isoformat()}
            for l in rows
        ],
    }


# ---------- Background anomaly flag ----------

async def _flag_anomaly_if_needed(reading_id: int, sensor_id: int) -> None:
    try:
        with db_session() as db:
            reading = db.query(FlowReading).filter(FlowReading.id == reading_id).first()
            if not reading:
                return
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            recent = db.query(FlowReading).filter(
                FlowReading.sensor_id == sensor_id,
                FlowReading.recorded_at >= cutoff,
                FlowReading.id != reading_id,
            ).all()
            if len(recent) < 10:
                return
            rates = [r.flow_rate for r in recent]
            mean = sum(rates) / len(rates)
            var = sum((x - mean) ** 2 for x in rates) / len(rates)
            std = var ** 0.5 or 1e-9
            score = abs(reading.flow_rate - mean) / std
            if score > 3:
                reading.is_anomaly = True
                reading.anomaly_score = score
                await websocket_manager.broadcast({
                    "type": "anomaly",
                    "sensor_id": sensor_id,
                    "flow_rate": reading.flow_rate,
                    "score": round(score, 2),
                }, roles=("admin", "supervisor", "operator"))
    except Exception:
        import logging
        logging.getLogger(__name__).exception("anomaly flagging failed")
