"""
Metro and Network API Endpoints
Handles metro data, intersection networks, zones, and leak detection
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.services.network_generator import (
    generate_all_metros,
    generate_sensor_readings,
    METRO_CONFIGS
)


router = APIRouter(prefix="/api/v1/metros", tags=["metros"])


# Pydantic Models (Schemas)
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
    affected_areas: List[str]


class NetworkTopology(BaseModel):
    intersections: List[IntersectionData]
    connections: List[ConnectionData]
    zones: List[ZoneData]
    leaks: List[LeakData]


class SensorReading(BaseModel):
    intersection_id: str
    flow_rate_ml: float
    pressure_kpa: float
    temperature_c: float
    sensor_status: str
    recorded_at: str


# Global cache for generated networks (simulated data)
_network_cache = None


def get_network_data():
    """Get or generate network data"""
    global _network_cache
    if _network_cache is None:
        _network_cache = generate_all_metros()
    return _network_cache


@router.get("/", response_model=List[MetroInfo])
async def get_all_metros():
    """Get list of all 8 SA metros"""
    metros = []
    for metro_id, config in METRO_CONFIGS.items():
        metros.append(MetroInfo(
            metro_id=config["metro_id"],
            name=config["name"],
            province=config["province"],
            population=config["population"],
            lat=config["lat"],
            lng=config["lng"],
            base_intake=config["base_intake"]
        ))
    return metros


@router.get("/{metro_id}", response_model=MetroInfo)
async def get_metro(metro_id: str):
    """Get specific metro information"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    config = METRO_CONFIGS[metro_id]
    return MetroInfo(
        metro_id=config["metro_id"],
        name=config["name"],
        province=config["province"],
        population=config["population"],
        lat=config["lat"],
        lng=config["lng"],
        base_intake=config["base_intake"]
    )


@router.get("/{metro_id}/network", response_model=NetworkTopology)
async def get_metro_network(metro_id: str):
    """Get complete network topology for a metro"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    networks = get_network_data()
    network = networks[metro_id]

    return NetworkTopology(
        intersections=[IntersectionData(**i) for i in network["intersections"]],
        connections=[ConnectionData(**c) for c in network["connections"]],
        zones=[ZoneData(**z) for z in network["zones"]],
        leaks=[LeakData(**l) for l in network["leaks"]]
    )


@router.get("/{metro_id}/intersections", response_model=List[IntersectionData])
async def get_metro_intersections(metro_id: str):
    """Get all intersections for a metro"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    networks = get_network_data()
    network = networks[metro_id]

    return [IntersectionData(**i) for i in network["intersections"]]


@router.get("/{metro_id}/zones", response_model=List[ZoneData])
async def get_metro_zones(metro_id: str):
    """Get all zones for a metro (Phase 2)"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    networks = get_network_data()
    network = networks[metro_id]

    return [ZoneData(**z) for z in network["zones"]]


@router.get("/{metro_id}/zones/problem-areas", response_model=List[ZoneData])
async def get_problem_zones(metro_id: str):
    """Get zones with active leaks or high wastage"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    networks = get_network_data()
    network = networks[metro_id]

    # Filter zones with leaks or high wastage
    problem_zones = [
        z for z in network["zones"]
        if z["has_active_leaks"] or z["wastage_percentage"] > 25
    ]

    # Sort by priority score (highest first)
    problem_zones.sort(key=lambda z: z["priority_score"], reverse=True)

    return [ZoneData(**z) for z in problem_zones]


@router.get("/{metro_id}/leaks", response_model=List[LeakData])
async def get_metro_leaks(metro_id: str, status: Optional[str] = None):
    """Get leak detections for a metro"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    networks = get_network_data()
    network = networks[metro_id]

    leaks = network["leaks"]

    # Filter by status if provided
    if status:
        leaks = [l for l in leaks if l["status"] == status.upper()]

    return [LeakData(**l) for l in leaks]


@router.get("/{metro_id}/leaks/critical", response_model=List[LeakData])
async def get_critical_leaks(metro_id: str):
    """Get critical/high severity leaks for immediate action"""
    if metro_id not in METRO_CONFIGS:
        raise HTTPException(status_code=404, detail="Metro not found")

    networks = get_network_data()
    network = networks[metro_id]

    critical_leaks = [
        l for l in network["leaks"]
        if l["severity"] in ["CRITICAL", "HIGH"] and l["status"] == "DETECTED"
    ]

    # Sort by estimated loss (highest first)
    critical_leaks.sort(key=lambda l: l["estimated_loss_ml"], reverse=True)

    return [LeakData(**l) for l in critical_leaks]


@router.get("/intersections/{intersection_id}/readings", response_model=List[SensorReading])
async def get_intersection_readings(intersection_id: str, hours: int = 24):
    """Get time-series sensor readings for an intersection"""
    # Find which metro this intersection belongs to
    networks = get_network_data()
    found = False
    base_flow = 100.0

    for metro_id, network in networks.items():
        for intersection in network["intersections"]:
            if intersection["intersection_id"] == intersection_id:
                found = True
                base_flow = intersection["flow_rate_ml"]
                break
        if found:
            break

    if not found:
        raise HTTPException(status_code=404, detail="Intersection not found")

    # Generate time-series readings
    readings = generate_sensor_readings(intersection_id, base_flow, hours)

    return [SensorReading(**r) for r in readings]


@router.post("/leaks/{leak_id}/update-status")
async def update_leak_status(leak_id: str, new_status: str, notes: Optional[str] = None):
    """Update leak investigation/repair status"""
    valid_statuses = ["DETECTED", "INVESTIGATING", "REPAIRING", "RESOLVED"]

    if new_status.upper() not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # In real implementation, update database
    # For now, return success
    return {
        "leak_id": leak_id,
        "status": new_status.upper(),
        "notes": notes,
        "updated_at": datetime.now().isoformat()
    }


@router.get("/stats/overview")
async def get_network_stats():
    """Get overall network statistics across all metros"""
    networks = get_network_data()

    total_intersections = sum(len(n["intersections"]) for n in networks.values())
    total_connections = sum(len(n["connections"]) for n in networks.values())
    total_zones = sum(len(n["zones"]) for n in networks.values())
    total_leaks = sum(len(n["leaks"]) for n in networks.values())

    active_leaks = sum(
        len([l for l in n["leaks"] if l["status"] == "DETECTED"])
        for n in networks.values()
    )

    critical_leaks = sum(
        len([l for l in n["leaks"] if l["severity"] in ["CRITICAL", "HIGH"]])
        for n in networks.values()
    )

    return {
        "total_metros": len(METRO_CONFIGS),
        "total_intersections": total_intersections,
        "total_connections": total_connections,
        "total_zones": total_zones,
        "total_leaks": total_leaks,
        "active_leaks": active_leaks,
        "critical_leaks": critical_leaks,
        "coverage_population": sum(c["population"] for c in METRO_CONFIGS.values()),
    }
