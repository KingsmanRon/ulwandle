"""
Districts API. All endpoints require authentication; mutating endpoints
require supervisor or admin.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.models.models import District, DistrictStatus, User, UserRole

router = APIRouter()


class DistrictCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=20)
    municipality: str = Field(min_length=1, max_length=100)
    province: str = Field(min_length=1, max_length=50)
    population: Optional[int] = Field(default=None, ge=0)
    area_km2: Optional[float] = Field(default=None, ge=0)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


def _district_view(d: District) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "code": d.code,
        "municipality": d.municipality,
        "province": d.province,
        "population": d.population,
        "status": d.status.value,
        "latitude": d.latitude,
        "longitude": d.longitude,
    }


@router.get("/")
def list_districts(
    status: Optional[str] = None,
    province: Optional[str] = None,
    municipality: Optional[str] = None,
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(District)
    if status:
        try:
            q = q.filter(District.status == DistrictStatus(status))
        except ValueError:
            raise HTTPException(400, "Invalid status")
    if province:
        q = q.filter(District.province == province)
    if municipality:
        q = q.filter(District.municipality == municipality)
    total = q.count()
    items = (
        q.order_by(District.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "count": len(items),
        "districts": [_district_view(d) for d in items],
    }


@router.post("/", status_code=201)
def create_district(
    body: DistrictCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(UserRole.ADMIN)),
):
    if db.query(District).filter(
        (District.code == body.code) | (District.name == body.name)
    ).first():
        raise HTTPException(409, "District already exists")
    d = District(**body.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return _district_view(d)


@router.get("/red-flagged/list")
def red_flagged(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    items = db.query(District).filter(District.status == DistrictStatus.RED).all()
    return {
        "count": len(items),
        "districts": [_district_view(d) for d in items],
        "total_affected_population": sum(d.population or 0 for d in items),
    }


@router.get("/status-summary")
def status_summary(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    items = db.query(District).all()
    breakdown = {s.value: {"count": 0, "population": 0} for s in DistrictStatus}
    for d in items:
        bucket = breakdown[d.status.value]
        bucket["count"] += 1
        bucket["population"] += d.population or 0
    return {
        "total_districts": len(items),
        "breakdown": breakdown,
        "critical_action_required": breakdown["red"]["count"] > 0,
    }


@router.get("/{district_id}")
def district_detail(
    district_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    d = db.query(District).filter(District.id == district_id).first()
    if not d:
        raise HTTPException(404, "District not found")
    return {
        "district": _district_view(d),
        "infrastructure": {"sensors": len(d.sensors), "valves": len(d.valves)},
        "alerts": {"active": sum(1 for a in d.alerts if not a.is_resolved)},
    }
