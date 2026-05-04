"""real metro data: metros, dams, time-series readings, data sources

Revision ID: 0002_real_metro_data
Revises: 0001_initial
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_real_metro_data"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "metros",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("code", sa.String(8), unique=True, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("province", sa.String(64), nullable=False),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),

        sa.Column("population", sa.Integer, nullable=False),
        sa.Column("population_as_of", sa.String(40), nullable=False),
        sa.Column("population_source", sa.String(120), nullable=False),
        sa.Column("population_source_url", sa.String(500)),

        sa.Column("nrw_pct", sa.Float, nullable=False),
        sa.Column("nrw_as_of", sa.String(40), nullable=False),
        sa.Column("nrw_source", sa.String(120), nullable=False),
        sa.Column("nrw_source_url", sa.String(500)),
        sa.Column("nrw_caveat", sa.String(255)),

        sa.Column("per_capita_lpcd", sa.Float),
        sa.Column("per_capita_as_of", sa.String(40)),
        sa.Column("per_capita_source", sa.String(120)),
        sa.Column("per_capita_source_url", sa.String(500)),
        sa.Column("per_capita_caveat", sa.String(255)),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.create_table(
        "dams",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("province", sa.String(64)),
        sa.Column("full_capacity_ml", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "metro_dams",
        sa.Column("metro_id", sa.String(64), sa.ForeignKey("metros.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("dam_id", sa.String(64), sa.ForeignKey("dams.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "dam_storage_readings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("dam_id", sa.String(64), sa.ForeignKey("dams.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("storage_pct", sa.Float, nullable=False),
        sa.Column("storage_ml", sa.Float),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        sa.Column("source_url", sa.String(500)),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("dam_id", "as_of", "source", name="uq_dam_reading_dam_asof_src"),
    )
    op.create_index("ix_dam_readings_dam_asof",
                    "dam_storage_readings", ["dam_id", "as_of"])

    op.create_table(
        "metro_consumption_readings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("metro_id", sa.String(64), sa.ForeignKey("metros.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("daily_ml", sa.Float, nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        sa.Column("source_url", sa.String(500)),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("metro_id", "as_of", "source",
                            name="uq_consumption_metro_asof_src"),
    )
    op.create_index("ix_consumption_metro_asof",
                    "metro_consumption_readings", ["metro_id", "as_of"])

    op.create_table(
        "data_sources",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("url", sa.String(500)),
        sa.Column("description", sa.Text),
        sa.Column("last_attempted_at", sa.DateTime(timezone=True)),
        sa.Column("last_success_at", sa.DateTime(timezone=True)),
        sa.Column("last_status", sa.String(40)),
        sa.Column("last_error", sa.Text),
        sa.Column("rows_last_run", sa.Integer),
    )


def downgrade() -> None:
    op.drop_table("data_sources")
    op.drop_index("ix_consumption_metro_asof", table_name="metro_consumption_readings")
    op.drop_table("metro_consumption_readings")
    op.drop_index("ix_dam_readings_dam_asof", table_name="dam_storage_readings")
    op.drop_table("dam_storage_readings")
    op.drop_table("metro_dams")
    op.drop_table("dams")
    op.drop_table("metros")
