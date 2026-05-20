"""
Alerts API.
"""

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.auth.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.models.models import Alert, AlertLevel, District, User, UserRole

router = APIRouter()


def _apply_alert_filters(
    q, *, district_id, alert_type, level, is_resolved, hours: int,
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = q.filter(Alert.created_at >= cutoff)
    if district_id:
        q = q.filter(Alert.district_id == district_id)
    if alert_type:
        q = q.filter(Alert.alert_type == alert_type)
    if level:
        try:
            q = q.filter(Alert.level == AlertLevel(level))
        except ValueError:
            raise HTTPException(400, "Invalid alert level")
    if is_resolved is not None:
        q = q.filter(Alert.is_resolved == is_resolved)
    return q


class AlertResolve(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


@router.get("/")
def list_alerts(
    district_id: Optional[int] = None,
    alert_type: Optional[str] = None,
    level: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    hours: int = Query(24, ge=1, le=24 * 30),
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = _apply_alert_filters(db.query(Alert), district_id=district_id,
                             alert_type=alert_type, level=level,
                             is_resolved=is_resolved, hours=hours)
    total = q.count()
    rows = (
        q.order_by(Alert.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "count": len(rows),
        "alerts": [
            {
                "id": a.id, "alert_type": a.alert_type, "level": a.level.value,
                "title": a.title, "message": a.message, "district_id": a.district_id,
                "is_resolved": a.is_resolved,
                "created_at": a.created_at.isoformat(),
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            } for a in rows
        ],
    }


@router.get("/export.csv")
def export_alerts_csv(
    district_id: Optional[int] = None,
    alert_type: Optional[str] = None,
    level: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    hours: int = Query(168, ge=1, le=24 * 365),
    limit: int = Query(10_000, ge=1, le=100_000),
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)),
) -> StreamingResponse:
    q = _apply_alert_filters(db.query(Alert), district_id=district_id,
                             alert_type=alert_type, level=level,
                             is_resolved=is_resolved, hours=hours)
    rows = q.order_by(Alert.created_at.desc()).limit(limit).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "created_at", "alert_type", "level", "title", "message",
        "district_id", "is_resolved", "resolved_at", "resolved_by",
    ])
    for a in rows:
        writer.writerow([
            a.id,
            a.created_at.isoformat() if a.created_at else "",
            a.alert_type,
            a.level.value,
            a.title,
            (a.message or "").replace("\r", " ").replace("\n", " "),
            a.district_id or "",
            "yes" if a.is_resolved else "no",
            a.resolved_at.isoformat() if a.resolved_at else "",
            a.resolved_by or "",
        ])
    buf.seek(0)
    filename = f"alerts-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{alert_id}")
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    district = None
    if a.district_id:
        district = db.query(District).filter(District.id == a.district_id).first()
    return {
        "id": a.id, "alert_type": a.alert_type, "level": a.level.value,
        "title": a.title, "message": a.message,
        "district": {"id": district.id, "name": district.name} if district else None,
        "alert_metadata": a.alert_metadata,
        "is_resolved": a.is_resolved,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "resolved_by": a.resolved_by,
        "created_at": a.created_at.isoformat(),
    }


@router.put("/{alert_id}/resolve")
def resolve(
    alert_id: int,
    body: AlertResolve,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR)),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    if a.is_resolved:
        raise HTTPException(409, "Alert already resolved")
    a.is_resolved = True
    a.resolved_at = datetime.now(timezone.utc)
    a.resolved_by = current.email
    if body.note:
        meta = dict(a.alert_metadata or {})
        meta["resolution_note"] = body.note
        a.alert_metadata = meta
    db.commit()
    return {"id": a.id, "resolved_by": a.resolved_by, "resolved_at": a.resolved_at.isoformat()}


@router.get("/statistics/summary")
def stats(
    hours: int = Query(24, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.query(Alert).filter(Alert.created_at >= cutoff).all()
    by_level = {lvl.value: 0 for lvl in AlertLevel}
    by_type: dict[str, int] = {}
    resolved = unresolved = 0
    for r in rows:
        by_level[r.level.value] += 1
        by_type[r.alert_type] = by_type.get(r.alert_type, 0) + 1
        if r.is_resolved:
            resolved += 1
        else:
            unresolved += 1
    return {
        "timespan_hours": hours,
        "total": len(rows),
        "by_level": by_level,
        "by_type": by_type,
        "resolved": resolved,
        "unresolved": unresolved,
    }
