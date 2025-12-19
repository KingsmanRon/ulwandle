"""
Network Topology Generator
Generates simulated water distribution network for all 8 SA metros
"""

import random
from typing import List, Dict, Tuple
from datetime import datetime, timedelta


# Metro configurations with real coordinates
METRO_CONFIGS = {
    "jhb": {
        "metro_id": "jhb",
        "name": "City of Johannesburg",
        "province": "Gauteng",
        "population": 5635127,
        "lat": -26.2041,
        "lng": 28.0473,
        "intersection_count": 12,  # Number of intersections in network
        "zones": ["North", "South", "East", "West", "Central"],
        "base_intake": 1972.25,  # ML/day
    },
    "cpt": {
        "metro_id": "cpt",
        "name": "City of Cape Town",
        "province": "Western Cape",
        "population": 4618188,
        "lat": -33.9249,
        "lng": 18.4241,
        "intersection_count": 12,
        "zones": ["Northern", "Southern", "Eastern", "Western", "CBD"],
        "base_intake": 1702.17,
    },
    "ethek": {
        "metro_id": "ethek",
        "name": "Ekurhuleni",
        "province": "Gauteng",
        "population": 3816476,
        "lat": -26.1841,
        "lng": 28.1935,
        "intersection_count": 10,
        "zones": ["North", "South", "East", "West"],
        "base_intake": 1407.01,
    },
    "eth": {
        "metro_id": "eth",
        "name": "eThekwini (Durban)",
        "province": "KwaZulu-Natal",
        "population": 3995000,
        "lat": -29.8587,
        "lng": 31.0218,
        "intersection_count": 11,
        "zones": ["North", "South", "Central", "Coastal"],
        "base_intake": 1472.57,
    },
    "tsh": {
        "metro_id": "tsh",
        "name": "City of Tshwane (Pretoria)",
        "province": "Gauteng",
        "population": 3275152,
        "lat": -25.7479,
        "lng": 28.2293,
        "intersection_count": 10,
        "zones": ["North", "South", "East", "West", "Central"],
        "base_intake": 1207.17,
    },
    "nmb": {
        "metro_id": "nmb",
        "name": "Nelson Mandela Bay",
        "province": "Eastern Cape",
        "population": 1292816,
        "lat": -33.9615,
        "lng": 25.6022,
        "intersection_count": 8,
        "zones": ["North", "South", "Central"],
        "base_intake": 476.38,
    },
    "buf": {
        "metro_id": "buf",
        "name": "Buffalo City",
        "province": "Eastern Cape",
        "population": 832229,
        "lat": -32.9795,
        "lng": 27.8671,
        "intersection_count": 6,
        "zones": ["North", "South"],
        "base_intake": 306.70,
    },
    "man": {
        "metro_id": "man",
        "name": "Mangaung (Bloemfontein)",
        "province": "Free State",
        "population": 783294,
        "lat": -29.1217,
        "lng": 26.2137,
        "intersection_count": 6,
        "zones": ["North", "South"],
        "base_intake": 288.60,
    },
}


class NetworkTopology:
    """Represents a water distribution network topology"""

    def __init__(self, metro_id: str):
        self.metro_id = metro_id
        self.config = METRO_CONFIGS[metro_id]
        self.intersections = []
        self.connections = []
        self.zones = []

    def generate(self):
        """Generate complete network topology"""
        self._generate_intersections()
        self._generate_connections()
        self._generate_zones()
        return {
            "intersections": self.intersections,
            "connections": self.connections,
            "zones": self.zones,
        }

    def _generate_intersections(self):
        """Generate intersection nodes"""
        count = self.config["intersection_count"]
        base_lat = self.config["lat"]
        base_lng = self.config["lng"]

        # Source node (treatment plant)
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

        # Primary distribution nodes (3-4)
        primary_count = max(3, count // 3)
        for i in range(primary_count):
            self.intersections.append({
                "intersection_id": f"{self.metro_id}-primary-{str(i+1).zfill(3)}",
                "name": f"{self.config['name']} Primary Junction {i+1}",
                "type": "PRIMARY",
                "lat": base_lat + random.uniform(-0.05, 0.05),
                "lng": base_lng + random.uniform(-0.05, 0.05),
                "flow_rate_ml": self.config["base_intake"] / primary_count * random.uniform(0.8, 1.2),
                "pressure_kpa": random.uniform(300, 400),
                "status": "NORMAL",
            })

        # Secondary distribution nodes
        secondary_count = count - primary_count - 1
        for i in range(secondary_count):
            self.intersections.append({
                "intersection_id": f"{self.metro_id}-secondary-{str(i+1).zfill(3)}",
                "name": f"{self.config['name']} Secondary Junction {i+1}",
                "type": "SECONDARY",
                "lat": base_lat + random.uniform(-0.1, 0.1),
                "lng": base_lng + random.uniform(-0.1, 0.1),
                "flow_rate_ml": self.config["base_intake"] / count * random.uniform(0.5, 1.5),
                "pressure_kpa": random.uniform(200, 350),
                "status": random.choice(["NORMAL", "NORMAL", "NORMAL", "WARNING"]),
            })

    def _generate_connections(self):
        """Generate connections between intersections (graph edges)"""
        if len(self.intersections) < 2:
            return

        # Source connects to all primary nodes
        source = self.intersections[0]
        primaries = [i for i in self.intersections if i["type"] == "PRIMARY"]

        for primary in primaries:
            self.connections.append({
                "from_id": source["intersection_id"],
                "to_id": primary["intersection_id"],
                "pipe_diameter_mm": random.choice([600, 800, 1000, 1200]),
                "pipe_length_km": random.uniform(2, 15),
                "pipe_material": random.choice(["Steel", "Concrete"]),
                "pipe_age_years": random.randint(10, 40),
                "max_flow_ml": random.uniform(500, 1000),
            })

        # Primary nodes connect to secondary nodes
        secondaries = [i for i in self.intersections if i["type"] == "SECONDARY"]
        for i, secondary in enumerate(secondaries):
            # Connect to a random primary
            primary = random.choice(primaries)
            self.connections.append({
                "from_id": primary["intersection_id"],
                "to_id": secondary["intersection_id"],
                "pipe_diameter_mm": random.choice([400, 500, 600]),
                "pipe_length_km": random.uniform(1, 8),
                "pipe_material": random.choice(["Steel", "PVC", "Concrete"]),
                "pipe_age_years": random.randint(5, 35),
                "max_flow_ml": random.uniform(200, 500),
            })

    def _generate_zones(self):
        """Generate zones for Phase 2"""
        zone_names = self.config["zones"]
        total_pop = self.config["population"]
        total_intake = self.config["base_intake"]

        for i, zone_name in enumerate(zone_names):
            # Distribute population and water roughly equally with variation
            pop_share = (total_pop / len(zone_names)) * random.uniform(0.7, 1.3)
            intake_share = (total_intake / len(zone_names)) * random.uniform(0.7, 1.3)

            # Simulate wastage (15-35%)
            wastage_pct = random.uniform(15, 35)
            usage_share = intake_share * (1 - wastage_pct / 100)
            wastage_share = intake_share - usage_share

            # Random leak probability
            has_leaks = random.random() < 0.3  # 30% chance of active leaks
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
                "bounds_geojson": self._generate_zone_bounds(i, len(zone_names)),
            })

    def _generate_zone_bounds(self, index: int, total_zones: int) -> Dict:
        """Generate simple rectangular bounds for a zone"""
        base_lat = self.config["lat"]
        base_lng = self.config["lng"]

        # Divide metro into rough grid
        offset_lat = (index // 2) * 0.1 - 0.1
        offset_lng = (index % 2) * 0.1 - 0.05

        # Create simple rectangle (GeoJSON Polygon)
        return {
            "type": "Polygon",
            "coordinates": [[
                [base_lng + offset_lng, base_lat + offset_lat],
                [base_lng + offset_lng + 0.1, base_lat + offset_lat],
                [base_lng + offset_lng + 0.1, base_lat + offset_lat + 0.1],
                [base_lng + offset_lng, base_lat + offset_lat + 0.1],
                [base_lng + offset_lng, base_lat + offset_lat],
            ]]
        }


def generate_leak_detections(metro_id: str, connections: List[Dict]) -> List[Dict]:
    """Generate simulated leak detections"""
    leaks = []

    # 20% chance of leak per connection
    for connection in connections:
        if random.random() < 0.2:
            loss_ml = random.uniform(10, 150)
            loss_pct = random.uniform(5, 25)

            severity = "LOW"
            if loss_pct > 20:
                severity = "CRITICAL"
            elif loss_pct > 15:
                severity = "HIGH"
            elif loss_pct > 10:
                severity = "MEDIUM"

            leaks.append({
                "leak_id": f"LEAK-{metro_id.upper()}-{random.randint(1000, 9999)}",
                "segment_start_id": connection["from_id"],
                "segment_end_id": connection["to_id"],
                "severity": severity,
                "estimated_loss_ml": round(loss_ml, 2),
                "estimated_loss_percentage": round(loss_pct, 1),
                "ai_confidence": random.uniform(70, 95),
                "probable_cause": random.choice([
                    "Underground pipe burst",
                    "Pipe corrosion leak",
                    "Joint failure",
                    "Pressure-induced crack",
                    "Illegal connection suspected",
                ]),
                "urgency_level": "URGENT" if severity in ["HIGH", "CRITICAL"] else "PLANNED",
                "status": "DETECTED",
                "affected_areas": [f"Area {random.randint(1, 10)}"],
            })

    return leaks


def generate_all_metros() -> Dict:
    """Generate network topology for all 8 metros"""
    all_data = {}

    for metro_id in METRO_CONFIGS.keys():
        topology = NetworkTopology(metro_id)
        network = topology.generate()

        # Generate leak detections
        leaks = generate_leak_detections(metro_id, network["connections"])
        network["leaks"] = leaks

        all_data[metro_id] = network

    return all_data


def generate_sensor_readings(intersection_id: str, base_flow: float, hours: int = 24) -> List[Dict]:
    """Generate time-series sensor readings for an intersection"""
    readings = []
    now = datetime.now()

    for i in range(hours):
        timestamp = now - timedelta(hours=hours - i)

        # Add random variation and daily pattern
        time_factor = 1.0 + 0.3 * abs((i % 24) - 12) / 12  # Higher during midday
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
