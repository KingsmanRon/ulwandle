"""
Water-quality endpoints.

Notes on safety:
- Ingestion of readings is operator-authenticated (no HMAC because the readings
  generally enter via human input or upstream gateways; tighten if you connect
  in-field probes directly).
- District status changes triggered by AI advisory still require operator
  confirmation: the analyse endpoint returns a *recommendation* but does not
  mutate district state.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.auth.security import hash_ip
from app.core.config import settings
from app.db.database import db_session, get_db
from app.models.models import (
    Alert, AlertLevel, AuditLog, District, DistrictStatus, User, UserRole,
    WaterQualityReading,
)
from app.services.claude_service import claude_service
from app.services.websocket_manager import websocket_manager

router = APIRouter()


class WaterQualityCreate(BaseModel):
    district_id: int
    ph: Optional[float] = Field(default=None, ge=0, le=14)
    tds: Optional[float] = Field(default=None, ge=0, le=10_000)
    turbidity: Optional[float] = Field(default=None, ge=0, le=10_000)
    temperature: Optional[float] = Field(default=None, ge=-10, le=100)
    chlorine: Optional[float] = Field(default=None, ge=0, le=50)

    @model_validator(mode="after")
    def require_measurement(self):
        values = (self.ph, self.tds, self.turbidity, self.temperature, self.chlorine)
        if all(value is None for value in values):
            raise ValueError("At least one water-quality measurement is required")
        return self


class StatusOverride(BaseModel):
    new_status: str = Field(pattern="^(unmonitored|green|yellow|red)$")
    note: Optional[str] = Field(default=None, max_length=500)


@router.post("/readings", status_code=201)
async def add_reading(
    body: WaterQualityCreate,
    background: BackgroundTasks,
    request: Request,
    current: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)),
    db: Session = Depends(get_db),
):
    district = db.query(District).filter(District.id == body.district_id).first()
    if not district:
        raise HTTPException(404, "District not found")

    target_status, violations = _classify_reading(body)
    meets = target_status == DistrictStatus.GREEN

    reading = WaterQualityReading(**body.model_dump(), meets_sans_241=meets)
    db.add(reading)
    db.commit()
    db.refresh(reading)

    background.add_task(_district_status_update, district.id, target_status, violations)

    return {
        "reading_id": reading.id,
        "meets_standards": meets,
        "violations": violations,
        "recorded_at": reading.recorded_at.isoformat(),
    }


@router.get("/readings")
def list_readings(
    district_id: Optional[int] = None,
    hours: int = Query(24, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = db.query(WaterQualityReading).filter(WaterQualityReading.recorded_at >= cutoff)
    if district_id:
        q = q.filter(WaterQualityReading.district_id == district_id)
    rows = q.order_by(WaterQualityReading.recorded_at.desc()).limit(500).all()
    return {
        "count": len(rows),
        "readings": [
            {"id": r.id, "district_id": r.district_id, "ph": r.ph, "tds": r.tds,
             "turbidity": r.turbidity, "temperature": r.temperature,
             "chlorine": r.chlorine, "meets_sans_241": r.meets_sans_241,
             "recorded_at": r.recorded_at.isoformat()}
            for r in rows
        ],
    }


@router.post("/analyze/{district_id}")
async def analyze(
    district_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)),
):
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(404, "District not found")
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.query(WaterQualityReading).filter(
        WaterQualityReading.district_id == district_id,
        WaterQualityReading.recorded_at >= cutoff,
    ).order_by(WaterQualityReading.recorded_at.desc()).limit(50).all()
    if not rows:
        raise HTTPException(404, "No water quality data available")

    sanitised = [{
        "ph": r.ph, "tds": r.tds, "turbidity": r.turbidity,
        "temperature": r.temperature, "chlorine": r.chlorine,
        "meets_standards": r.meets_sans_241,
    } for r in rows]
    standards = {
        "ph_range": {"min": settings.PH_MIN, "max": settings.PH_MAX},
        "tds_max": settings.TDS_MAX,
        "turbidity_max": settings.TURBIDITY_MAX,
        "standard": "SANS 241",
    }

    advisory = await claude_service.detect_water_quality_issues(
        district_name=district.name,
        quality_readings=sanitised,
        compliance_standards=standards,
    )
    return {
        "district_id": district_id,
        "district_name": district.name,
        "advisory": advisory,
        "current_status": district.status.value,
        "note": "AI output is advisory; status changes require operator confirmation.",
    }


@router.put("/districts/{district_id}/status")
def override_status(
    district_id: int,
    body: StatusOverride,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(404, "District not found")
    old = district.status.value
    district.status = DistrictStatus(body.new_status)
    db.add(AuditLog(
        actor_id=current.id, actor_email=current.email,
        action="district.status_override",
        resource_type="district", resource_id=str(district.id),
        payload={"from": old, "to": body.new_status, "note": (body.note or "")[:500]},
        ip_hash=hash_ip(request.client.host) if request.client else None,
    ))
    db.add(Alert(
        district_id=district.id,
        alert_type="water_quality",
        level=AlertLevel.CRITICAL if body.new_status == "red" else AlertLevel.WARNING,
        title=f"Status override: {district.name} -> {body.new_status.upper()}",
        message=f"Status changed by {current.email} from {old} to {body.new_status}",
        alert_metadata={"from": old, "to": body.new_status, "actor_id": current.id},
    ))
    db.commit()
    return {"district_id": district.id, "status": district.status.value}


@router.get("/standards")
def standards():
    return {
        "standard": "SANS 241",
        "ph": {"min": settings.PH_MIN, "max": settings.PH_MAX},
        "tds_max": settings.TDS_MAX,
        "turbidity_max": settings.TURBIDITY_MAX,
        "chlorine": {"min": 0.2, "max": 5.0, "unit": "mg/L"},
    }


def _reading_view(reading: WaterQualityReading) -> dict:
    return {
        "id": reading.id,
        "ph": reading.ph,
        "tds": reading.tds,
        "turbidity": reading.turbidity,
        "temperature": reading.temperature,
        "chlorine": reading.chlorine,
        "meets_standards": reading.meets_sans_241,
        "recorded_at": reading.recorded_at.isoformat(),
    }


def _build_compliance_summary(
    districts: list[District],
    latest_by_district: dict[int, WaterQualityReading],
) -> dict:
    counts = {status.value: 0 for status in DistrictStatus}
    district_rows = []
    for district in districts:
        counts[district.status.value] += 1
        latest = latest_by_district.get(district.id)
        district_rows.append({
            "id": district.id,
            "name": district.name,
            "municipality": district.municipality,
            "province": district.province,
            "status": district.status.value,
            "latest_reading": _reading_view(latest) if latest else None,
        })
    return {
        "standard": "SANS 241",
        "total_districts": len(districts),
        "status_counts": counts,
        "districts": district_rows,
    }


@router.get("/summary")
def compliance_summary(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    districts = db.query(District).order_by(District.municipality, District.name).all()
    latest_times = db.query(
        WaterQualityReading.district_id.label("district_id"),
        func.max(WaterQualityReading.recorded_at).label("recorded_at"),
    ).group_by(WaterQualityReading.district_id).subquery()
    latest_rows = db.query(WaterQualityReading).join(
        latest_times,
        and_(
            WaterQualityReading.district_id == latest_times.c.district_id,
            WaterQualityReading.recorded_at == latest_times.c.recorded_at,
        ),
    ).all()
    latest_by_district = {reading.district_id: reading for reading in latest_rows}
    return _build_compliance_summary(districts, latest_by_district)


# ---------- Severity classification ----------

# Severity thresholds expressed as multiples of the SANS 241 limit (or
# absolute pH offset). Anything beyond these is "severe" -> RED; a milder
# breach is YELLOW; full compliance is GREEN. Centralised here so the
# magnitudes (not string content) determine status.
_PH_SEVERE_OFFSET = 1.0
_TDS_SEVERE_MULTIPLIER = 1.5
_TURBIDITY_SEVERE_MULTIPLIER = 3.0


def _classify_reading(body: "WaterQualityCreate") -> tuple[DistrictStatus, list[str]]:
    violations: list[str] = []
    severe = False
    if body.ph is not None and (body.ph < settings.PH_MIN or body.ph > settings.PH_MAX):
        violations.append(f"pH out of range: {body.ph}")
        if body.ph < settings.PH_MIN - _PH_SEVERE_OFFSET or body.ph > settings.PH_MAX + _PH_SEVERE_OFFSET:
            severe = True
    if body.tds is not None and body.tds > settings.TDS_MAX:
        violations.append(f"TDS exceeds limit: {body.tds}")
        if body.tds > settings.TDS_MAX * _TDS_SEVERE_MULTIPLIER:
            severe = True
    if body.turbidity is not None and body.turbidity > settings.TURBIDITY_MAX:
        violations.append(f"Turbidity exceeds limit: {body.turbidity}")
        if body.turbidity > settings.TURBIDITY_MAX * _TURBIDITY_SEVERE_MULTIPLIER:
            severe = True
    if body.chlorine is not None and not 0.2 <= body.chlorine <= 5.0:
        violations.append(f"Chlorine out of range: {body.chlorine}")
        if body.chlorine == 0 or body.chlorine > 10:
            severe = True
    if not violations:
        return DistrictStatus.GREEN, violations
    return (DistrictStatus.RED if severe else DistrictStatus.YELLOW), violations


# ---------- Background ----------

async def _district_status_update(
    district_id: int,
    new_status: DistrictStatus,
    violations: list[str],
) -> None:
    try:
        district_name: Optional[str] = None
        old_status: Optional[DistrictStatus] = None
        with db_session() as db:
            district = db.query(District).filter(District.id == district_id).first()
            if not district:
                return
            if district.status == new_status:
                return
            district_name = district.name
            old_status = district.status
            district.status = new_status
            db.add(Alert(
                district_id=district.id,
                alert_type="water_quality",
                level=AlertLevel.CRITICAL if new_status == DistrictStatus.RED else AlertLevel.WARNING,
                title=f"Water quality status changed: {district_name}",
                message=f"{old_status.value} -> {new_status.value}. Violations: {', '.join(violations)[:500] or 'none (recovered)'}",
                alert_metadata={"violations": violations[:20], "from": old_status.value, "to": new_status.value},
            ))
        if district_name is None:
            return
        await websocket_manager.send_water_quality_alert(
            district_id=district_id,
            district_name=district_name,
            quality_status=new_status.value,
            payload={"violations_count": len(violations)},
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("district status update failed")
