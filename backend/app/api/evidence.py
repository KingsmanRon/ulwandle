"""Versioned source imports, approval, calculation, and export for W10 and W11."""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Optional

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Query, Request, Response,
    UploadFile,
)
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user, require_roles
from app.auth.security import hash_ip
from app.db.database import get_db
from app.models.models import (
    AuditLog, EvidenceCalculation, EvidenceMonthlyRecord, EvidenceSubmission,
    Metro, User, UserRole,
)
from app.services.evidence_service import (
    EvidenceInputRow, EvidenceResult, EvidenceValidationError,
    build_evidence_zip, calculate_evidence, evidence_template_csv,
    parse_evidence_csv, reporting_period, source_sha256,
)


router = APIRouter()


def _input_rows(records: list[EvidenceMonthlyRecord]) -> list[EvidenceInputRow]:
    return [
        EvidenceInputRow(
            period_start=record.period_start,
            system_input_volume_kl=record.system_input_volume_kl,
            billed_authorised_consumption_kl=record.billed_authorised_consumption_kl,
            total_connections=record.total_connections,
            connections_billed_actual_readings=(
                record.connections_billed_actual_readings
            ),
            source_row_number=record.source_row_number,
        )
        for record in records
    ]


def _stored_result(calculation: EvidenceCalculation) -> EvidenceResult:
    return EvidenceResult(
        methodology_version=calculation.methodology_version,
        input_sha256=calculation.input_sha256,
        system_input_volume_kl=calculation.system_input_volume_kl,
        billed_authorised_consumption_kl=(
            calculation.billed_authorised_consumption_kl
        ),
        connection_months=calculation.connection_months,
        actual_meter_reading_connection_months=(
            calculation.actual_meter_reading_connection_months
        ),
        w10_nrw_pct=calculation.w10_nrw_pct,
        w11_metering_pct=calculation.w11_metering_pct,
    )


def _calculation_view(calculation: Optional[EvidenceCalculation]) -> Optional[dict]:
    if calculation is None:
        return None
    return {
        "methodology_version": calculation.methodology_version,
        "input_sha256": calculation.input_sha256,
        "system_input_volume_kl": float(calculation.system_input_volume_kl),
        "billed_authorised_consumption_kl": float(
            calculation.billed_authorised_consumption_kl
        ),
        "connection_months": calculation.connection_months,
        "actual_meter_reading_connection_months": (
            calculation.actual_meter_reading_connection_months
        ),
        "w10_nrw_pct": float(calculation.w10_nrw_pct),
        "w11_metering_pct": float(calculation.w11_metering_pct),
        "calculated_at": calculation.calculated_at.isoformat(),
    }


def _submission_view(submission: EvidenceSubmission, include_records: bool = False) -> dict:
    response = {
        "id": submission.id,
        "metro_id": submission.metro_id,
        "reporting_period_start": submission.reporting_period_start.isoformat(),
        "reporting_period_end": submission.reporting_period_end.isoformat(),
        "version": submission.version,
        "status": submission.status,
        "source_name": submission.source_name,
        "source_url": submission.source_url,
        "source_filename": submission.source_filename,
        "source_sha256": submission.source_sha256,
        "notes": submission.notes,
        "created_by_id": submission.created_by_id,
        "approved_by_id": submission.approved_by_id,
        "created_at": submission.created_at.isoformat(),
        "approved_at": (
            submission.approved_at.isoformat() if submission.approved_at else None
        ),
        "record_count": len(submission.records),
        "calculation": _calculation_view(submission.calculation),
    }
    if include_records:
        response["records"] = [
            {
                "period": record.period_start.strftime("%Y-%m"),
                "system_input_volume_kl": float(record.system_input_volume_kl),
                "billed_authorised_consumption_kl": float(
                    record.billed_authorised_consumption_kl
                ),
                "total_connections": record.total_connections,
                "connections_billed_actual_readings": (
                    record.connections_billed_actual_readings
                ),
                "source_row_number": record.source_row_number,
            }
            for record in submission.records
        ]
    return response


def _submission_or_404(db: Session, submission_id: int) -> EvidenceSubmission:
    submission = (
        db.query(EvidenceSubmission)
        .options(
            selectinload(EvidenceSubmission.records),
            selectinload(EvidenceSubmission.calculation),
        )
        .filter(EvidenceSubmission.id == submission_id)
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Evidence submission not found")
    return submission


@router.get("/template")
def download_template(_user: User = Depends(get_current_user)):
    return Response(
        content=evidence_template_csv(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                'attachment; filename="ulwandle_w10_w11_evidence_template.csv"'
            )
        },
    )


@router.get("/submissions")
def list_submissions(
    metro_id: Optional[str] = None,
    status: Optional[str] = Query(
        default=None, pattern="^(draft|approved|superseded)$",
    ),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = db.query(EvidenceSubmission).options(
        selectinload(EvidenceSubmission.records),
        selectinload(EvidenceSubmission.calculation),
    )
    if metro_id:
        query = query.filter(EvidenceSubmission.metro_id == metro_id)
    if status:
        query = query.filter(EvidenceSubmission.status == status)
    rows = query.order_by(
        EvidenceSubmission.reporting_period_end.desc(),
        EvidenceSubmission.version.desc(),
    ).limit(limit).all()
    return {
        "count": len(rows),
        "submissions": [_submission_view(row) for row in rows],
    }


@router.get("/submissions/{submission_id}")
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return _submission_view(
        _submission_or_404(db, submission_id),
        include_records=True,
    )


@router.post("/import", status_code=201)
async def import_evidence(
    request: Request,
    metro_id: str = Form(..., min_length=1, max_length=64),
    source_name: str = Form(..., min_length=1, max_length=200),
    source_url: Optional[str] = Form(default=None, max_length=500),
    notes: Optional[str] = Form(default=None, max_length=2000),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)
    ),
):
    raw_filename = (file.filename or "evidence.csv").replace("\\", "/")
    filename = re.sub(r"[^A-Za-z0-9._-]", "_", raw_filename.rsplit("/", 1)[-1])
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Evidence imports must be CSV files")
    content = await file.read()
    try:
        rows = parse_evidence_csv(content)
        period_start, period_end = reporting_period(rows)
    except EvidenceValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    clean_source_name = source_name.strip()
    if not clean_source_name:
        raise HTTPException(status_code=422, detail="Source name cannot be blank")

    metro = (
        db.query(Metro)
        .filter(Metro.id == metro_id)
        .with_for_update()
        .first()
    )
    if metro is None:
        raise HTTPException(status_code=404, detail="Metro not found")

    digest = source_sha256(content)
    duplicate = db.query(EvidenceSubmission).filter(
        EvidenceSubmission.metro_id == metro_id,
        EvidenceSubmission.reporting_period_start == period_start,
        EvidenceSubmission.reporting_period_end == period_end,
        EvidenceSubmission.source_sha256 == digest,
    ).first()
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=f"This source file is already submission {duplicate.id}",
        )

    latest_version = db.query(func.max(EvidenceSubmission.version)).filter(
        EvidenceSubmission.metro_id == metro_id,
        EvidenceSubmission.reporting_period_start == period_start,
        EvidenceSubmission.reporting_period_end == period_end,
    ).scalar() or 0
    submission = EvidenceSubmission(
        metro_id=metro_id,
        reporting_period_start=period_start,
        reporting_period_end=period_end,
        version=latest_version + 1,
        status="draft",
        source_name=clean_source_name,
        source_url=source_url.strip() if source_url else None,
        source_filename=filename,
        source_sha256=digest,
        source_content=content,
        notes=notes.strip() if notes else None,
        created_by_id=current.id,
        records=[
            EvidenceMonthlyRecord(
                period_start=row.period_start,
                system_input_volume_kl=row.system_input_volume_kl,
                billed_authorised_consumption_kl=(
                    row.billed_authorised_consumption_kl
                ),
                total_connections=row.total_connections,
                connections_billed_actual_readings=(
                    row.connections_billed_actual_readings
                ),
                source_row_number=row.source_row_number,
            )
            for row in rows
        ],
    )
    db.add(submission)
    db.flush()
    db.add(AuditLog(
        actor_id=current.id,
        actor_email=current.email,
        action="evidence.import",
        resource_type="evidence_submission",
        resource_id=str(submission.id),
        payload={
            "metro_id": metro_id,
            "version": submission.version,
            "source_sha256": digest,
            "record_count": len(rows),
        },
        ip_hash=hash_ip(request.client.host) if request.client else None,
    ))
    db.commit()
    db.refresh(submission)
    return _submission_view(_submission_or_404(db, submission.id), include_records=True)


@router.post("/submissions/{submission_id}/approve")
def approve_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    submission = (
        db.query(EvidenceSubmission)
        .filter(EvidenceSubmission.id == submission_id)
        .with_for_update()
        .first()
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Evidence submission not found")
    if submission.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft submissions can be approved")
    if submission.created_by_id == current.id:
        raise HTTPException(
            status_code=409,
            detail="The importer cannot approve their own evidence submission",
        )
    db.query(Metro).filter(
        Metro.id == submission.metro_id
    ).with_for_update().one()
    try:
        result = calculate_evidence(_input_rows(submission.records))
    except EvidenceValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    previous_approved = db.query(EvidenceSubmission).filter(
        EvidenceSubmission.metro_id == submission.metro_id,
        EvidenceSubmission.reporting_period_start == submission.reporting_period_start,
        EvidenceSubmission.reporting_period_end == submission.reporting_period_end,
        EvidenceSubmission.status == "approved",
        EvidenceSubmission.id != submission.id,
    ).all()
    for previous in previous_approved:
        previous.status = "superseded"

    now = datetime.now(timezone.utc)
    submission.status = "approved"
    submission.approved_by_id = current.id
    submission.approved_at = now
    submission.calculation = EvidenceCalculation(
        methodology_version=result.methodology_version,
        input_sha256=result.input_sha256,
        system_input_volume_kl=result.system_input_volume_kl,
        billed_authorised_consumption_kl=result.billed_authorised_consumption_kl,
        connection_months=result.connection_months,
        actual_meter_reading_connection_months=(
            result.actual_meter_reading_connection_months
        ),
        w10_nrw_pct=result.w10_nrw_pct,
        w11_metering_pct=result.w11_metering_pct,
    )
    db.add(AuditLog(
        actor_id=current.id,
        actor_email=current.email,
        action="evidence.approve",
        resource_type="evidence_submission",
        resource_id=str(submission.id),
        payload={
            "metro_id": submission.metro_id,
            "version": submission.version,
            "methodology_version": result.methodology_version,
            "input_sha256": result.input_sha256,
            "w10_nrw_pct": format(result.w10_nrw_pct, "f"),
            "w11_metering_pct": format(result.w11_metering_pct, "f"),
            "superseded_submission_ids": [
                previous.id for previous in previous_approved
            ],
        },
        ip_hash=hash_ip(request.client.host) if request.client else None,
    ))
    db.commit()
    return _submission_view(_submission_or_404(db, submission.id), include_records=True)


@router.get("/submissions/{submission_id}/export")
def export_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    submission = _submission_or_404(db, submission_id)
    if submission.status != "approved" or submission.calculation is None:
        raise HTTPException(
            status_code=409,
            detail="Only approved submissions can be exported as evidence",
        )
    archive = build_evidence_zip(
        submission,
        _stored_result(submission.calculation),
    )
    filename = (
        f"{submission.metro_id}_W10_W11_"
        f"{submission.reporting_period_end.isoformat()}_v{submission.version}.zip"
    )
    return Response(
        content=archive,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
