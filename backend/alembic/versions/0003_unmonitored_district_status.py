"""add explicit unmonitored district status

Revision ID: 0003_unmonitored_district_status
Revises: 0002_real_metro_data
Create Date: 2026-06-30
"""

from alembic import op


revision = "0003_unmonitored_district_status"
down_revision = "0002_real_metro_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE districtstatus ADD VALUE IF NOT EXISTS 'unmonitored'")
    op.execute(
        "ALTER TABLE districts ALTER COLUMN status "
        "SET DEFAULT 'unmonitored'::districtstatus"
    )
    op.execute(
        "UPDATE districts AS district "
        "SET status = 'unmonitored'::districtstatus "
        "WHERE NOT EXISTS ("
        "SELECT 1 FROM water_quality_readings AS reading "
        "WHERE reading.district_id = district.id"
        ")"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE districts SET status = 'green'::districtstatus "
        "WHERE status = 'unmonitored'::districtstatus"
    )
    op.execute("ALTER TABLE districts ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE districtstatus RENAME TO districtstatus_with_unmonitored")
    op.execute("CREATE TYPE districtstatus AS ENUM ('green', 'yellow', 'red')")
    op.execute(
        "ALTER TABLE districts ALTER COLUMN status TYPE districtstatus "
        "USING status::text::districtstatus"
    )
    op.execute(
        "ALTER TABLE districts ALTER COLUMN status SET DEFAULT 'green'::districtstatus"
    )
    op.execute("DROP TYPE districtstatus_with_unmonitored")
