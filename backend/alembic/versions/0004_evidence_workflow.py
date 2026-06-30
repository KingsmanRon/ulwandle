"""add versioned W10 and W11 evidence workflow

Revision ID: 0004_evidence_workflow
Revises: 0003_unmonitored_district_status
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_evidence_workflow"
down_revision = "0003_unmonitored_district_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evidence_submissions",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "metro_id", sa.String(64),
            sa.ForeignKey("metros.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("reporting_period_start", sa.Date, nullable=False),
        sa.Column("reporting_period_end", sa.Date, nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("source_name", sa.String(200), nullable=False),
        sa.Column("source_url", sa.String(500)),
        sa.Column("source_filename", sa.String(255), nullable=False),
        sa.Column("source_sha256", sa.String(64), nullable=False),
        sa.Column("source_content", sa.LargeBinary, nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_by_id", sa.Integer,
            sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column(
            "approved_by_id", sa.Integer,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint(
            "metro_id", "reporting_period_start", "reporting_period_end", "version",
            name="uq_evidence_submission_period_version",
        ),
        sa.CheckConstraint(
            "reporting_period_start <= reporting_period_end",
            name="ck_evidence_submission_period",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'approved', 'superseded')",
            name="ck_evidence_submission_status",
        ),
    )
    op.create_index(
        "ix_evidence_submission_metro_status_period",
        "evidence_submissions",
        ["metro_id", "status", "reporting_period_end"],
    )
    op.create_index(
        "ix_evidence_submissions_created_by_id",
        "evidence_submissions", ["created_by_id"],
    )
    op.create_index(
        "ix_evidence_submissions_approved_by_id",
        "evidence_submissions", ["approved_by_id"],
    )

    op.create_table(
        "evidence_monthly_records",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "submission_id", sa.BigInteger,
            sa.ForeignKey("evidence_submissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("system_input_volume_kl", sa.Numeric(18, 3), nullable=False),
        sa.Column(
            "billed_authorised_consumption_kl", sa.Numeric(18, 3), nullable=False,
        ),
        sa.Column("total_connections", sa.Integer, nullable=False),
        sa.Column("connections_billed_actual_readings", sa.Integer, nullable=False),
        sa.Column("source_row_number", sa.Integer, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.UniqueConstraint(
            "submission_id", "period_start",
            name="uq_evidence_monthly_submission_period",
        ),
        sa.CheckConstraint(
            "system_input_volume_kl > 0",
            name="ck_evidence_monthly_positive_input",
        ),
        sa.CheckConstraint(
            "billed_authorised_consumption_kl >= 0 "
            "AND billed_authorised_consumption_kl <= system_input_volume_kl",
            name="ck_evidence_monthly_billed_range",
        ),
        sa.CheckConstraint(
            "total_connections > 0",
            name="ck_evidence_monthly_positive_connections",
        ),
        sa.CheckConstraint(
            "connections_billed_actual_readings >= 0 "
            "AND connections_billed_actual_readings <= total_connections",
            name="ck_evidence_monthly_metered_range",
        ),
    )
    op.create_table(
        "evidence_calculations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "submission_id", sa.BigInteger,
            sa.ForeignKey("evidence_submissions.id", ondelete="CASCADE"),
            nullable=False, unique=True,
        ),
        sa.Column("methodology_version", sa.String(40), nullable=False),
        sa.Column("input_sha256", sa.String(64), nullable=False),
        sa.Column("system_input_volume_kl", sa.Numeric(20, 3), nullable=False),
        sa.Column(
            "billed_authorised_consumption_kl", sa.Numeric(20, 3), nullable=False,
        ),
        sa.Column("connection_months", sa.BigInteger, nullable=False),
        sa.Column(
            "actual_meter_reading_connection_months", sa.BigInteger, nullable=False,
        ),
        sa.Column("w10_nrw_pct", sa.Numeric(7, 3), nullable=False),
        sa.Column("w11_metering_pct", sa.Numeric(7, 3), nullable=False),
        sa.Column(
            "calculated_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.CheckConstraint(
            "w10_nrw_pct >= 0 AND w10_nrw_pct <= 100",
            name="ck_evidence_calculation_w10_range",
        ),
        sa.CheckConstraint(
            "w11_metering_pct >= 0 AND w11_metering_pct <= 100",
            name="ck_evidence_calculation_w11_range",
        ),
    )


def downgrade() -> None:
    op.drop_table("evidence_calculations")
    op.drop_table("evidence_monthly_records")
    op.drop_index(
        "ix_evidence_submissions_approved_by_id",
        table_name="evidence_submissions",
    )
    op.drop_index(
        "ix_evidence_submissions_created_by_id",
        table_name="evidence_submissions",
    )
    op.drop_index(
        "ix_evidence_submission_metro_status_period",
        table_name="evidence_submissions",
    )
    op.drop_table("evidence_submissions")
