"""
Synthetic water-distribution network topology generator.

Produces in-memory simulated data for the eight South African metros so the
metros API can serve realistic-looking topologies, zones, leaks, and sensor
readings without requiring real telemetry persistence. Replace with real
data sources when available.

Metro ID convention matches `frontend/src/constants/metros.ts` —
canonical, unambiguous full-name keys (e.g. ``ekurhuleni``, ``ethekwini``).
"""

from __future__ import annotations

import random
import threading
from datetime import datetime, timedelta, timezone
from typing import Any


# Canonical metro IDs. Keep in sync with frontend/src/constants/metros.ts.
METRO_CONFIGS: dict[str, dict[str, Any]] = {
    # Population values match Stats SA Census 2022 figures and are
    # canonical fallbacks for when the metros table is empty (e.g.
    # before scripts.seed_metros has run on a fresh database). The real
    # Metro row in the DB takes precedence in API responses; see
    # api/metros.py _to_metro_info.
    "johannesburg": {
        "metro_id": "johannesburg",
        "name": "City of Johannesburg",
        "province": "Gauteng",
        "population": 4_803_262,  # Census 2022
        "lat": -26.2041,
        "lng": 28.0473,
        "intersection_count": 12,
        "zones": ["North", "South", "East", "West", "Central"],
        "base_intake": 1681.14,  # ML/day, derived 4_803_262 * 350 L/c/d / 1e6
    },
    "cape_town": {
        "metro_id": "cape_town",
        "name": "City of Cape Town",
        "province": "Western Cape",
        "population": 4_772_846,  # Census 2022
        "lat": -33.9249,
        "lng": 18.4241,
        "intersection_count": 12,
        "zones": ["Northern", "Southern", "Eastern", "Western", "CBD"],
        "base_intake": 1670.50,
    },
    "ekurhuleni": {
        "metro_id": "ekurhuleni",
        "name": "City of Ekurhuleni",
        "province": "Gauteng",
        "population": 4_066_691,  # Census 2022
        "lat": -26.1841,
        "lng": 28.1935,
        "intersection_count": 10,
        "zones": ["North", "South", "East", "West"],
        "base_intake": 1423.34,
    },
    "ethekwini": {
        "metro_id": "ethekwini",
        "name": "eThekwini",
        "province": "KwaZulu-Natal",
        "population": 4_239_901,  # Census 2022
        "lat": -29.8587,
        "lng": 31.0218,
        "intersection_count": 11,
        "zones": ["North", "South", "Central", "Coastal"],
        "base_intake": 1483.97,
    },
    "tshwane": {
        "metro_id": "tshwane",
        "name": "City of Tshwane",
        "province": "Gauteng",
        "population": 4_040_315,  # Census 2022
        "lat": -25.7479,
        "lng": 28.2293,
        "intersection_count": 10,
        "zones": ["North", "South", "East", "West", "Central"],
        "base_intake": 1414.11,
    },
    "nelson_mandela_bay": {
        "metro_id": "nelson_mandela_bay",
        "name": "Nelson Mandela Bay",
        "province": "Eastern Cape",
        "population": 1_190_496,  # Census 2022
        "lat": -33.9615,
        "lng": 25.6022,
        "intersection_count": 8,
        "zones": ["North", "South", "Central"],
        "base_intake": 416.67,
    },
    "buffalo_city": {
        "metro_id": "buffalo_city",
        "name": "Buffalo City",
        "province": "Eastern Cape",
        "population": 975_255,  # Census 2022
        "lat": -32.9795,
        "lng": 27.8671,
        "intersection_count": 6,
        "zones": ["North", "South"],
        "base_intake": 341.34,
    },
    "mangaung": {
        "metro_id": "mangaung",
        "name": "Mangaung",
        "province": "Free State",
        "population": 811_431,  # Census 2022
        "lat": -29.1217,
        "lng": 26.2137,
        "intersection_count": 6,
        "zones": ["North", "South"],
        "base_intake": 284.00,
    },
}


class _NetworkBuilder:
    """Builds a synthetic topology for a single metro."""

    def __init__(self, metro_id: str) -> None:
        self.metro_id = metro_id
        self.config = METRO_CONFIGS[metro_id]
        self.intersections: list[dict[str, Any]] = []
        self.connections: list[dict[str, Any]] = []
        self.zones: list[dict[str, Any]] = []

    def build(self) -> dict[str, list[dict[str, Any]]]:
        self._build_intersections()
        self._build_connections()
        self._build_zones()
        return {
            "intersections": self.intersections,
            "connections": self.connections,
            "zones": self.zones,
        }

    def _build_intersections(self) -> None:
        count = self.config["intersection_count"]
        base_lat = self.config["lat"]
        base_lng = self.config["lng"]

        # Source / treatment plant
        self.intersections.append({
            "intersection_id": f"{self.metro_id}-source-001",
            "name": f"{self.config['name']} Main Treatment Plant",
            "type": "SOURCE",
            "lat": base_lat + random.uniform(-0.01, 0.01),
            "lng": base_lng + random.uniform(-0.01, 0.01),
            "flow_rate_ml": self.config["base_intake"],
            "pressure_kpa": random.uniform(350, 450),
            "status": "NORMAL",
        })

        primary_count = max(3, count // 3)
        for i in range(primary_count):
            self.intersections.append({
                "intersection_id": f"{self.metro_id}-primary-{str(i + 1).zfill(3)}",
                "name": f"{self.config['name']} Primary Junction {i + 1}",
                "type": "PRIMARY",
                "lat": base_lat + random.uniform(-0.05, 0.05),
                "lng": base_lng + random.uniform(-0.05, 0.05),
                "flow_rate_ml": self.config["base_intake"] / primary_count * random.uniform(0.8, 1.2),
                "pressure_kpa": random.uniform(300, 400),
                "status": "NORMAL",
            })

        secondary_count = count - primary_count - 1
        for i in range(secondary_count):
            self.intersections.append({
                "intersection_id": f"{self.metro_id}-secondary-{str(i + 1).zfill(3)}",
                "name": f"{self.config['name']} Secondary Junction {i + 1}",
                "type": "SECONDARY",
                "lat": base_lat + random.uniform(-0.1, 0.1),
                "lng": base_lng + random.uniform(-0.1, 0.1),
                "flow_rate_ml": self.config["base_intake"] / count * random.uniform(0.5, 1.5),
                "pressure_kpa": random.uniform(200, 350),
                "status": random.choice(["NORMAL", "NORMAL", "NORMAL", "WARNING"]),
            })

    def _build_connections(self) -> None:
        if len(self.intersections) < 2:
            return

        source = self.intersections[0]
        primaries = [i for i in self.intersections if i["type"] == "PRIMARY"]

        for primary in primaries:
            self.connections.append({
                "from_id": source["intersection_id"],
                "to_id": primary["intersection_id"],
                "pipe_diameter_mm": random.choice([600, 800, 1000, 1200]),
                "pipe_length_km": round(random.uniform(2, 15), 2),
                "pipe_material": random.choice(["Steel", "Concrete"]),
                "pipe_age_years": random.randint(10, 40),
                "max_flow_ml": round(random.uniform(500, 1000), 2),
            })

        secondaries = [i for i in self.intersections if i["type"] == "SECONDARY"]
        for secondary in secondaries:
            primary = random.choice(primaries) if primaries else source
            self.connections.append({
                "from_id": primary["intersection_id"],
                "to_id": secondary["intersection_id"],
                "pipe_diameter_mm": random.choice([400, 500, 600]),
                "pipe_length_km": round(random.uniform(1, 8), 2),
                "pipe_material": random.choice(["Steel", "PVC", "Concrete"]),
                "pipe_age_years": random.randint(5, 35),
                "max_flow_ml": round(random.uniform(200, 500), 2),
            })

    def _build_zones(self) -> None:
        zone_names: list[str] = self.config["zones"]
        total_pop = self.config["population"]
        total_intake = self.config["base_intake"]

        for i, zone_name in enumerate(zone_names):
            pop_share = (total_pop / len(zone_names)) * random.uniform(0.7, 1.3)
            intake_share = (total_intake / len(zone_names)) * random.uniform(0.7, 1.3)

            wastage_pct = random.uniform(15, 35)
            usage_share = intake_share * (1 - wastage_pct / 100)
            wastage_share = intake_share - usage_share

            has_leaks = random.random() < 0.3
            leak_count = random.randint(1, 3) if has_leaks else 0

            self.zones.append({
                "zone_id": f"{self.metro_id}-{zone_name.lower().replace(' ', '-')}",
                "name": f"{self.config['name']} {zone_name}",
                "population": int(pop_share),
                "daily_intake_ml": round(intake_share, 2),
                "daily_usage_ml": round(usage_share, 2),
                "daily_wastage_ml": round(wastage_share, 2),
                "wastage_percentage": round(wastage_pct, 1),
                "has_active_leaks": has_leaks,
                "leak_count": leak_count,
                "priority_score": round(wastage_pct * (1.5 if has_leaks else 0.8), 1),
                "bounds_geojson": self._zone_bounds(i),
            })

    def _zone_bounds(self, index: int) -> dict[str, Any]:
        base_lat = self.config["lat"]
        base_lng = self.config["lng"]
        offset_lat = (index // 2) * 0.1 - 0.1
        offset_lng = (index % 2) * 0.1 - 0.05
        return {
            "type": "Polygon",
            "coordinates": [[
                [base_lng + offset_lng, base_lat + offset_lat],
                [base_lng + offset_lng + 0.1, base_lat + offset_lat],
                [base_lng + offset_lng + 0.1, base_lat + offset_lat + 0.1],
                [base_lng + offset_lng, base_lat + offset_lat + 0.1],
                [base_lng + offset_lng, base_lat + offset_lat],
            ]],
        }


def _generate_leaks(metro_id: str, connections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leaks: list[dict[str, Any]] = []
    for connection in connections:
        if random.random() >= 0.2:
            continue
        loss_pct = random.uniform(5, 25)
        if loss_pct > 20:
            severity = "CRITICAL"
        elif loss_pct > 15:
            severity = "HIGH"
        elif loss_pct > 10:
            severity = "MEDIUM"
        else:
            severity = "LOW"
        leaks.append({
            "leak_id": f"LEAK-{metro_id.upper()}-{random.randint(1000, 9999)}",
            "segment_start_id": connection["from_id"],
            "segment_end_id": connection["to_id"],
            "severity": severity,
            "estimated_loss_ml": round(random.uniform(10, 150), 2),
            "estimated_loss_percentage": round(loss_pct, 1),
            "ai_confidence": round(random.uniform(70, 95), 1),
            "probable_cause": random.choice([
                "Underground pipe burst",
                "Pipe corrosion leak",
                "Joint failure",
                "Pressure-induced crack",
                "Illegal connection suspected",
            ]),
            "urgency_level": "URGENT" if severity in ("HIGH", "CRITICAL") else "PLANNED",
            "status": "DETECTED",
            "affected_areas": [f"Area {random.randint(1, 10)}"],
        })
    return leaks


def _build_all_metros() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for metro_id in METRO_CONFIGS:
        builder = _NetworkBuilder(metro_id)
        network = builder.build()
        network["leaks"] = _generate_leaks(metro_id, network["connections"])
        out[metro_id] = network
    return out


# ---------- Public cache ----------
#
# Each gunicorn worker holds its own copy. Within a worker we lock around the
# lazy initialization so two concurrent requests never both call the builder.

_cache_lock = threading.Lock()
_network_cache: dict[str, dict[str, Any]] | None = None


def get_all_networks() -> dict[str, dict[str, Any]]:
    """Return cached topologies for all metros, building on first call."""
    global _network_cache
    if _network_cache is not None:
        return _network_cache
    with _cache_lock:
        if _network_cache is None:
            _network_cache = _build_all_metros()
        return _network_cache


def reset_cache() -> None:
    """Drop the cached topologies. Intended for tests."""
    global _network_cache
    with _cache_lock:
        _network_cache = None


def generate_sensor_readings(intersection_id: str, base_flow: float, hours: int = 24) -> list[dict[str, Any]]:
    """Generate ``hours`` of synthetic time-series sensor data."""
    readings: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    for i in range(hours):
        timestamp = now - timedelta(hours=hours - i)
        time_factor = 1.0 + 0.3 * abs((i % 24) - 12) / 12
        variation = random.uniform(0.85, 1.15)
        flow = base_flow * time_factor * variation
        readings.append({
            "intersection_id": intersection_id,
            "flow_rate_ml": round(flow, 2),
            "pressure_kpa": round(random.uniform(200, 400), 1),
            "temperature_c": round(random.uniform(15, 25), 1),
            "sensor_status": random.choice(["ONLINE"] * 95 + ["ERROR"] * 5),
            "recorded_at": timestamp.isoformat(),
        })
    return readings
