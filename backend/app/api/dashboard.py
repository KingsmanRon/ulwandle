"""
Dashboard API. Read-only consolidated overview, requires authentication.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.database import get_db
from app.models.models import (
    Alert, AlertLevel, District, DistrictStatus, FlowReading, LeakDetection,
    Sensor, User, Valve, ValveStatus, WaterQualityReading,
)

router = APIRouter()


@router.get("/overview")
def overview(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    districts = db.query(District).all()
    district_stats = {
        "total": len(districts),
        "unmonitored": sum(1 for d in districts if d.status == DistrictStatus.UNMONITORED),
        "green": sum(1 for d in districts if d.status == DistrictStatus.GREEN),
        "yellow": sum(1 for d in districts if d.status == DistrictStatus.YELLOW),
        "red": sum(1 for d in districts if d.status == DistrictStatus.RED),
        "total_population": sum(d.population or 0 for d in districts),
    }

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    alerts = db.query(Alert).filter(Alert.created_at >= cutoff).all()
    alert_stats = {
        "total_24h": len(alerts),
        "unresolved": sum(1 for a in alerts if not a.is_resolved),
        "critical": sum(1 for a in alerts
                        if a.level in (AlertLevel.CRITICAL, AlertLevel.EMERGENCY)),
    }

    sensors = db.query(Sensor).all()
    valves = db.query(Valve).all()
    leaks = db.query(LeakDetection).filter(LeakDetection.is_repaired == False).all()  # noqa: E712

    return {
        "system_status": "operational" if sensors else "unmonitored",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "districts": district_stats,
        "alerts": alert_stats,
        "sensors": {
            "total": len(sensors),
            "active": sum(1 for s in sensors if s.is_active),
        },
        "valves": {
            "total": len(valves),
            "open": sum(1 for v in valves if v.status == ValveStatus.OPEN),
            "closed": sum(1 for v in valves if v.status == ValveStatus.CLOSED),
            "fault": sum(1 for v in valves if v.status == ValveStatus.FAULT),
        },
        "leaks": {
            "active": len(leaks),
            "estimated_total_loss_lpm": sum(l.estimated_loss_lpm or 0 for l in leaks),
        },
    }


@router.get("/realtime-metrics")
def realtime_metrics(db: Session = Depends(get_db),
                     _user: User = Depends(get_current_user)):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    flows = db.query(FlowReading).filter(FlowReading.recorded_at >= cutoff).all()
    avg = round(sum(f.flow_rate for f in flows) / len(flows), 2) if flows else 0
    qualities = db.query(WaterQualityReading).filter(
        WaterQualityReading.recorded_at >= cutoff
    ).all()
    rate = round(
        100 * sum(1 for q in qualities if q.meets_sans_241) / len(qualities), 2
    ) if qualities else 0
    total_sensors = db.query(Sensor).count()
    active_sensors = db.query(Sensor).filter(Sensor.is_active == True).count()  # noqa: E712
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "flow_metrics": {"average_flow_1h": avg, "readings_count": len(flows)},
        "water_quality": {"compliance_rate_percent": rate, "readings_count": len(qualities)},
        "system_health": {
            "total_sensors": total_sensors,
            "active_sensors": active_sensors,
        },
    }


@router.get("/critical-issues")
def critical_issues(db: Session = Depends(get_db),
                    _user: User = Depends(get_current_user)):
    red = db.query(District).filter(District.status == DistrictStatus.RED).all()
    critical = db.query(Alert).filter(
        Alert.level.in_([AlertLevel.CRITICAL, AlertLevel.EMERGENCY]),
        Alert.is_resolved == False,  # noqa: E712
    ).order_by(Alert.created_at.desc()).limit(50).all()
    leaks = db.query(LeakDetection).filter(
        LeakDetection.is_repaired == False,  # noqa: E712
        LeakDetection.confidence_score >= 0.7,
    ).limit(50).all()
    fault = db.query(Valve).filter(Valve.status == ValveStatus.FAULT).all()
    return {
        "summary": {
            "red_districts": len(red),
            "critical_alerts": len(critical),
            "active_leaks": len(leaks),
            "faulty_valves": len(fault),
        },
        "red_flagged_districts": [{"id": d.id, "name": d.name} for d in red],
        "critical_alerts": [
            {"id": a.id, "level": a.level.value, "title": a.title,
             "created_at": a.created_at.isoformat()} for a in critical
        ],
    }
