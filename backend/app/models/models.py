"""
Database models for Ulwandle Tech.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, Enum as SQLEnum, JSON, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


def _pg_enum(enum_cls):
    """SQLEnum that maps to the enum *values* (lowercase, e.g. 'admin') instead
    of the default Python *names* ('ADMIN'). The Alembic migration created the
    PG enum types from the lowercase values, so without values_callable
    SQLAlchemy raises LookupError reading back any existing row."""
    return SQLEnum(enum_cls, values_callable=lambda cls: [m.value for m in cls])


# ---------- Enums ----------

class DistrictStatus(str, enum.Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class ValveStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    PARTIAL = "partial"
    FAULT = "fault"


class AlertLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    OPERATOR = "operator"
    VIEWER = "viewer"


class ProposalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    EXECUTED = "executed"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ReasonCode(str, enum.Enum):
    """Bounded, sanitized reason codes — never feed free text to safety-critical paths."""
    LEAK_DETECTED = "leak_detected"
    QUALITY_BREACH = "quality_breach"
    CONTAMINATION = "contamination"
    INFRASTRUCTURE_FAULT = "infrastructure_fault"
    SCHEDULED_MAINTENANCE = "scheduled_maintenance"
    EMERGENCY_OTHER = "emergency_other"


# ---------- Auth ----------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(_pg_enum(UserRole), nullable=False, default=UserRole.VIEWER)

    # Base64-encoded Ed25519 public key (32 raw bytes -> 44 char base64)
    ed25519_public_key = Column(String(64), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True))


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    jti = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    user_agent = Column(String(255))
    ip_hash = Column(String(64))


class UsedNonce(Base):
    """Replay protection for signed valve operations."""
    __tablename__ = "used_nonces"

    nonce = Column(String(128), primary_key=True)
    used_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)


class AuditLog(Base):
    """Append-only audit trail. Never updated; rotated by retention policy."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"))
    actor_email = Column(String(255))
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50))
    resource_id = Column(String(100))
    payload = Column(JSON)
    ip_hash = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ---------- Domain ----------

class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    municipality = Column(String(100), nullable=False)
    province = Column(String(50), nullable=False)
    population = Column(Integer)
    area_km2 = Column(Float)
    status = Column(_pg_enum(DistrictStatus), default=DistrictStatus.GREEN, nullable=False)

    latitude = Column(Float)
    longitude = Column(Float)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sensors = relationship("Sensor", back_populates="district")
    valves = relationship("Valve", back_populates="district")
    water_quality_readings = relationship("WaterQualityReading", back_populates="district")
    alerts = relationship("Alert", back_populates="district")


class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String(50), unique=True, nullable=False)
    sensor_type = Column(String(50), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"))

    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)

    # HMAC-SHA256 ingest secret per sensor (random, rotatable)
    ingest_secret_hash = Column(String(128))

    is_active = Column(Boolean, default=True)
    last_reading_at = Column(DateTime(timezone=True))

    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    calibrated_at = Column(DateTime(timezone=True))

    district = relationship("District", back_populates="sensors")
    flow_readings = relationship("FlowReading", back_populates="sensor")
    pressure_readings = relationship("PressureReading", back_populates="sensor")


class FlowReading(Base):
    __tablename__ = "flow_readings"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False)
    flow_rate = Column(Float, nullable=False)
    total_volume = Column(Float)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float)

    sensor = relationship("Sensor", back_populates="flow_readings")


Index("ix_flow_readings_sensor_time", FlowReading.sensor_id, FlowReading.recorded_at)


class PressureReading(Base):
    __tablename__ = "pressure_readings"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False)
    pressure = Column(Float, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    sensor = relationship("Sensor", back_populates="pressure_readings")


Index("ix_pressure_readings_sensor_time", PressureReading.sensor_id, PressureReading.recorded_at)


class WaterQualityReading(Base):
    __tablename__ = "water_quality_readings"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))

    ph = Column(Float)
    tds = Column(Float)
    turbidity = Column(Float)
    temperature = Column(Float)
    chlorine = Column(Float)

    meets_sans_241 = Column(Boolean, default=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    district = relationship("District", back_populates="water_quality_readings")


class Valve(Base):
    __tablename__ = "valves"

    id = Column(Integer, primary_key=True, index=True)
    valve_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"))

    location_name = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)

    status = Column(_pg_enum(ValveStatus), default=ValveStatus.OPEN, nullable=False)
    is_remote_controlled = Column(Boolean, default=True, nullable=False)
    last_operated_at = Column(DateTime(timezone=True))

    can_auto_close = Column(Boolean, default=False)
    requires_confirmation = Column(Boolean, default=True)

    installed_at = Column(DateTime(timezone=True), server_default=func.now())

    district = relationship("District", back_populates="valves")
    operations = relationship("ValveOperation", back_populates="valve")


class ValveOperationProposal(Base):
    """Two-of-N approval workflow. Each step carries an Ed25519 signature."""
    __tablename__ = "valve_operation_proposals"

    id = Column(Integer, primary_key=True, index=True)
    valve_id = Column(Integer, ForeignKey("valves.id"), nullable=False)
    action = Column(String(20), nullable=False)
    reason_code = Column(_pg_enum(ReasonCode), nullable=False)
    reason_notes = Column(Text)

    nonce = Column(String(128), unique=True, nullable=False, index=True)
    issued_at = Column(DateTime(timezone=True), nullable=False)

    proposer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    proposer_signature = Column(Text, nullable=False)

    approver_id = Column(Integer, ForeignKey("users.id"), index=True)
    approver_signature = Column(Text)

    status = Column(_pg_enum(ProposalStatus), nullable=False, default=ProposalStatus.PENDING, index=True)
    ai_advisory = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    decided_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    executed_at = Column(DateTime(timezone=True))

    valve = relationship("Valve")


class ValveOperation(Base):
    """Append-only execution record. Mirrors the executed proposal."""
    __tablename__ = "valve_operations"

    id = Column(Integer, primary_key=True, index=True)
    valve_id = Column(Integer, ForeignKey("valves.id"), nullable=False)
    proposal_id = Column(Integer, ForeignKey("valve_operation_proposals.id"))

    action = Column(String(20), nullable=False)
    previous_status = Column(String(20))
    new_status = Column(String(20))

    proposer_id = Column(Integer, ForeignKey("users.id"))
    approver_id = Column(Integer, ForeignKey("users.id"))
    proposer_signature = Column(Text, nullable=False)
    approver_signature = Column(Text)
    reason_code = Column(_pg_enum(ReasonCode), nullable=False)
    reason_notes = Column(Text)

    executed_at = Column(DateTime(timezone=True), server_default=func.now())

    valve = relationship("Valve", back_populates="operations")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)

    alert_type = Column(String(50), nullable=False)
    level = Column(_pg_enum(AlertLevel), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    alert_metadata = Column(JSON)

    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(100))

    notifications_sent = Column(Boolean, default=False)
    notification_count = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    district = relationship("District", back_populates="alerts")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    prediction_type = Column(String(50), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)

    predicted_value = Column(Float)
    confidence_score = Column(Float)
    prediction_horizon = Column(String(20))

    data_points_used = Column(Integer)
    features_analyzed = Column(JSON)

    prediction_result = Column(JSON)
    claude_analysis = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    valid_until = Column(DateTime(timezone=True))

    actual_value = Column(Float)
    accuracy = Column(Float)


class LeakDetection(Base):
    __tablename__ = "leak_detections"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))

    location_description = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)

    estimated_loss_lpm = Column(Float)
    estimated_loss_total = Column(Float)
    confidence_score = Column(Float)

    detection_method = Column(String(50))
    detected_at = Column(DateTime(timezone=True), server_default=func.now())

    is_confirmed = Column(Boolean, default=False)
    is_repaired = Column(Boolean, default=False)
    repaired_at = Column(DateTime(timezone=True))
    notes = Column(Text)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(50))

    phone = Column(String(20))
    email = Column(String(100))

    assigned_district_id = Column(Integer, ForeignKey("districts.id"))

    is_active = Column(Boolean, default=True)
    is_on_duty = Column(Boolean, default=False)
    last_location_lat = Column(Float)
    last_location_lon = Column(Float)
    last_seen_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
