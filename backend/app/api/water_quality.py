"""
Water Quality Monitoring API
pH, TDS, and compliance monitoring (SANS 241)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import WaterQualityReading, District, DistrictStatus, Alert, AlertLevel
from app.core.config import settings
from app.services.claude_service import claude_service
from app.services.websocket_manager import websocket_manager

router = APIRouter()


class WaterQualityCreate(BaseModel):
    district_id: int
    ph: Optional[float] = None
    tds: Optional[float] = None
    turbidity: Optional[float] = None
    temperature: Optional[float] = None
    chlorine: Optional[float] = None


@router.post("/readings")
async def add_water_quality_reading(
    reading: WaterQualityCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Add new water quality reading"""
    # Verify district exists
    district = db.query(District).filter(District.id == reading.district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Check compliance with SANS 241 standards
    meets_standards = True
    violations = []

    if reading.ph is not None:
        if reading.ph < settings.PH_MIN or reading.ph > settings.PH_MAX:
            meets_standards = False
            violations.append(f"pH out of range: {reading.ph} (acceptable: {settings.PH_MIN}-{settings.PH_MAX})")

    if reading.tds is not None:
        if reading.tds > settings.TDS_MAX:
            meets_standards = False
            violations.append(f"TDS exceeds limit: {reading.tds} mg/L (max: {settings.TDS_MAX})")

    if reading.turbidity is not None:
        if reading.turbidity > settings.TURBIDITY_MAX:
            meets_standards = False
            violations.append(f"Turbidity exceeds limit: {reading.turbidity} NTU (max: {settings.TURBIDITY_MAX})")

    # Create reading
    new_reading = WaterQualityReading(
        **reading.dict(),
        meets_sans_241=meets_standards
    )
    db.add(new_reading)
    db.commit()
    db.refresh(new_reading)

    # Update district status if needed
    if not meets_standards:
        background_tasks.add_task(
            update_district_status,
            district_id=district.id,
            violations=violations,
            db=db
        )

    return {
        "message": "Water quality reading recorded",
        "reading_id": new_reading.id,
        "meets_standards": meets_standards,
        "violations": violations if not meets_standards else [],
        "timestamp": new_reading.recorded_at.isoformat()
    }


@router.get("/readings")
async def get_water_quality_readings(
    district_id: Optional[int] = None,
    hours: int = Query(24, description="Hours of historical data"),
    db: Session = Depends(get_db)
):
    """Get water quality readings"""
    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    query = db.query(WaterQualityReading).filter(
        WaterQualityReading.recorded_at >= time_threshold
    )

    if district_id:
        query = query.filter(WaterQualityReading.district_id == district_id)

    readings = query.order_by(WaterQualityReading.recorded_at.desc()).limit(500).all()

    return {
        "count": len(readings),
        "timespan_hours": hours,
        "readings": [
            {
                "id": r.id,
                "district_id": r.district_id,
                "ph": r.ph,
                "tds": r.tds,
                "turbidity": r.turbidity,
                "temperature": r.temperature,
                "chlorine": r.chlorine,
                "meets_sans_241": r.meets_sans_241,
                "recorded_at": r.recorded_at.isoformat()
            }
            for r in readings
        ]
    }


@router.get("/readings/{district_id}/latest")
async def get_latest_reading(
    district_id: int,
    db: Session = Depends(get_db)
):
    """Get latest water quality reading for a district"""
    reading = db.query(WaterQualityReading).filter(
        WaterQualityReading.district_id == district_id
    ).order_by(WaterQualityReading.recorded_at.desc()).first()

    if not reading:
        raise HTTPException(status_code=404, detail="No readings found for this district")

    return {
        "district_id": reading.district_id,
        "ph": reading.ph,
        "tds": reading.tds,
        "turbidity": reading.turbidity,
        "temperature": reading.temperature,
        "chlorine": reading.chlorine,
        "meets_sans_241": reading.meets_sans_241,
        "recorded_at": reading.recorded_at.isoformat()
    }


@router.post("/analyze/{district_id}")
async def analyze_water_quality(
    district_id: int,
    hours: int = Query(24, description="Hours of data to analyze"),
    db: Session = Depends(get_db)
):
    """Analyze water quality using Claude AI"""
    # Get district
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Get recent readings
    time_threshold = datetime.utcnow() - timedelta(hours=hours)
    readings = db.query(WaterQualityReading).filter(
        WaterQualityReading.district_id == district_id,
        WaterQualityReading.recorded_at >= time_threshold
    ).order_by(WaterQualityReading.recorded_at.desc()).all()

    if not readings:
        raise HTTPException(status_code=404, detail="No water quality data available")

    # Prepare data for Claude
    quality_data = [
        {
            "ph": r.ph,
            "tds": r.tds,
            "turbidity": r.turbidity,
            "temperature": r.temperature,
            "chlorine": r.chlorine,
            "meets_standards": r.meets_sans_241,
            "timestamp": r.recorded_at.isoformat()
        }
        for r in readings[:50]  # Limit to recent 50 readings
    ]

    compliance_standards = {
        "ph_range": {"min": settings.PH_MIN, "max": settings.PH_MAX},
        "tds_max": settings.TDS_MAX,
        "turbidity_max": settings.TURBIDITY_MAX,
        "standard": "SANS 241"
    }

    # Analyze with Claude
    analysis = await claude_service.detect_water_quality_issues(
        district_name=district.name,
        quality_readings=quality_data,
        compliance_standards=compliance_standards
    )

    # Update district status based on analysis
    if "district_status" in analysis:
        new_status = analysis["district_status"]
        if new_status != district.status.value:
            old_status = district.status
            district.status = DistrictStatus(new_status)
            db.commit()

            # Send notification
            await websocket_manager.send_water_quality_alert(
                district_id=district.id,
                district_name=district.name,
                status=new_status,
                quality_data={"analysis": analysis}
            )

            # Create alert if critical
            if new_status == "red":
                alert = Alert(
                    district_id=district.id,
                    alert_type="water_quality",
                    level=AlertLevel.CRITICAL,
                    title=f"CRITICAL: Water Quality Alert - {district.name}",
                    message=analysis.get("summary", "Water quality has deteriorated to unsafe levels"),
                    alert_metadata={"analysis": analysis}
                )
                db.add(alert)
                db.commit()

    return {
        "district_id": district_id,
        "district_name": district.name,
        "analysis": analysis,
        "readings_analyzed": len(quality_data),
        "timespan_hours": hours
    }


@router.get("/compliance-summary")
async def get_compliance_summary(
    db: Session = Depends(get_db)
):
    """Get overall compliance summary across all districts"""
    districts = db.query(District).all()

    summary = {
        "total_districts": len(districts),
        "green": 0,
        "yellow": 0,
        "red": 0,
        "districts": []
    }

    for district in districts:
        # Count by status
        if district.status == DistrictStatus.GREEN:
            summary["green"] += 1
        elif district.status == DistrictStatus.YELLOW:
            summary["yellow"] += 1
        elif district.status == DistrictStatus.RED:
            summary["red"] += 1

        # Get latest reading
        latest_reading = db.query(WaterQualityReading).filter(
            WaterQualityReading.district_id == district.id
        ).order_by(WaterQualityReading.recorded_at.desc()).first()

        summary["districts"].append({
            "id": district.id,
            "name": district.name,
            "status": district.status.value,
            "municipality": district.municipality,
            "province": district.province,
            "latest_reading": {
                "ph": latest_reading.ph if latest_reading else None,
                "tds": latest_reading.tds if latest_reading else None,
                "meets_standards": latest_reading.meets_sans_241 if latest_reading else None,
                "recorded_at": latest_reading.recorded_at.isoformat() if latest_reading else None
            } if latest_reading else None
        })

    return summary


@router.get("/standards")
async def get_water_quality_standards():
    """Get SANS 241 water quality standards"""
    return {
        "standard": "SANS 241 - Drinking Water",
        "parameters": {
            "ph": {
                "min": settings.PH_MIN,
                "max": settings.PH_MAX,
                "unit": "pH",
                "description": "Acidity/Alkalinity level"
            },
            "tds": {
                "max": settings.TDS_MAX,
                "unit": "mg/L",
                "description": "Total Dissolved Solids"
            },
            "turbidity": {
                "max": settings.TURBIDITY_MAX,
                "unit": "NTU",
                "description": "Water clarity"
            },
            "chlorine": {
                "min": 0.2,
                "max": 5.0,
                "unit": "mg/L",
                "description": "Free chlorine residual"
            }
        },
        "reference": "South African National Standard 241:2015"
    }


async def update_district_status(
    district_id: int,
    violations: list,
    db: Session
):
    """Background task to update district status"""
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        return

    # Determine new status based on violations
    severity_keywords = ["critical", "unsafe", "exceeds", "dangerous"]
    is_critical = any(keyword in v.lower() for v in violations for keyword in severity_keywords)

    old_status = district.status

    if is_critical:
        new_status = DistrictStatus.RED
    elif len(violations) > 0:
        new_status = DistrictStatus.YELLOW
    else:
        new_status = DistrictStatus.GREEN

    if new_status != old_status:
        district.status = new_status
        db.commit()

        # Create alert
        alert_level = AlertLevel.CRITICAL if new_status == DistrictStatus.RED else AlertLevel.WARNING

        alert = Alert(
            district_id=district.id,
            alert_type="water_quality",
            level=alert_level,
            title=f"Water Quality Status Changed: {district.name}",
            message=f"Status changed from {old_status.value.upper()} to {new_status.value.upper()}. Violations: {', '.join(violations)}",
            metadata={"violations": violations, "old_status": old_status.value, "new_status": new_status.value}
        )
        db.add(alert)
        db.commit()

        # Send WebSocket notification
        await websocket_manager.send_water_quality_alert(
            district_id=district.id,
            district_name=district.name,
            status=new_status.value,
            quality_data={"violations": violations}
        )
