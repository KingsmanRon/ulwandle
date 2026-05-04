"""
Metro and network topology API.

Serves synthetic distribution-network data for the eight South African
metropolitan municipalities. All routes require an authenticated user; the
mutating ``/leaks/{leak_id}/update-status`` route additionally requires an
operator-or-higher role.

The underlying data lives in ``app.services.network_generator`` and is
in-memory synthetic (no DB persistence). When real telemetry persistence
exists, swap the ``get_all_networks()`` calls for queries against it.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user, require_roles
from app.models.models import User, UserRole
from app.services.network_generator import (
    METRO_CONFIGS,
    generate_sensor_readings,
    get_all_networks,
)

router = APIRouter()


# ---------- Schemas ----------

class MetroInfo(BaseModel):
    metro_id: str
    name: str
    province: str
    population: int
    lat: float
    lng: float
    base_intake: float


class IntersectionData(BaseModel):
    intersection_id: str
    name: str
    type: str
    lat: float
    lng: float
    flow_rate_ml: float
    pressure_kpa: float
    status: str


class ConnectionData(BaseModel):
    from_id: str
    to_id: str
    pipe_diameter_mm: int
    pipe_length_km: float
    pipe_material: str
    pipe_age_years: int
    max_flow_ml: float


class ZoneData(BaseModel):
    zone_id: str
    name: str
    population: int
    daily_intake_ml: float
    daily_usage_ml: float
    daily_wastage_ml: float
    wastage_percentage: float
    has_active_leaks: bool
    leak_count: int
    priority_score: float
    bounds_geojson: dict


class LeakData(BaseModel):
    leak_id: str
    segment_start_id: str
    segment_end_id: str
    severity: str
    estimated_loss_ml: float
    estimated_loss_percentage: float
    ai_confidence: float
    probable_cause: str
    urgency_level: str
    status: str
    affected_areas: list[str]


class NetworkTopologyResponse(BaseModel):
    intersections: list[IntersectionData]
    connections: list[ConnectionData]
    zones: list[ZoneData]
    leaks: list[LeakData]


class SensorReading(BaseModel):
    intersection_id: str
    flow_rate_ml: float
    pressure_kpa: float
    temperature_c: float
    sensor_status: str
    recorded_at: str


class LeakStatusUpdate(BaseModel):
    new_status: str = Field(pattern="^(DETECTED|INVESTIGATING|REPAIRING|RESOLVED)$")
    notes: Optional[str] = Field(default=None, max_length=2000)


class LeakStatusUpdateResponse(BaseModel):
    leak_id: str
    status: str
    notes: Optional[str]
    updated_at: str
    updated_by: int


class NetworkStatsOverview(BaseModel):
    total_metros: int
    total_intersections: int
    total_connections: int
    total_zones: int
    total_leaks: int
    active_leaks: int
    critical_leaks: int
    coverage_population: int


# ---------- Helpers ----------

def _metro_or_404(metro_id: str) -> dict:
    config = METRO_CONFIGS.get(metro_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Metro not found")
    return config


def _network_or_404(metro_id: str) -> dict:
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")
    return get_all_networks()[metro_id]


def _to_metro_info(config: dict) -> MetroInfo:
    return MetroInfo(
        metro_id=config["metro_id"],
        name=config["name"],
        province=config["province"],
        population=config["population"],
        lat=config["lat"],
        lng=config["lng"],
        base_intake=config["base_intake"],
    )


# ---------- Routes (read-only, any authenticated user) ----------

@router.get("/", response_model=list[MetroInfo])
def list_metros(_user: User = Depends(get_current_user)) -> list[MetroInfo]:
    return [_to_metro_info(config) for config in METRO_CONFIGS.values()]


@router.get("/stats/overview", response_model=NetworkStatsOverview)
def network_stats(_user: User = Depends(get_current_user)) -> NetworkStatsOverview:
    networks = get_all_networks()
    total_intersections = sum(len(n["intersections"]) for n in networks.values())
    total_connections = sum(len(n["connections"]) for n in networks.values())
    total_zones = sum(len(n["zones"]) for n in networks.values())
    total_leaks = sum(len(n["leaks"]) for n in networks.values())
    active_leaks = sum(
        sum(1 for leak in n["leaks"] if leak["status"] == "DETECTED")
        for n in networks.values()
    )
    critical_leaks = sum(
        sum(1 for leak in n["leaks"] if leak["severity"] in ("CRITICAL", "HIGH"))
        for n in networks.values()
    )
    return NetworkStatsOverview(
        total_metros=len(METRO_CONFIGS),
        total_intersections=total_intersections,
        total_connections=total_connections,
        total_zones=total_zones,
        total_leaks=total_leaks,
        active_leaks=active_leaks,
        critical_leaks=critical_leaks,
        coverage_population=sum(c["population"] for c in METRO_CONFIGS.values()),
    )


@router.get("/intersections/{intersection_id}/readings", response_model=list[SensorReading])
def intersection_readings(
    intersection_id: str = Path(..., min_length=1, max_length=128),
    hours: int = Query(24, ge=1, le=168),
    _user: User = Depends(get_current_user),
) -> list[SensorReading]:
    networks = get_all_networks()
    base_flow: float | None = None
    for network in networks.values():
        for intersection in network["intersections"]:
            if intersection["intersection_id"] == intersection_id:
                base_flow = float(intersection["flow_rate_ml"])
                break
        if base_flow is not None:
            break
    if base_flow is None:
        raise HTTPException(status_code=404, detail="Intersection not found")
    return [SensorReading(**r) for r in generate_sensor_readings(intersection_id, base_flow, hours)]


@router.get("/{metro_id}", response_model=MetroInfo)
def get_metro(metro_id: str, _user: User = Depends(get_current_user)) -> MetroInfo:
    return _to_metro_info(_metro_or_404(metro_id))


@router.get("/{metro_id}/network", response_model=NetworkTopologyResponse)
def get_metro_network(metro_id: str, _user: User = Depends(get_current_user)) -> NetworkTopologyResponse:
    network = _network_or_404(metro_id)
    return NetworkTopologyResponse(
        intersections=[IntersectionData(**i) for i in network["intersections"]],
        connections=[ConnectionData(**c) for c in network["connections"]],
        zones=[ZoneData(**z) for z in network["zones"]],
        leaks=[LeakData(**l) for l in network["leaks"]],
    )


@router.get("/{metro_id}/intersections", response_model=list[IntersectionData])
def get_metro_intersections(metro_id: str, _user: User = Depends(get_current_user)) -> list[IntersectionData]:
    return [IntersectionData(**i) for i in _network_or_404(metro_id)["intersections"]]


@router.get("/{metro_id}/zones", response_model=list[ZoneData])
def get_metro_zones(metro_id: str, _user: User = Depends(get_current_user)) -> list[ZoneData]:
    return [ZoneData(**z) for z in _network_or_404(metro_id)["zones"]]


@router.get("/{metro_id}/zones/problem-areas", response_model=list[ZoneData])
def get_problem_zones(metro_id: str, _user: User = Depends(get_current_user)) -> list[ZoneData]:
    zones = _network_or_404(metro_id)["zones"]
    problem = [z for z in zones if z["has_active_leaks"] or z["wastage_percentage"] > 25]
    problem.sort(key=lambda z: z["priority_score"], reverse=True)
    return [ZoneData(**z) for z in problem]


@router.get("/{metro_id}/leaks", response_model=list[LeakData])
def get_metro_leaks(
    metro_id: str,
    status: Optional[str] = Query(default=None, pattern="^(DETECTED|INVESTIGATING|REPAIRING|RESOLVED)$"),
    _user: User = Depends(get_current_user),
) -> list[LeakData]:
    leaks = _network_or_404(metro_id)["leaks"]
    if status:
        leaks = [l for l in leaks if l["status"] == status]
    return [LeakData(**l) for l in leaks]


@router.get("/{metro_id}/leaks/critical", response_model=list[LeakData])
def get_critical_leaks(metro_id: str, _user: User = Depends(get_current_user)) -> list[LeakData]:
    leaks = _network_or_404(metro_id)["leaks"]
    critical = [l for l in leaks if l["severity"] in ("CRITICAL", "HIGH") and l["status"] == "DETECTED"]
    critical.sort(key=lambda l: l["estimated_loss_ml"], reverse=True)
    return [LeakData(**l) for l in critical]


# ---------- Routes (write — operator or above) ----------

@router.post("/leaks/{leak_id}/update-status", response_model=LeakStatusUpdateResponse)
def update_leak_status(
    leak_id: str,
    body: LeakStatusUpdate,
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)),
) -> LeakStatusUpdateResponse:
    # Synthetic data — the call is accepted but state is not persisted yet.
    # Once leaks live in a real table, this should commit a row update plus
    # an AuditLog entry. For now we return an ack so the UI flow works.
    return LeakStatusUpdateResponse(
        leak_id=leak_id,
        status=body.new_status,
        notes=body.notes,
        updated_at=datetime.now(timezone.utc).isoformat(),
        updated_by=user.id,
    )
