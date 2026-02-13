"""
Database Models for Ulwandle Tech
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.db.database import Base


class DistrictStatus(str, enum.Enum):
    """District water quality status"""
    GREEN = "green"  # Safe, drinkable water
    YELLOW = "yellow"  # Monitoring required
    RED = "red"  # Undrinkable, emergency


class ValveStatus(str, enum.Enum):
    """Valve operational status"""
    OPEN = "open"
    CLOSED = "closed"
    PARTIAL = "partial"
    FAULT = "fault"


class AlertLevel(str, enum.Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class District(Base):
    """Municipal district/zone"""
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    municipality = Column(String(100), nullable=False)
    province = Column(String(50), nullable=False)
    population = Column(Integer)
    area_km2 = Column(Float)
    status = Column(SQLEnum(DistrictStatus), default=DistrictStatus.GREEN)

    # Coordinates for mapping
    latitude = Column(Float)
    longitude = Column(Float)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    sensors = relationship("Sensor", back_populates="district")
    valves = relationship("Valve", back_populates="district")
    water_quality_readings = relationship("WaterQualityReading", back_populates="district")
    alerts = relationship("Alert", back_populates="district")


class Sensor(Base):
    """Water monitoring sensor"""
    __tablename__ = "sensors"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String(50), unique=True, nullable=False)
    sensor_type = Column(String(50), nullable=False)  # flow, pressure, ph, tds, etc.
    district_id = Column(Integer, ForeignKey("districts.id"))

    # Location
    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)

    # Status
    is_active = Column(Boolean, default=True)
    last_reading_at = Column(DateTime(timezone=True))

    # Metadata
    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    calibrated_at = Column(DateTime(timezone=True))

    # Relationships
    district = relationship("District", back_populates="sensors")
    flow_readings = relationship("FlowReading", back_populates="sensor")
    pressure_readings = relationship("PressureReading", back_populates="sensor")


class FlowReading(Base):
    """Water flow readings from sensors"""
    __tablename__ = "flow_readings"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"))

    # Flow data
    flow_rate = Column(Float, nullable=False)  # liters per minute
    total_volume = Column(Float)  # total liters

    # Timestamp
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Anomaly detection
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float)

    # Relationships
    sensor = relationship("Sensor", back_populates="flow_readings")


class PressureReading(Base):
    """Water pressure readings"""
    __tablename__ = "pressure_readings"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"))

    # Pressure data
    pressure = Column(Float, nullable=False)  # kPa or bar

    # Timestamp
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    sensor = relationship("Sensor", back_populates="pressure_readings")


class WaterQualityReading(Base):
    """Water quality measurements (pH, TDS, etc.)"""
    __tablename__ = "water_quality_readings"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))

    # Water quality parameters
    ph = Column(Float)
    tds = Column(Float)  # Total Dissolved Solids (mg/L)
    turbidity = Column(Float)  # NTU
    temperature = Column(Float)  # Celsius
    chlorine = Column(Float)  # mg/L

    # Compliance
    meets_sans_241 = Column(Boolean, default=True)

    # Timestamp
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    district = relationship("District", back_populates="water_quality_readings")


class Valve(Base):
    """Remote-controlled valves (Kill Switch)"""
    __tablename__ = "valves"

    id = Column(Integer, primary_key=True, index=True)
    valve_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"))

    # Location
    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)

    # Status
    status = Column(SQLEnum(ValveStatus), default=ValveStatus.OPEN)
    is_remote_controlled = Column(Boolean, default=True)
    last_operated_at = Column(DateTime(timezone=True))

    # Control
    can_auto_close = Column(Boolean, default=False)
    requires_confirmation = Column(Boolean, default=True)

    # Metadata
    installed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    district = relationship("District", back_populates="valves")
    operations = relationship("ValveOperation", back_populates="valve")


class ValveOperation(Base):
    """Valve operation history (audit trail)"""
    __tablename__ = "valve_operations"

    id = Column(Integer, primary_key=True, index=True)
    valve_id = Column(Integer, ForeignKey("valves.id"))

    # Operation details
    action = Column(String(20), nullable=False)  # open, close, partial
    previous_status = Column(String(20))
    new_status = Column(String(20))

    # Authorization
    operator_id = Column(String(50))
    operator_name = Column(String(100))
    reason = Column(Text)
    is_manual = Column(Boolean, default=True)

    # Timestamp
    executed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    valve = relationship("Valve", back_populates="operations")


class Alert(Base):
    """System alerts and notifications"""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)

    # Alert details
    alert_type = Column(String(50), nullable=False)  # leak, quality, valve, prediction
    level = Column(SQLEnum(AlertLevel), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    # Additional data
    alert_metadata = Column(JSON)

    # Status
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(100))

    # Notifications
    notifications_sent = Column(Boolean, default=False)
    notification_count = Column(Integer, default=0)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    district = relationship("District", back_populates="alerts")


class Prediction(Base):
    """AI/ML predictions from Claude"""
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)

    # Prediction details
    prediction_type = Column(String(50), nullable=False)  # consumption, leak, demand
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)

    # Prediction data
    predicted_value = Column(Float)
    confidence_score = Column(Float)
    prediction_horizon = Column(String(20))  # 1h, 24h, 7d, 30d

    # Input data summary
    data_points_used = Column(Integer)
    features_analyzed = Column(JSON)

    # Results
    prediction_result = Column(JSON)
    claude_analysis = Column(Text)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    valid_until = Column(DateTime(timezone=True))

    # Validation
    actual_value = Column(Float)
    accuracy = Column(Float)


class LeakDetection(Base):
    """Detected water leaks"""
    __tablename__ = "leak_detections"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))

    # Leak details
    location_description = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)

    # Severity
    estimated_loss_lpm = Column(Float)  # liters per minute
    estimated_loss_total = Column(Float)  # total liters lost
    confidence_score = Column(Float)

    # Detection
    detection_method = Column(String(50))  # ai, sensor, manual
    detected_at = Column(DateTime(timezone=True), server_default=func.now())

    # Status
    is_confirmed = Column(Boolean, default=False)
    is_repaired = Column(Boolean, default=False)
    repaired_at = Column(DateTime(timezone=True))

    # Notes
    notes = Column(Text)


class WaterStressLevel(str, enum.Enum):
    """Water stress levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IntersectionType(str, enum.Enum):
    """Type of water intersection"""
    SOURCE = "SOURCE"  # Treatment plant
    PRIMARY = "PRIMARY"  # Main distribution
    SECONDARY = "SECONDARY"  # Regional distribution
    TERTIARY = "TERTIARY"  # Local distribution


class LeakSeverity(str, enum.Enum):
    """Leak severity levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class LeakStatus(str, enum.Enum):
    """Leak investigation status"""
    DETECTED = "DETECTED"
    INVESTIGATING = "INVESTIGATING"
    REPAIRING = "REPAIRING"
    RESOLVED = "RESOLVED"


class Metro(Base):
    """South African Metropolitan Municipality"""
    __tablename__ = "metros"

    id = Column(Integer, primary_key=True, index=True)
    metro_id = Column(String(10), unique=True, nullable=False)  # jhb, cpt, etc.
    name = Column(String(100), unique=True, nullable=False)
    province = Column(String(50), nullable=False)
    population = Column(Integer, nullable=False)

    # Coordinates (center point)
    latitude = Column(Float)
    longitude = Column(Float)

    # Water metrics
    daily_intake_ml = Column(Float)  # Megalitres per day
    daily_usage_ml = Column(Float)
    daily_wastage_ml = Column(Float)
    wastage_percentage = Column(Float)
    per_capita_usage = Column(Float)  # Liters per person per day
    stress_level = Column(SQLEnum(WaterStressLevel), default=WaterStressLevel.MEDIUM)

    # Blockchain
    blockchain_hash = Column(String(64))  # SHA-256 hash

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    intersections = relationship("WaterIntersection", back_populates="metro")
    zones = relationship("MetroZone", back_populates="metro")
    network_leaks = relationship("NetworkLeakDetection", back_populates="metro")


class MetroZone(Base):
    """Zones within a metro (for Phase 2 problem area highlighting)"""
    __tablename__ = "metro_zones"

    id = Column(Integer, primary_key=True, index=True)
    metro_id = Column(Integer, ForeignKey("metros.id"))
    zone_id = Column(String(20), unique=True, nullable=False)  # jhb-north, cpt-south
    name = Column(String(100), nullable=False)  # "Sandton North", "Cape Town Central"

    # Geographic bounds (simplified polygon)
    bounds_geojson = Column(JSON)  # GeoJSON polygon

    # Water metrics for this zone
    daily_intake_ml = Column(Float)
    daily_usage_ml = Column(Float)
    daily_wastage_ml = Column(Float)
    wastage_percentage = Column(Float)
    population = Column(Integer)

    # Problem indicators
    has_active_leaks = Column(Boolean, default=False)
    leak_count = Column(Integer, default=0)
    priority_score = Column(Float, default=0.0)  # 0-100 (higher = more urgent)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    metro = relationship("Metro", back_populates="zones")


class WaterIntersection(Base):
    """Water network intersection/node (Phase 3)"""
    __tablename__ = "water_intersections"

    id = Column(Integer, primary_key=True, index=True)
    intersection_id = Column(String(50), unique=True, nullable=False)
    metro_id = Column(Integer, ForeignKey("metros.id"))
    name = Column(String(200), nullable=False)

    # Type and location
    intersection_type = Column(SQLEnum(IntersectionType), nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)

    # Current sensor readings
    current_flow_rate_ml = Column(Float)  # Megalitres per day
    current_pressure_kpa = Column(Float)  # Kilopascals
    last_reading_at = Column(DateTime(timezone=True))

    # Calculated metrics
    expected_flow_ml = Column(Float)  # Based on downstream consumption
    actual_flow_ml = Column(Float)  # From sensor
    loss_ml = Column(Float)  # expected - actual
    loss_percentage = Column(Float)

    # Status
    status = Column(String(20), default='NORMAL')  # NORMAL, WARNING, CRITICAL, OFFLINE
    is_active = Column(Boolean, default=True)
    last_maintenance = Column(DateTime(timezone=True))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    metro = relationship("Metro", back_populates="intersections")
    upstream_connections = relationship(
        "IntersectionConnection",
        foreign_keys="IntersectionConnection.to_intersection_id",
        back_populates="to_intersection"
    )
    downstream_connections = relationship(
        "IntersectionConnection",
        foreign_keys="IntersectionConnection.from_intersection_id",
        back_populates="from_intersection"
    )
    readings = relationship("IntersectionReading", back_populates="intersection")


class IntersectionConnection(Base):
    """Connection between two intersections (graph edge)"""
    __tablename__ = "intersection_connections"

    id = Column(Integer, primary_key=True, index=True)
    from_intersection_id = Column(Integer, ForeignKey("water_intersections.id"))
    to_intersection_id = Column(Integer, ForeignKey("water_intersections.id"))

    # Pipe details
    pipe_diameter_mm = Column(Integer)
    pipe_length_km = Column(Float)
    pipe_material = Column(String(50))  # PVC, Steel, Concrete
    pipe_age_years = Column(Integer)

    # Capacity
    max_flow_rate_ml = Column(Float)  # Maximum flow capacity

    # Status
    is_active = Column(Boolean, default=True)

    # Relationships
    from_intersection = relationship(
        "WaterIntersection",
        foreign_keys=[from_intersection_id],
        back_populates="downstream_connections"
    )
    to_intersection = relationship(
        "WaterIntersection",
        foreign_keys=[to_intersection_id],
        back_populates="upstream_connections"
    )


class IntersectionReading(Base):
    """Time-series sensor readings from intersections (TimescaleDB hypertable)"""
    __tablename__ = "intersection_readings"

    id = Column(Integer, primary_key=True, index=True)
    intersection_id = Column(Integer, ForeignKey("water_intersections.id"))

    # Sensor data
    flow_rate_ml = Column(Float, nullable=False)  # Megalitres per day
    pressure_kpa = Column(Float)  # Kilopascals
    temperature_c = Column(Float)  # Celsius

    # Sensor status
    sensor_status = Column(String(20), default='ONLINE')  # ONLINE, OFFLINE, ERROR

    # Timestamp
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    intersection = relationship("WaterIntersection", back_populates="readings")


class NetworkLeakDetection(Base):
    """Network-level leak detection between intersections"""
    __tablename__ = "network_leak_detections"

    id = Column(Integer, primary_key=True, index=True)
    leak_id = Column(String(50), unique=True, nullable=False)
    metro_id = Column(Integer, ForeignKey("metros.id"))

    # Segment information
    segment_start_id = Column(Integer, ForeignKey("water_intersections.id"))
    segment_end_id = Column(Integer, ForeignKey("water_intersections.id"))

    # Detection details
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    severity = Column(SQLEnum(LeakSeverity), nullable=False)
    estimated_loss_ml_per_day = Column(Float)
    estimated_loss_percentage = Column(Float)

    # Geographic location (approximate)
    approximate_lat = Column(Float)
    approximate_lng = Column(Float)
    location_radius_km = Column(Float)  # Uncertainty radius
    affected_areas = Column(JSON)  # List of suburb names

    # Claude AI Analysis
    claude_analysis = Column(JSON)  # Full AI response
    ai_confidence = Column(Float)  # 0-100
    probable_cause = Column(Text)
    recommended_action = Column(Text)
    estimated_repair_cost = Column(Float)
    estimated_daily_loss_rand = Column(Float)
    urgency_level = Column(String(20))  # ROUTINE, PLANNED, URGENT, EMERGENCY

    # Status
    status = Column(SQLEnum(LeakStatus), default=LeakStatus.DETECTED)
    is_confirmed = Column(Boolean, default=False)
    assigned_to = Column(String(100))  # Team assigned to investigate/repair
    resolved_at = Column(DateTime(timezone=True))

    # Notes
    investigation_notes = Column(Text)
    repair_notes = Column(Text)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    metro = relationship("Metro", back_populates="network_leaks")


class Employee(Base):
    """Field employees for notifications"""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(50))  # technician, engineer, supervisor

    # Contact
    phone = Column(String(20))
    email = Column(String(100))

    # Location
    assigned_district_id = Column(Integer, ForeignKey("districts.id"))

    # Status
    is_active = Column(Boolean, default=True)
    is_on_duty = Column(Boolean, default=False)
    last_location_lat = Column(Float)
    last_location_lon = Column(Float)
    last_seen_at = Column(DateTime(timezone=True))

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
