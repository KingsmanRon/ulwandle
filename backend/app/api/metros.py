"""
Metro and network topology API.

Real-data routes (population, NRW, dam levels, daily consumption) read from
the ``metros``, ``dams``, ``dam_storage_readings``, and
``metro_consumption_readings`` tables seeded by ``scripts.seed_metros`` and
refreshed by ``services.dws_scraper`` / ``services.coct_scraper``.

Synthetic-data routes (network topology, intersections, zones, leaks) still
back onto ``app.services.network_generator`` because no real telemetry feed
is wired yet. The synthetic responses are explicitly labelled so the UI can
display a "synthetic" badge.

All routes require an authenticated user; the mutating
``/leaks/{leak_id}/update-status`` route additionally requires an
operator-or-higher role.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.models.models import (
    Dam, DamStorageReading, DataSource, Metro, MetroConsumptionReading,
    MetroDam, User, UserRole,
)
from app.services.network_generator import (
    METRO_CONFIGS,
    generate_sensor_readings,
    get_all_networks,
)

router = APIRouter()


# ---------- Schemas ----------

class SourceRef(BaseModel):
    """Citation for a single figure: the report/system it came from, the
    'as of' date string from the source, and the URL for verification."""
    name: str
    as_of: str
    url: Optional[str] = None
    caveat: Optional[str] = None


class MetroBaseline(BaseModel):
    """Authoritative per-metro reference data with full source attribution."""
    metro_id: str
    code: str
    name: str
    province: str
    lat: Optional[float] = None
    lng: Optional[float] = None

    population: int
    population_source: SourceRef

    nrw_pct: float
    nrw_source: SourceRef

    per_capita_lpcd: Optional[float] = None
    per_capita_source: Optional[SourceRef] = None


class DamLevel(BaseModel):
    dam_id: str
    name: str
    storage_pct: float
    storage_ml: Optional[float] = None
    full_capacity_ml: Optional[float] = None
    as_of: str
    source: SourceRef
    is_primary: bool


class MetroDamsResponse(BaseModel):
    metro_id: str
    dams: list[DamLevel]
    weighted_storage_pct: Optional[float] = None
    has_data: bool


class MetroInfo(BaseModel):
    metro_id: str
    name: str
    province: str
    population: int
    lat: float
    lng: float
    base_intake: float
    data_kind: str = Field(
        default="synthetic",
        description=(
            "'real' when the metro figures are sourced from cited reports, "
            "'synthetic' for in-memory simulated topology."
        ),
    )


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


def _to_metro_info(config: dict, real_metro: Metro | None = None) -> MetroInfo:
    """Build a MetroInfo combining the synthetic topology config with the
    real population figure when available. ``base_intake`` remains synthetic
    until a metered intake feed is wired."""
    if real_metro is not None:
        return MetroInfo(
            metro_id=real_metro.id,
            name=real_metro.name,
            province=real_metro.province,
            population=real_metro.population,
            lat=real_metro.latitude if real_metro.latitude is not None else config["lat"],
            lng=real_metro.longitude if real_metro.longitude is not None else config["lng"],
            base_intake=config["base_intake"],
            data_kind="real",
        )
    return MetroInfo(
        metro_id=config["metro_id"],
        name=config["name"],
        province=config["province"],
        population=config["population"],
        lat=config["lat"],
        lng=config["lng"],
        base_intake=config["base_intake"],
        data_kind="synthetic",
    )


def _to_metro_baseline(metro: Metro) -> MetroBaseline:
    return MetroBaseline(
        metro_id=metro.id,
        code=metro.code,
        name=metro.name,
        province=metro.province,
        lat=metro.latitude,
        lng=metro.longitude,
        population=metro.population,
        population_source=SourceRef(
            name=metro.population_source,
            as_of=metro.population_as_of,
            url=metro.population_source_url,
        ),
        nrw_pct=metro.nrw_pct,
        nrw_source=SourceRef(
            name=metro.nrw_source,
            as_of=metro.nrw_as_of,
            url=metro.nrw_source_url,
            caveat=metro.nrw_caveat,
        ),
        per_capita_lpcd=metro.per_capita_lpcd,
        per_capita_source=(
            SourceRef(
                name=metro.per_capita_source,
                as_of=metro.per_capita_as_of or "",
                url=metro.per_capita_source_url,
                caveat=metro.per_capita_caveat,
            )
            if metro.per_capita_source else None
        ),
    )


def _real_metro_or_404(db: Session, metro_id: str) -> Metro:
    metro = db.get(Metro, metro_id)
    if metro is None:
        raise HTTPException(status_code=404,
                            detail="Metro not found in baseline table — run scripts.seed_metros")
    return metro


# ---------- Routes (read-only, any authenticated user) ----------

@router.get("/", response_model=list[MetroInfo])
def list_metros(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[MetroInfo]:
    real_by_id: dict[str, Metro] = {m.id: m for m in db.query(Metro).all()}
    return [_to_metro_info(cfg, real_by_id.get(mid)) for mid, cfg in METRO_CONFIGS.items()]


@router.get("/baseline", response_model=list[MetroBaseline])
def list_metro_baselines(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[MetroBaseline]:
    """Authoritative per-metro figures with full source attribution.

    Population is from Stats SA Census 2022. NRW is from Joburg Water /
    Daily Maverick / Tshwane Water Balance / DWS depending on metro;
    each row's ``nrw_source`` field cites the actual report. Per-capita
    is the DWS national 2023 baseline (216 L/c/d) until per-metro figures
    are sourced from each municipal annual report."""
    metros = db.query(Metro).order_by(Metro.name).all()
    return [_to_metro_baseline(m) for m in metros]


@router.get("/baseline/{metro_id}", response_model=MetroBaseline)
def get_metro_baseline(
    metro_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> MetroBaseline:
    return _to_metro_baseline(_real_metro_or_404(db, metro_id))


@router.get("/{metro_id}/dams", response_model=MetroDamsResponse)
def get_metro_dam_levels(
    metro_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> MetroDamsResponse:
    """Latest storage % per dam supplying this metro, with source attribution.

    For each dam we pick the most recent reading. If multiple sources have
    data for the same dam we prefer the one with the latest ``as_of``;
    ties broken by ``fetched_at``."""
    _real_metro_or_404(db, metro_id)

    rows = (
        db.query(Dam, MetroDam.is_primary)
        .join(MetroDam, MetroDam.dam_id == Dam.id)
        .filter(MetroDam.metro_id == metro_id)
        .all()
    )
    if not rows:
        return MetroDamsResponse(metro_id=metro_id, dams=[], has_data=False)

    out: list[DamLevel] = []
    weighted_total = 0.0
    weighted_capacity = 0.0
    for dam, is_primary in rows:
        latest = (
            db.query(DamStorageReading)
            .filter(DamStorageReading.dam_id == dam.id)
            .order_by(DamStorageReading.as_of.desc(),
                      DamStorageReading.fetched_at.desc())
            .first()
        )
        if latest is None:
            continue
        out.append(DamLevel(
            dam_id=dam.id,
            name=dam.name,
            storage_pct=latest.storage_pct,
            storage_ml=latest.storage_ml,
            full_capacity_ml=dam.full_capacity_ml,
            as_of=latest.as_of.date().isoformat(),
            source=SourceRef(name=latest.source, as_of=latest.as_of.date().isoformat(),
                             url=latest.source_url),
            is_primary=is_primary,
        ))
        if dam.full_capacity_ml:
            weighted_total += (latest.storage_pct / 100.0) * dam.full_capacity_ml
            weighted_capacity += dam.full_capacity_ml

    weighted_pct: float | None = None
    if weighted_capacity > 0:
        weighted_pct = round((weighted_total / weighted_capacity) * 100.0, 2)

    return MetroDamsResponse(
        metro_id=metro_id,
        dams=out,
        weighted_storage_pct=weighted_pct,
        has_data=bool(out),
    )


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
def get_metro(
    metro_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> MetroInfo:
    config = _metro_or_404(metro_id)
    real = db.get(Metro, metro_id)
    return _to_metro_info(config, real)


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
