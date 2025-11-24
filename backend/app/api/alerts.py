"""
Alerts and Notifications API
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.models import Alert, AlertLevel, District

router = APIRouter()


@router.get("/")
async def get_alerts(
    district_id: Optional[int] = None,
    alert_type: Optional[str] = None,
    level: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    hours: int = Query(24, description="Hours of alerts to retrieve"),
    db: Session = Depends(get_db)
):
    """Get alerts with optional filters"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    query = db.query(Alert).filter(Alert.created_at >= time_threshold)

    if district_id:
        query = query.filter(Alert.district_id == district_id)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
    if level:
        query = query.filter(Alert.level == AlertLevel(level))
    if is_resolved is not None:
        query = query.filter(Alert.is_resolved == is_resolved)

    alerts = query.order_by(Alert.created_at.desc()).limit(500).all()

    return {
        "count": len(alerts),
        "timespan_hours": hours,
        "alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "level": a.level.value,
                "title": a.title,
                "message": a.message,
                "district_id": a.district_id,
                "is_resolved": a.is_resolved,
                "created_at": a.created_at.isoformat(),
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None
            }
            for a in alerts
        ]
    }


@router.get("/{alert_id}")
async def get_alert_details(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed alert information"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    district = None
    if alert.district_id:
        district = db.query(District).filter(District.id == alert.district_id).first()

    return {
        "alert": {
            "id": alert.id,
            "alert_type": alert.alert_type,
            "level": alert.level.value,
            "title": alert.title,
            "message": alert.message,
            "district": {
                "id": district.id,
                "name": district.name,
                "municipality": district.municipality
            } if district else None,
            "metadata": alert.metadata,
            "is_resolved": alert.is_resolved,
            "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
            "resolved_by": alert.resolved_by,
            "notifications_sent": alert.notifications_sent,
            "notification_count": alert.notification_count,
            "created_at": alert.created_at.isoformat()
        }
    }


@router.put("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    resolved_by: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Mark alert as resolved"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if alert.is_resolved:
        raise HTTPException(status_code=400, detail="Alert is already resolved")

    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = resolved_by

    db.commit()

    return {
        "message": "Alert resolved successfully",
        "alert_id": alert_id,
        "resolved_by": resolved_by,
        "resolved_at": alert.resolved_at.isoformat()
    }


@router.get("/statistics/summary")
async def get_alert_statistics(
    hours: int = Query(24, description="Hours for statistics"),
    db: Session = Depends(get_db)
):
    """Get alert statistics"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    alerts = db.query(Alert).filter(Alert.created_at >= time_threshold).all()

    stats = {
        "total": len(alerts),
        "by_level": {
            "info": 0,
            "warning": 0,
            "critical": 0,
            "emergency": 0
        },
        "by_type": {},
        "resolved": 0,
        "unresolved": 0
    }

    for alert in alerts:
        # Count by level
        stats["by_level"][alert.level.value] += 1

        # Count by type
        alert_type = alert.alert_type
        if alert_type not in stats["by_type"]:
            stats["by_type"][alert_type] = 0
        stats["by_type"][alert_type] += 1

        # Count resolved/unresolved
        if alert.is_resolved:
            stats["resolved"] += 1
        else:
            stats["unresolved"] += 1

    return {
        "timespan_hours": hours,
        "statistics": stats
    }
