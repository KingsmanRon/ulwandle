"""
Predictions API. Auth-gated; AI output is advisory and never gates downstream
state changes.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.db.database import db_session, get_db
from app.models.models import (
    Alert, AlertLevel, District, FlowReading, LeakDetection, Prediction,
    Sensor, User, UserRole,
)
from app.services.claude_service import claude_service
from app.services.websocket_manager import websocket_manager

router = APIRouter()


class PredictionRequest(BaseModel):
    district_id: int
    prediction_type: str = Field(pattern="^(consumption|leak|demand)$")
    horizon: str = Field(default="24h", pattern="^(1h|24h|7d|30d)$")
    historical_hours: int = Field(default=168, ge=1, le=24 * 30)


def _prediction_view(prediction: Prediction) -> dict:
    return {
        "id": prediction.id,
        "prediction_type": prediction.prediction_type,
        "district_id": prediction.district_id,
        "confidence_score": prediction.confidence_score,
        "prediction_horizon": prediction.prediction_horizon,
        "created_at": prediction.created_at.isoformat(),
        "summary": prediction.claude_analysis,
    }


@router.post("/analyze")
async def analyze(
    body: PredictionRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)),
):
    district = db.query(District).filter(District.id == body.district_id).first()
    if not district:
        raise HTTPException(404, "District not found")
    sensors = db.query(Sensor).filter(
        Sensor.district_id == body.district_id,
        Sensor.sensor_type == "flow",
        Sensor.is_active == True,  # noqa: E712
    ).all()
    if not sensors:
        raise HTTPException(404, "No active flow sensors in district")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=body.historical_hours)
    sensor_ids = [s.id for s in sensors]
    rows = db.query(FlowReading).filter(
        FlowReading.sensor_id.in_(sensor_ids),
        FlowReading.recorded_at >= cutoff,
    ).order_by(FlowReading.recorded_at.desc()).limit(2000).all()
    if not rows:
        raise HTTPException(404, "No flow data available")

    flow_data = [{"flow_rate": r.flow_rate} for r in rows]
    rates = [r.flow_rate for r in rows]
    historical = {
        "count": len(rows),
        "avg": round(sum(rates) / len(rates), 2),
        "min": round(min(rates), 2),
        "max": round(max(rates), 2),
    }

    advisory = await claude_service.analyze_consumption_patterns(
        district_name=district.name,
        flow_data=flow_data,
        historical_data=historical,
    )

    prediction = Prediction(
        prediction_type=body.prediction_type,
        district_id=body.district_id,
        confidence_score=float(advisory.get("leak_detection", {}).get("confidence_score", 0.0) or 0.0),
        prediction_horizon=body.horizon,
        data_points_used=len(rows),
        features_analyzed={"sensors": len(sensors), "readings": len(rows)},
        prediction_result=advisory,
        claude_analysis=str(advisory.get("summary", ""))[:2000],
        valid_until=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    if advisory.get("leak_detection", {}).get("potential_leaks"):
        background.add_task(_create_leak_alert, district.id, advisory)

    await websocket_manager.send_prediction_update(
        district_id=district.id,
        district_name=district.name,
        prediction=advisory,
    )

    return {
        "prediction_id": prediction.id,
        "district_id": district.id,
        "advisory": advisory,
    }


@router.get("/predictions")
def list_predictions(
    district_id: Optional[int] = None,
    prediction_type: Optional[str] = None,
    hours: int = Query(24, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = db.query(Prediction).filter(Prediction.created_at >= cutoff)
    if district_id:
        q = q.filter(Prediction.district_id == district_id)
    if prediction_type:
        q = q.filter(Prediction.prediction_type == prediction_type)
    rows = q.order_by(Prediction.created_at.desc()).limit(100).all()
    return {
        "count": len(rows),
        "predictions": [_prediction_view(prediction) for prediction in rows],
    }


# ---------- Background ----------

async def _create_leak_alert(district_id: int, advisory: dict) -> None:
    try:
        with db_session() as db:
            district = db.query(District).filter(District.id == district_id).first()
            if not district:
                return
            ld = advisory.get("leak_detection", {}) or {}
            db.add(LeakDetection(
                district_id=district_id,
                location_description=f"AI-flagged region in {district.name}",
                estimated_loss_lpm=float(ld.get("estimated_loss_lpm") or 0.0),
                confidence_score=float(ld.get("confidence_score") or 0.0),
                detection_method="ai",
                is_confirmed=False,
            ))
            db.add(Alert(
                district_id=district_id,
                alert_type="leak",
                level=AlertLevel.WARNING,
                title=f"Potential leak detected — {district.name}",
                message=f"Confidence {ld.get('confidence_score', 0)} | est loss {ld.get('estimated_loss_lpm', 0)} L/min",
                alert_metadata={"leak": ld},
            ))
        await websocket_manager.send_leak_detection(
            district_id=district_id,
            district_name=district.name,
            leak_data=ld,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("create_leak_alert failed")
