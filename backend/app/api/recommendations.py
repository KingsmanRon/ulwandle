"""
Per-metro AI recommendations endpoint.

POST /api/v1/recommendations/{metro_id}

Pulls verified per-metro figures (population, NRW%, per-capita) plus
the most recent dam-storage reading, hands them to claude_service in
sanitised numeric form, and returns the parsed JSON response.

If Anthropic is unreachable / rate-limited / out of credit the
endpoint still returns 200 with a degraded payload —
``{"status": "unavailable", "reason": "...", ...}`` — instead of a
500. The frontend renders a graceful fallback rather than crashing.

In-process LRU cache keys on (metro_id, hour_bucket, NRW-bucket) so
repeated views within ~1h hit the cache instead of burning credits.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.cache import JsonCache
from app.core.config import settings
from app.db.database import get_db
from app.models.models import (
    Dam, DamStorageReading, Metro, MetroDam, User,
)
from app.services.claude_service import claude_service


logger = logging.getLogger(__name__)
router = APIRouter()


class RecommendationItem(BaseModel):
    title: str
    description: str
    impact: str
    cost: str
    timeline: str
    kpis: list[str] = []


class RecommendationsResponse(BaseModel):
    status: str  # "ok" | "unavailable"
    metro_id: str
    priority: Optional[str] = None
    recommendations: Optional[list[RecommendationItem]] = None
    potential_savings: Optional[str] = None
    roi: Optional[str] = None
    generated_at: Optional[str] = None
    reason: Optional[str] = None


# Redis-backed (Upstash in prod) so the cache survives free-tier spin-downs and
# is shared across gunicorn workers; degrades to in-process on Redis failure.
_CACHE_TTL_SECONDS = 3600
_rec_cache = JsonCache("recommendations")


def _cache_key(metro: Metro) -> str:
    """Key on (metro, hour bucket, 5%-NRW bucket) so repeated views within ~1h
    of stable inputs share one Claude generation."""
    hour_bucket = int(time.time() // _CACHE_TTL_SECONDS)
    nrw_bucket = int(round(metro.nrw_pct / 5) * 5)
    return f"{metro.id}:{hour_bucket}:{nrw_bucket}"


def _latest_dam_pcts(db: Session, metro_id: str) -> tuple[float | None, float | None]:
    """Return (primary_dam_pct, weighted_pct) for the metro. Either may
    be None if no readings exist yet.

    Readings older than ``DAM_DATA_STALE_AFTER_DAYS`` are treated as missing
    rather than current — we never hand Claude a months-old storage figure
    dressed up as today's, which would make the recommendation silently wrong."""
    rows = (
        db.query(Dam, MetroDam.is_primary)
        .join(MetroDam, MetroDam.dam_id == Dam.id)
        .filter(MetroDam.metro_id == metro_id)
        .all()
    )
    if not rows:
        return None, None
    stale_before = (datetime.now(timezone.utc)
                    - timedelta(days=settings.DAM_DATA_STALE_AFTER_DAYS))
    primary_pct: float | None = None
    weighted_total = 0.0
    weighted_capacity = 0.0
    for dam, is_primary in rows:
        latest = (
            db.query(DamStorageReading)
            .filter(DamStorageReading.dam_id == dam.id)
            .order_by(DamStorageReading.as_of.desc(),
                      DamStorageReading.fetched_at.desc())
            .first()
        )
        if latest is None:
            continue
        as_of = latest.as_of
        if as_of.tzinfo is None:
            as_of = as_of.replace(tzinfo=timezone.utc)
        if as_of < stale_before:
            # Reading too old to be trusted as current — skip it.
            continue
        if is_primary and primary_pct is None:
            primary_pct = latest.storage_pct
        if dam.full_capacity_ml:
            weighted_total += (latest.storage_pct / 100.0) * dam.full_capacity_ml
            weighted_capacity += dam.full_capacity_ml
    weighted_pct = (
        round((weighted_total / weighted_capacity) * 100.0, 2)
        if weighted_capacity > 0 else None
    )
    return primary_pct, weighted_pct


@router.post("/{metro_id}", response_model=RecommendationsResponse)
async def generate_recommendations(
    metro_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecommendationsResponse:
    metro = db.get(Metro, metro_id)
    if metro is None:
        raise HTTPException(status_code=404, detail="Metro not found")

    cache_key = _cache_key(metro)
    cached = _rec_cache.get(cache_key)
    if cached is not None:
        logger.info("recommendations: cache hit metro=%s actor=%s", metro_id, user.id)
        return RecommendationsResponse(**cached)

    primary_pct, weighted_pct = _latest_dam_pcts(db, metro_id)

    summary = {
        "metro_name": metro.name,
        "province": metro.province,
        "population": metro.population,
        "nrw_pct": metro.nrw_pct,
        "per_capita_lpcd": metro.per_capita_lpcd,
        "primary_dam_storage_pct": primary_pct or 0.0,
        "weighted_storage_pct": weighted_pct or 0.0,
    }

    raw = await claude_service.metro_recommendations(summary)

    # Normalise into our Pydantic shape. claude_service already returns
    # status='unavailable' on API errors; treat anything else as ok.
    status_field = raw.get("status", "ok")
    payload = {
        "status": status_field,
        "metro_id": metro_id,
        "priority": raw.get("priority"),
        "recommendations": raw.get("recommendations"),
        "potential_savings": raw.get("potential_savings"),
        "roi": raw.get("roi"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "reason": raw.get("reason"),
    }

    # Cache only successful generations — re-attempt next call on failure.
    if status_field == "ok":
        _rec_cache.put(cache_key, payload, _CACHE_TTL_SECONDS)

    return RecommendationsResponse(**payload)
