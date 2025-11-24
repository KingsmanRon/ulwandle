"""
Districts API - Red-Flagged Districts Management
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import District, DistrictStatus

router = APIRouter()


class DistrictCreate(BaseModel):
    name: str
    code: str
    municipality: str
    province: str
    population: Optional[int] = None
    area_km2: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.get("/")
async def get_districts(
    status: Optional[str] = None,
    province: Optional[str] = None,
    municipality: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all districts with optional filters"""
    query = db.query(District)

    if status:
        query = query.filter(District.status == DistrictStatus(status))
    if province:
        query = query.filter(District.province == province)
    if municipality:
        query = query.filter(District.municipality == municipality)

    districts = query.all()

    return {
        "count": len(districts),
        "districts": [
            {
                "id": d.id,
                "name": d.name,
                "code": d.code,
                "municipality": d.municipality,
                "province": d.province,
                "population": d.population,
                "status": d.status.value,
                "latitude": d.latitude,
                "longitude": d.longitude
            }
            for d in districts
        ]
    }


@router.post("/")
async def create_district(
    district: DistrictCreate,
    db: Session = Depends(get_db)
):
    """Create new district"""
    # Check if district already exists
    existing = db.query(District).filter(
        (District.code == district.code) | (District.name == district.name)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="District already exists")

    new_district = District(**district.dict())
    db.add(new_district)
    db.commit()
    db.refresh(new_district)

    return {
        "message": "District created successfully",
        "district": {
            "id": new_district.id,
            "name": new_district.name,
            "code": new_district.code,
            "status": new_district.status.value
        }
    }


@router.get("/{district_id}")
async def get_district_details(
    district_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed district information"""
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Get sensor count
    sensor_count = len(district.sensors)
    valve_count = len(district.valves)
    active_alerts = len([a for a in district.alerts if not a.is_resolved])

    return {
        "district": {
            "id": district.id,
            "name": district.name,
            "code": district.code,
            "municipality": district.municipality,
            "province": district.province,
            "population": district.population,
            "area_km2": district.area_km2,
            "status": district.status.value,
            "latitude": district.latitude,
            "longitude": district.longitude,
            "created_at": district.created_at.isoformat() if district.created_at else None
        },
        "infrastructure": {
            "sensors": sensor_count,
            "valves": valve_count
        },
        "alerts": {
            "active": active_alerts
        }
    }


@router.get("/red-flagged/list")
async def get_red_flagged_districts(
    db: Session = Depends(get_db)
):
    """
    Get all red-flagged districts (undrinkable water)
    Critical endpoint for public health monitoring
    """
    red_districts = db.query(District).filter(
        District.status == DistrictStatus.RED
    ).all()

    return {
        "count": len(red_districts),
        "critical_status": "RED - Undrinkable Water",
        "districts": [
            {
                "id": d.id,
                "name": d.name,
                "code": d.code,
                "municipality": d.municipality,
                "province": d.province,
                "population": d.population,
                "status": d.status.value,
                "latitude": d.latitude,
                "longitude": d.longitude,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None
            }
            for d in red_districts
        ],
        "total_affected_population": sum(d.population or 0 for d in red_districts)
    }


@router.get("/status-summary")
async def get_status_summary(
    db: Session = Depends(get_db)
):
    """Get summary of district statuses"""
    all_districts = db.query(District).all()

    green = [d for d in all_districts if d.status == DistrictStatus.GREEN]
    yellow = [d for d in all_districts if d.status == DistrictStatus.YELLOW]
    red = [d for d in all_districts if d.status == DistrictStatus.RED]

    return {
        "total_districts": len(all_districts),
        "status_breakdown": {
            "green": {
                "count": len(green),
                "description": "Safe, drinkable water",
                "population": sum(d.population or 0 for d in green)
            },
            "yellow": {
                "count": len(yellow),
                "description": "Monitoring required",
                "population": sum(d.population or 0 for d in yellow)
            },
            "red": {
                "count": len(red),
                "description": "Undrinkable water - CRITICAL",
                "population": sum(d.population or 0 for d in red)
            }
        },
        "critical_action_required": len(red) > 0
    }


@router.put("/{district_id}/status")
async def update_district_status(
    district_id: int,
    status: str,
    reason: str,
    db: Session = Depends(get_db)
):
    """Manually update district status"""
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    try:
        new_status = DistrictStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status. Must be: green, yellow, or red")

    old_status = district.status
    district.status = new_status
    db.commit()

    return {
        "message": "District status updated",
        "district_id": district_id,
        "district_name": district.name,
        "old_status": old_status.value,
        "new_status": new_status.value,
        "reason": reason
    }
