"""Deterministic parsing, calculation, and export for W10 and W11 evidence."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import zipfile
from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Iterable


METHODOLOGY_VERSION = "MTSR_W10_W11_V1"
REQUIRED_COLUMNS = (
    "period",
    "system_input_volume_kl",
    "billed_authorised_consumption_kl",
    "total_connections",
    "connections_billed_actual_readings",
)
MAX_IMPORT_BYTES = 750_000
THREE_DECIMALS = Decimal("0.001")


class EvidenceValidationError(ValueError):
    pass


@dataclass(frozen=True)
class EvidenceInputRow:
    period_start: date
    system_input_volume_kl: Decimal
    billed_authorised_consumption_kl: Decimal
    total_connections: int
    connections_billed_actual_readings: int
    source_row_number: int


@dataclass(frozen=True)
class EvidenceResult:
    methodology_version: str
    input_sha256: str
    system_input_volume_kl: Decimal
    billed_authorised_consumption_kl: Decimal
    connection_months: int
    actual_meter_reading_connection_months: int
    w10_nrw_pct: Decimal
    w11_metering_pct: Decimal


def source_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _parse_period(value: str | None, row_number: int) -> date:
    cleaned = (value or "").strip()
    if len(cleaned) == 7:
        cleaned += "-01"
    try:
        parsed = date.fromisoformat(cleaned)
    except ValueError as exc:
        raise EvidenceValidationError(
            f"Row {row_number}: period must be YYYY-MM or YYYY-MM-DD"
        ) from exc
    if parsed.day != 1:
        raise EvidenceValidationError(
            f"Row {row_number}: period must be the first day of a month"
        )
    return parsed


def _parse_decimal(value: str, column: str, row_number: int) -> Decimal:
    try:
        parsed = Decimal(value.strip())
    except (InvalidOperation, AttributeError) as exc:
        raise EvidenceValidationError(
            f"Row {row_number}: {column} must be a decimal number"
        ) from exc
    if not parsed.is_finite():
        raise EvidenceValidationError(
            f"Row {row_number}: {column} must be finite"
        )
    return parsed.quantize(THREE_DECIMALS, rounding=ROUND_HALF_UP)


def _parse_integer(value: str, column: str, row_number: int) -> int:
    try:
        parsed = int(value.strip())
    except (ValueError, AttributeError) as exc:
        raise EvidenceValidationError(
            f"Row {row_number}: {column} must be a whole number"
        ) from exc
    return parsed


def _next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _validate_twelve_consecutive_months(rows: list[EvidenceInputRow]) -> None:
    if len(rows) != 12:
        raise EvidenceValidationError(
            "The evidence file must contain exactly 12 monthly rows"
        )
    for previous, current in zip(rows, rows[1:]):
        if current.period_start != _next_month(previous.period_start):
            raise EvidenceValidationError(
                "The evidence file must contain 12 consecutive months without gaps"
            )


def parse_evidence_csv(content: bytes) -> list[EvidenceInputRow]:
    if not content:
        raise EvidenceValidationError("The evidence file is empty")
    if len(content) > MAX_IMPORT_BYTES:
        raise EvidenceValidationError("The evidence file exceeds 750 kB")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EvidenceValidationError("The evidence file must use UTF-8 encoding") from exc

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise EvidenceValidationError("The evidence file has no header row")
    headers = tuple(header.strip() for header in reader.fieldnames)
    missing = [column for column in REQUIRED_COLUMNS if column not in headers]
    if missing:
        raise EvidenceValidationError(
            f"Missing required columns: {', '.join(missing)}"
        )

    rows: list[EvidenceInputRow] = []
    seen_periods: set[date] = set()
    for row_number, raw in enumerate(reader, start=2):
        if None in raw:
            raise EvidenceValidationError(
                f"Row {row_number}: contains more values than the header"
            )
        if not any((value or "").strip() for value in raw.values()):
            continue
        period = _parse_period(raw["period"], row_number)
        if period in seen_periods:
            raise EvidenceValidationError(
                f"Row {row_number}: duplicate period {period.isoformat()}"
            )
        seen_periods.add(period)
        system_input = _parse_decimal(
            raw["system_input_volume_kl"], "system_input_volume_kl", row_number,
        )
        billed = _parse_decimal(
            raw["billed_authorised_consumption_kl"],
            "billed_authorised_consumption_kl",
            row_number,
        )
        total_connections = _parse_integer(
            raw["total_connections"], "total_connections", row_number,
        )
        actual_connections = _parse_integer(
            raw["connections_billed_actual_readings"],
            "connections_billed_actual_readings",
            row_number,
        )
        if system_input <= 0:
            raise EvidenceValidationError(
                f"Row {row_number}: system_input_volume_kl must be greater than zero"
            )
        if billed < 0 or billed > system_input:
            raise EvidenceValidationError(
                f"Row {row_number}: billed consumption must be between zero and system input"
            )
        if total_connections <= 0:
            raise EvidenceValidationError(
                f"Row {row_number}: total_connections must be greater than zero"
            )
        if actual_connections < 0 or actual_connections > total_connections:
            raise EvidenceValidationError(
                f"Row {row_number}: actual meter readings must be between zero and total connections"
            )
        rows.append(EvidenceInputRow(
            period_start=period,
            system_input_volume_kl=system_input,
            billed_authorised_consumption_kl=billed,
            total_connections=total_connections,
            connections_billed_actual_readings=actual_connections,
            source_row_number=row_number,
        ))

    rows.sort(key=lambda row: row.period_start)
    _validate_twelve_consecutive_months(rows)
    return rows


def reporting_period(rows: list[EvidenceInputRow]) -> tuple[date, date]:
    ordered = sorted(rows, key=lambda row: row.period_start)
    _validate_twelve_consecutive_months(ordered)
    last = ordered[-1].period_start
    return ordered[0].period_start, date(
        last.year, last.month, monthrange(last.year, last.month)[1],
    )


def _canonical_rows(rows: Iterable[EvidenceInputRow]) -> bytes:
    payload = [
        {
            "period": row.period_start.isoformat(),
            "system_input_volume_kl": format(row.system_input_volume_kl, "f"),
            "billed_authorised_consumption_kl": format(
                row.billed_authorised_consumption_kl, "f",
            ),
            "total_connections": row.total_connections,
            "connections_billed_actual_readings": (
                row.connections_billed_actual_readings
            ),
        }
        for row in sorted(rows, key=lambda item: item.period_start)
    ]
    return json.dumps(
        payload, separators=(",", ":"), sort_keys=True,
    ).encode("utf-8")


def calculate_evidence(rows: list[EvidenceInputRow]) -> EvidenceResult:
    ordered = sorted(rows, key=lambda row: row.period_start)
    _validate_twelve_consecutive_months(ordered)
    system_input = sum(
        (row.system_input_volume_kl for row in ordered), start=Decimal("0"),
    )
    billed = sum(
        (row.billed_authorised_consumption_kl for row in ordered), start=Decimal("0"),
    )
    connection_months = sum(row.total_connections for row in ordered)
    actual_months = sum(
        row.connections_billed_actual_readings for row in ordered
    )
    if system_input <= 0 or connection_months <= 0:
        raise EvidenceValidationError("Evidence denominators must be greater than zero")

    w10 = ((system_input - billed) / system_input * 100).quantize(
        THREE_DECIMALS, rounding=ROUND_HALF_UP,
    )
    w11 = (Decimal(actual_months) / Decimal(connection_months) * 100).quantize(
        THREE_DECIMALS, rounding=ROUND_HALF_UP,
    )
    return EvidenceResult(
        methodology_version=METHODOLOGY_VERSION,
        input_sha256=hashlib.sha256(_canonical_rows(ordered)).hexdigest(),
        system_input_volume_kl=system_input.quantize(THREE_DECIMALS),
        billed_authorised_consumption_kl=billed.quantize(THREE_DECIMALS),
        connection_months=connection_months,
        actual_meter_reading_connection_months=actual_months,
        w10_nrw_pct=w10,
        w11_metering_pct=w11,
    )


def evidence_template_csv() -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(REQUIRED_COLUMNS)
    for month in range(1, 13):
        writer.writerow([
            f"2025-{month:02d}",
            "100000.000",
            "75000.000",
            "100000",
            "98000",
        ])
    return output.getvalue().encode("utf-8")


def build_evidence_zip(submission, result: EvidenceResult) -> bytes:
    manifest = {
        "submission_id": submission.id,
        "metro_id": submission.metro_id,
        "reporting_period_start": submission.reporting_period_start.isoformat(),
        "reporting_period_end": submission.reporting_period_end.isoformat(),
        "version": submission.version,
        "status": submission.status,
        "source": {
            "name": submission.source_name,
            "url": submission.source_url,
            "filename": submission.source_filename,
            "sha256": submission.source_sha256,
        },
        "approval": {
            "created_by_id": submission.created_by_id,
            "approved_by_id": submission.approved_by_id,
            "created_at": submission.created_at.isoformat(),
            "approved_at": submission.approved_at.isoformat(),
        },
        "calculation": {
            "methodology_version": result.methodology_version,
            "input_sha256": result.input_sha256,
            "system_input_volume_kl": format(result.system_input_volume_kl, "f"),
            "billed_authorised_consumption_kl": format(
                result.billed_authorised_consumption_kl, "f",
            ),
            "connection_months": result.connection_months,
            "actual_meter_reading_connection_months": (
                result.actual_meter_reading_connection_months
            ),
            "w10_nrw_pct": format(result.w10_nrw_pct, "f"),
            "w11_metering_pct": format(result.w11_metering_pct, "f"),
        },
    }

    records_output = io.StringIO(newline="")
    writer = csv.writer(records_output, lineterminator="\n")
    writer.writerow(REQUIRED_COLUMNS)
    for record in submission.records:
        writer.writerow([
            record.period_start.strftime("%Y-%m"),
            format(record.system_input_volume_kl, "f"),
            format(record.billed_authorised_consumption_kl, "f"),
            record.total_connections,
            record.connections_billed_actual_readings,
        ])

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "manifest.json",
            json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        )
        archive.writestr(
            f"source/{submission.source_filename}",
            submission.source_content,
        )
        archive.writestr("monthly_records.csv", records_output.getvalue())
        archive.writestr(
            "README.txt",
            (
                "Ulwandle W10 and W11 evidence pack\n"
                "The manifest contains source fingerprints, approval identities, "
                "methodology version, and deterministic results.\n"
            ),
        )
    return output.getvalue()
