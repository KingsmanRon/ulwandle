"""
Dashboard API - Consolidated System Overview
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.models import (
    District, DistrictStatus, Alert, Sensor,
    Valve, ValveStatus, FlowReading, WaterQualityReading,
    LeakDetection, Prediction
)

router = APIRouter()


@router.get("/overview")
async def get_dashboard_overview(
    db: Session = Depends(get_db)
):
    """Get complete system overview for dashboard"""

    # District statistics
    districts = db.query(District).all()
    district_stats = {
        "total": len(districts),
        "green": len([d for d in districts if d.status == DistrictStatus.GREEN]),
        "yellow": len([d for d in districts if d.status == DistrictStatus.YELLOW]),
        "red": len([d for d in districts if d.status == DistrictStatus.RED]),
        "total_population": sum(d.population or 0 for d in districts)
    }

    # Alert statistics (last 24h)
    time_24h = datetime.utcnow() - timedelta(hours=24)
    alerts = db.query(Alert).filter(Alert.created_at >= time_24h).all()
    alert_stats = {
        "total_24h": len(alerts),
        "unresolved": len([a for a in alerts if not a.is_resolved]),
        "critical": len([a for a in alerts if a.level.value in ["critical", "emergency"]])
    }

    # Sensor statistics
    sensors = db.query(Sensor).all()
    sensor_stats = {
        "total": len(sensors),
        "active": len([s for s in sensors if s.is_active]),
        "inactive": len([s for s in sensors if not s.is_active])
    }

    # Valve statistics
    valves = db.query(Valve).all()
    valve_stats = {
        "total": len(valves),
        "open": len([v for v in valves if v.status == ValveStatus.OPEN]),
        "closed": len([v for v in valves if v.status == ValveStatus.CLOSED]),
        "fault": len([v for v in valves if v.status == ValveStatus.FAULT])
    }

    # Leak statistics (unrepaired)
    leaks = db.query(LeakDetection).filter(LeakDetection.is_repaired == False).all()
    leak_stats = {
        "active_leaks": len(leaks),
        "estimated_total_loss_lpm": sum(l.estimated_loss_lpm or 0 for l in leaks)
    }

    # Recent predictions
    recent_predictions = db.query(Prediction).order_by(
        Prediction.created_at.desc()
    ).limit(5).all()

    return {
        "system_status": "operational",
        "last_updated": datetime.utcnow().isoformat(),
        "districts": district_stats,
        "alerts": alert_stats,
        "sensors": sensor_stats,
        "valves": valve_stats,
        "leaks": leak_stats,
        "recent_predictions": [
            {
                "id": p.id,
                "type": p.prediction_type,
                "district_id": p.district_id,
                "confidence": p.confidence_score,
                "created_at": p.created_at.isoformat()
            }
            for p in recent_predictions
        ]
    }


@router.get("/realtime-metrics")
async def get_realtime_metrics(
    db: Session = Depends(get_db)
):
    """Get real-time system metrics"""

    # Recent flow readings (last hour)
    time_1h = datetime.utcnow() - timedelta(hours=1)
    recent_flows = db.query(FlowReading).filter(
        FlowReading.recorded_at >= time_1h
    ).all()

    if recent_flows:
        flow_rates = [r.flow_rate for r in recent_flows]
        avg_flow = sum(flow_rates) / len(flow_rates)
        current_flow = flow_rates[-1] if flow_rates else 0
    else:
        avg_flow = current_flow = 0

    # Recent water quality readings (last hour)
    recent_quality = db.query(WaterQualityReading).filter(
        WaterQualityReading.recorded_at >= time_1h
    ).all()

    compliance_rate = 0
    if recent_quality:
        compliant = len([r for r in recent_quality if r.meets_sans_241])
        compliance_rate = (compliant / len(recent_quality)) * 100

    # System health
    total_sensors = db.query(Sensor).count()
    active_sensors = db.query(Sensor).filter(Sensor.is_active == True).count()
    sensor_health = (active_sensors / total_sensors * 100) if total_sensors > 0 else 0

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "flow_metrics": {
            "current_flow_lpm": round(current_flow, 2),
            "average_flow_1h": round(avg_flow, 2),
            "readings_count": len(recent_flows)
        },
        "water_quality": {
            "compliance_rate_percent": round(compliance_rate, 2),
            "readings_count": len(recent_quality)
        },
        "system_health": {
            "sensor_health_percent": round(sensor_health, 2),
            "total_sensors": total_sensors,
            "active_sensors": active_sensors
        }
    }


@router.get("/district-map")
async def get_district_map_data(
    db: Session = Depends(get_db)
):
    """Get district data for map visualization"""

    districts = db.query(District).all()

    map_data = []
    for district in districts:
        # Get latest water quality
        latest_quality = db.query(WaterQualityReading).filter(
            WaterQualityReading.district_id == district.id
        ).order_by(WaterQualityReading.recorded_at.desc()).first()

        # Get active leaks
        active_leaks = db.query(LeakDetection).filter(
            LeakDetection.district_id == district.id,
            LeakDetection.is_repaired == False
        ).count()

        # Get unresolved alerts
        unresolved_alerts = db.query(Alert).filter(
            Alert.district_id == district.id,
            Alert.is_resolved == False
        ).count()

        map_data.append({
            "id": district.id,
            "name": district.name,
            "code": district.code,
            "municipality": district.municipality,
            "province": district.province,
            "population": district.population,
            "status": district.status.value,
            "coordinates": {
                "latitude": district.latitude,
                "longitude": district.longitude
            } if district.latitude and district.longitude else None,
            "metrics": {
                "active_leaks": active_leaks,
                "unresolved_alerts": unresolved_alerts,
                "water_quality": {
                    "ph": latest_quality.ph if latest_quality else None,
                    "tds": latest_quality.tds if latest_quality else None,
                    "meets_standards": latest_quality.meets_sans_241 if latest_quality else None
                } if latest_quality else None
            }
        })

    return {
        "total_districts": len(map_data),
        "districts": map_data
    }


@router.get("/critical-issues")
async def get_critical_issues(
    db: Session = Depends(get_db)
):
    """Get all critical issues requiring immediate attention"""

    # Red-flagged districts
    red_districts = db.query(District).filter(
        District.status == DistrictStatus.RED
    ).all()

    # Critical alerts (unresolved)
    critical_alerts = db.query(Alert).filter(
        Alert.level.in_(["critical", "emergency"]),
        Alert.is_resolved == False
    ).order_by(Alert.created_at.desc()).all()

    # High-confidence leaks
    critical_leaks = db.query(LeakDetection).filter(
        LeakDetection.is_repaired == False,
        LeakDetection.confidence_score >= 0.7
    ).all()

    # Faulty valves
    faulty_valves = db.query(Valve).filter(
        Valve.status == ValveStatus.FAULT
    ).all()

    return {
        "summary": {
            "red_districts": len(red_districts),
            "critical_alerts": len(critical_alerts),
            "active_leaks": len(critical_leaks),
            "faulty_valves": len(faulty_valves)
        },
        "red_flagged_districts": [
            {
                "id": d.id,
                "name": d.name,
                "municipality": d.municipality,
                "population": d.population,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None
            }
            for d in red_districts
        ],
        "critical_alerts": [
            {
                "id": a.id,
                "type": a.alert_type,
                "level": a.level.value,
                "title": a.title,
                "district_id": a.district_id,
                "created_at": a.created_at.isoformat()
            }
            for a in critical_alerts
        ],
        "active_leaks": [
            {
                "id": l.id,
                "district_id": l.district_id,
                "location": l.location_description,
                "estimated_loss_lpm": l.estimated_loss_lpm,
                "confidence": l.confidence_score,
                "detected_at": l.detected_at.isoformat()
            }
            for l in critical_leaks
        ],
        "faulty_valves": [
            {
                "id": v.id,
                "valve_id": v.valve_id,
                "name": v.name,
                "district_id": v.district_id,
                "location": v.location_name
            }
            for v in faulty_valves
        ]
    }
