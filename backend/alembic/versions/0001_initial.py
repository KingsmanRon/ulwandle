"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    district_status = sa.Enum("green", "yellow", "red", name="districtstatus")
    valve_status = sa.Enum("open", "closed", "partial", "fault", name="valvestatus")
    alert_level = sa.Enum("info", "warning", "critical", "emergency", name="alertlevel")
    user_role = sa.Enum("admin", "supervisor", "operator", "viewer", name="userrole")
    proposal_status = sa.Enum("pending", "approved", "executed", "rejected", "expired",
                              name="proposalstatus")
    reason_code = sa.Enum(
        "leak_detected", "quality_breach", "contamination",
        "infrastructure_fault", "scheduled_maintenance", "emergency_other",
        name="reasoncode",
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="viewer"),
        sa.Column("ed25519_public_key", sa.String(64)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("failed_login_attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("jti", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"),
                  index=True, nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("user_agent", sa.String(255)),
        sa.Column("ip_hash", sa.String(64)),
    )
    op.create_table(
        "used_nonces",
        sa.Column("nonce", sa.String(128), primary_key=True),
        sa.Column("used_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("actor_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("actor_email", sa.String(255)),
        sa.Column("action", sa.String(100), nullable=False, index=True),
        sa.Column("resource_type", sa.String(50)),
        sa.Column("resource_id", sa.String(100)),
        sa.Column("payload", sa.JSON),
        sa.Column("ip_hash", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    op.create_table(
        "districts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("municipality", sa.String(100), nullable=False),
        sa.Column("province", sa.String(50), nullable=False),
        sa.Column("population", sa.Integer),
        sa.Column("area_km2", sa.Float),
        sa.Column("status", district_status, nullable=False, server_default="green"),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "sensors",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sensor_id", sa.String(50), unique=True, nullable=False),
        sa.Column("sensor_type", sa.String(50), nullable=False),
        sa.Column("district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("location_name", sa.String(200)),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("ingest_secret_hash", sa.String(128)),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("last_reading_at", sa.DateTime(timezone=True)),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("calibrated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "flow_readings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sensor_id", sa.Integer, sa.ForeignKey("sensors.id"), nullable=False),
        sa.Column("flow_rate", sa.Float, nullable=False),
        sa.Column("total_volume", sa.Float),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("is_anomaly", sa.Boolean, server_default=sa.false()),
        sa.Column("anomaly_score", sa.Float),
    )
    op.create_index("ix_flow_readings_sensor_time", "flow_readings",
                    ["sensor_id", "recorded_at"])

    op.create_table(
        "pressure_readings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sensor_id", sa.Integer, sa.ForeignKey("sensors.id"), nullable=False),
        sa.Column("pressure", sa.Float, nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    op.create_index("ix_pressure_readings_sensor_time", "pressure_readings",
                    ["sensor_id", "recorded_at"])

    op.create_table(
        "water_quality_readings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("ph", sa.Float),
        sa.Column("tds", sa.Float),
        sa.Column("turbidity", sa.Float),
        sa.Column("temperature", sa.Float),
        sa.Column("chlorine", sa.Float),
        sa.Column("meets_sans_241", sa.Boolean, server_default=sa.true()),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    op.create_table(
        "valves",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("valve_id", sa.String(50), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("location_name", sa.String(200)),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("status", valve_status, nullable=False, server_default="open"),
        sa.Column("is_remote_controlled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("last_operated_at", sa.DateTime(timezone=True)),
        sa.Column("can_auto_close", sa.Boolean, server_default=sa.false()),
        sa.Column("requires_confirmation", sa.Boolean, server_default=sa.true()),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "valve_operation_proposals",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("valve_id", sa.Integer, sa.ForeignKey("valves.id"), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("reason_code", reason_code, nullable=False),
        sa.Column("reason_notes", sa.Text),
        sa.Column("nonce", sa.String(128), nullable=False, unique=True, index=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("proposer_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("proposer_signature", sa.Text, nullable=False),
        sa.Column("approver_id", sa.Integer, sa.ForeignKey("users.id"), index=True),
        sa.Column("approver_signature", sa.Text),
        sa.Column("status", proposal_status, nullable=False, server_default="pending", index=True),
        sa.Column("ai_advisory", sa.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("executed_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "valve_operations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("valve_id", sa.Integer, sa.ForeignKey("valves.id"), nullable=False),
        sa.Column("proposal_id", sa.Integer, sa.ForeignKey("valve_operation_proposals.id")),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("previous_status", sa.String(20)),
        sa.Column("new_status", sa.String(20)),
        sa.Column("proposer_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("approver_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("proposer_signature", sa.Text, nullable=False),
        sa.Column("approver_signature", sa.Text),
        sa.Column("reason_code", reason_code, nullable=False),
        sa.Column("reason_notes", sa.Text),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("level", alert_level, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("alert_metadata", sa.JSON),
        sa.Column("is_resolved", sa.Boolean, server_default=sa.false()),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_by", sa.String(100)),
        sa.Column("notifications_sent", sa.Boolean, server_default=sa.false()),
        sa.Column("notification_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("prediction_type", sa.String(50), nullable=False),
        sa.Column("district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("predicted_value", sa.Float),
        sa.Column("confidence_score", sa.Float),
        sa.Column("prediction_horizon", sa.String(20)),
        sa.Column("data_points_used", sa.Integer),
        sa.Column("features_analyzed", sa.JSON),
        sa.Column("prediction_result", sa.JSON),
        sa.Column("claude_analysis", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("actual_value", sa.Float),
        sa.Column("accuracy", sa.Float),
    )

    op.create_table(
        "leak_detections",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("location_description", sa.String(200)),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("estimated_loss_lpm", sa.Float),
        sa.Column("estimated_loss_total", sa.Float),
        sa.Column("confidence_score", sa.Float),
        sa.Column("detection_method", sa.String(50)),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_confirmed", sa.Boolean, server_default=sa.false()),
        sa.Column("is_repaired", sa.Boolean, server_default=sa.false()),
        sa.Column("repaired_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text),
    )

    op.create_table(
        "employees",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("employee_id", sa.String(50), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(50)),
        sa.Column("phone", sa.String(20)),
        sa.Column("email", sa.String(100)),
        sa.Column("assigned_district_id", sa.Integer, sa.ForeignKey("districts.id")),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("is_on_duty", sa.Boolean, server_default=sa.false()),
        sa.Column("last_location_lat", sa.Float),
        sa.Column("last_location_lon", sa.Float),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for tbl in [
        "employees", "leak_detections", "predictions", "alerts", "valve_operations",
        "valve_operation_proposals", "valves", "water_quality_readings",
        "pressure_readings", "flow_readings", "sensors", "districts",
        "audit_logs", "used_nonces", "refresh_tokens", "users",
    ]:
        op.drop_table(tbl)
    for enum_name in ("reasoncode", "proposalstatus", "userrole", "alertlevel",
                      "valvestatus", "districtstatus"):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
