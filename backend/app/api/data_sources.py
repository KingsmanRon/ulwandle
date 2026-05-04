"""
Data-source registry endpoint.

Exposes the contents of the ``data_sources`` table — one row per
external feed (DWS Weekly, CoCT Daily, Stats SA, etc.) — so the
Dashboard can show last-refresh timestamps and source provenance
without giving the frontend table-level access.

Read-only, gated by ``get_current_user``.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.database import get_db
from app.models.models import DataSource, User


router = APIRouter()


class DataSourceStatus(BaseModel):
    key: str
    name: str
    url: Optional[str] = None
    description: Optional[str] = None
    last_attempted_at: Optional[str] = None
    last_success_at: Optional[str] = None
    last_status: Optional[str] = None
    rows_last_run: Optional[int] = None


@router.get("/", response_model=list[DataSourceStatus])
def list_data_sources(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[DataSourceStatus]:
    rows = db.query(DataSource).order_by(DataSource.key).all()
    return [
        DataSourceStatus(
            key=r.key,
            name=r.name,
            url=r.url,
            description=r.description,
            last_attempted_at=r.last_attempted_at.isoformat() if r.last_attempted_at else None,
            last_success_at=r.last_success_at.isoformat() if r.last_success_at else None,
            last_status=r.last_status,
            rows_last_run=r.rows_last_run,
        )
        for r in rows
    ]
