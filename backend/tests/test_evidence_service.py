"""Deterministic W10 and W11 evidence calculations."""

import csv
import io
import json
import zipfile
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.evidence_service import (
    EvidenceValidationError,
    build_evidence_zip,
    calculate_evidence,
    parse_evidence_csv,
    reporting_period,
)


def _csv_bytes(
    *,
    billed: str = "75000.000",
    actual: str = "98000",
    skip_month: int | None = None,
) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow([
        "period",
        "system_input_volume_kl",
        "billed_authorised_consumption_kl",
        "total_connections",
        "connections_billed_actual_readings",
    ])
    for month in range(1, 13):
        period_month = month + 1 if skip_month == month else month
        writer.writerow([
            f"2025-{period_month:02d}",
            "100000.000",
            billed,
            "100000",
            actual,
        ])
    return output.getvalue().encode()


def test_calculation_is_deterministic_and_uses_weighted_rolling_year():
    rows = parse_evidence_csv(_csv_bytes())

    first = calculate_evidence(rows)
    second = calculate_evidence(list(reversed(rows)))

    assert first == second
    assert first.system_input_volume_kl == Decimal("1200000.000")
    assert first.billed_authorised_consumption_kl == Decimal("900000.000")
    assert first.connection_months == 1_200_000
    assert first.actual_meter_reading_connection_months == 1_176_000
    assert first.w10_nrw_pct == Decimal("25.000")
    assert first.w11_metering_pct == Decimal("98.000")
    assert len(first.input_sha256) == 64


def test_reporting_period_covers_full_first_and_last_month():
    rows = parse_evidence_csv(_csv_bytes())

    start, end = reporting_period(rows)

    assert start.isoformat() == "2025-01-01"
    assert end.isoformat() == "2025-12-31"


def test_import_rejects_month_gaps():
    with pytest.raises(EvidenceValidationError, match="duplicate period|without gaps"):
        parse_evidence_csv(_csv_bytes(skip_month=6))


def test_import_rejects_billed_consumption_above_system_input():
    with pytest.raises(EvidenceValidationError, match="billed consumption"):
        parse_evidence_csv(_csv_bytes(billed="100001"))


def test_export_contains_manifest_and_normalised_records():
    rows = parse_evidence_csv(_csv_bytes())
    result = calculate_evidence(rows)
    records = [
        SimpleNamespace(
            period_start=row.period_start,
            system_input_volume_kl=row.system_input_volume_kl,
            billed_authorised_consumption_kl=row.billed_authorised_consumption_kl,
            total_connections=row.total_connections,
            connections_billed_actual_readings=(
                row.connections_billed_actual_readings
            ),
        )
        for row in rows
    ]
    submission = SimpleNamespace(
        id=42,
        metro_id="johannesburg",
        reporting_period_start=rows[0].period_start,
        reporting_period_end=reporting_period(rows)[1],
        version=2,
        status="approved",
        source_name="Approved water balance",
        source_url="https://example.test/source",
        source_filename="water-balance.csv",
        source_sha256="a" * 64,
        source_content=_csv_bytes(),
        created_by_id=7,
        approved_by_id=8,
        created_at=datetime(2026, 6, 30, tzinfo=timezone.utc),
        approved_at=datetime(2026, 6, 30, 1, tzinfo=timezone.utc),
        records=records,
    )

    with zipfile.ZipFile(io.BytesIO(build_evidence_zip(submission, result))) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        assert set(archive.namelist()) == {
            "manifest.json", "source/water-balance.csv",
            "monthly_records.csv", "README.txt",
        }
        assert archive.read("source/water-balance.csv") == _csv_bytes()

    assert manifest["submission_id"] == 42
    assert manifest["calculation"]["w10_nrw_pct"] == "25.000"
    assert manifest["calculation"]["w11_metering_pct"] == "98.000"
    assert manifest["source"]["sha256"] == "a" * 64
