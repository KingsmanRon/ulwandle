"""
Audit log read API.

The `audit_logs` table is append-only. This endpoint is admin/supervisor-only,
paginated, and supports CSV export so a procurement reviewer can take an
evidence file away from the demo.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.auth.dependencies import require_roles
from app.db.database import get_db
from app.models.models import AuditLog, User, UserRole


router = APIRouter()


def _row_view(r: AuditLog) -> dict:
    return {
        "id": r.id,
        "action": r.action,
        "actor_id": r.actor_id,
        "actor_email": r.actor_email,
        "resource_type": r.resource_type,
        "resource_id": r.resource_id,
        "payload": r.payload,
        "ip_hash": r.ip_hash,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _apply_filters(
    q,
    *,
    action: Optional[str],
    actor_email: Optional[str],
    resource_type: Optional[str],
    resource_id: Optional[str],
    hours: int,
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = q.filter(AuditLog.created_at >= cutoff)
    if action:
        q = q.filter(AuditLog.action == action)
    if actor_email:
        q = q.filter(AuditLog.actor_email == actor_email.lower())
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.filter(AuditLog.resource_id == resource_id)
    return q


@router.get("/")
def list_audit_logs(
    action: Optional[str] = None,
    actor_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    hours: int = Query(168, ge=1, le=24 * 365),
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    q = _apply_filters(db.query(AuditLog), action=action, actor_email=actor_email,
                       resource_type=resource_type, resource_id=resource_id, hours=hours)
    total = q.count()
    rows = (
        q.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "count": len(rows),
        "logs": [_row_view(r) for r in rows],
    }


@router.get("/export.csv")
def export_audit_logs_csv(
    action: Optional[str] = None,
    actor_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    hours: int = Query(168, ge=1, le=24 * 365),
    limit: int = Query(10_000, ge=1, le=100_000),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR)),
) -> StreamingResponse:
    q = _apply_filters(db.query(AuditLog), action=action, actor_email=actor_email,
                       resource_type=resource_type, resource_id=resource_id, hours=hours)
    rows = q.order_by(AuditLog.created_at.desc()).limit(limit).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "created_at", "action", "actor_id", "actor_email",
        "resource_type", "resource_id", "ip_hash", "payload",
    ])
    for r in rows:
        writer.writerow([
            r.id,
            r.created_at.isoformat() if r.created_at else "",
            r.action,
            r.actor_id or "",
            r.actor_email or "",
            r.resource_type or "",
            r.resource_id or "",
            r.ip_hash or "",
            "" if r.payload is None else str(r.payload),
        ])
    buf.seek(0)
    filename = f"audit-logs-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
