"""
Shared helpers for the DWS/CoCT scrapers: retry-with-backoff and
"raise an alert when a scrape silently goes stale".

Both scrapers run from GitHub Actions cron with no operator watching, so
the only way a buyer hears about a CoCT page redesign is the alerts feed.
"""

from __future__ import annotations

import logging
import time
from typing import Callable, TypeVar

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Alert, AlertLevel
from app.observability.metrics import SCRAPER_ROWS_LAST_RUN, SCRAPER_RUNS_TOTAL
from app.services.notifications import dispatch_alert


T = TypeVar("T")
logger = logging.getLogger(__name__)


def with_retries(
    fn: Callable[[], T],
    *,
    label: str,
    attempts: int | None = None,
    base_delay: float | None = None,
) -> T:
    """
    Call `fn()` with exponential backoff. The last exception is re-raised.

    `attempts` and `base_delay` default to SCRAPER_RETRY_ATTEMPTS and
    SCRAPER_RETRY_BASE_DELAY_SECONDS from settings.
    """
    attempts = attempts or settings.SCRAPER_RETRY_ATTEMPTS
    base_delay = base_delay if base_delay is not None else settings.SCRAPER_RETRY_BASE_DELAY_SECONDS
    last: Exception | None = None
    for i in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last = exc
            if i == attempts:
                break
            wait = base_delay * (2 ** (i - 1))
            logger.warning("%s: attempt %d/%d failed (%s) — retrying in %.1fs",
                           label, i, attempts, exc.__class__.__name__, wait)
            time.sleep(wait)
    assert last is not None
    raise last


def emit_scrape_failure_alert(
    db: Session, *, source_name: str, error: str,
) -> None:
    """
    Write an Alert row when a scrape has failed and dispatch it via the
    configured channels. Idempotent on (alert_type=scraper, title) within
    the last 6h so a chronic outage doesn't fill the inbox.
    """
    title = f"Scraper failed: {source_name}"
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    existing = db.query(Alert).filter(
        Alert.alert_type == "scraper",
        Alert.title == title,
        Alert.created_at >= cutoff,
        Alert.is_resolved == False,  # noqa: E712
    ).first()
    if existing:
        # Refresh the message + count, but don't duplicate.
        existing.message = (error or "")[:1000]
        existing.notification_count = (existing.notification_count or 0) + 1
        db.commit()
        return

    alert = Alert(
        alert_type="scraper",
        level=AlertLevel.WARNING,
        title=title,
        message=(error or "")[:1000],
        alert_metadata={"source": source_name, "channel": "scraper"},
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    try:
        dispatch_alert(alert)
    except Exception:
        logger.exception("emit_scrape_failure_alert: dispatch failed")


def record_metrics(*, source_key: str, status: str, rows: int) -> None:
    """Surface the latest scrape run on /metrics."""
    try:
        SCRAPER_RUNS_TOTAL.labels(source_key, status).inc()
        SCRAPER_ROWS_LAST_RUN.labels(source_key).set(rows)
    except Exception:
        logger.exception("scraper metrics update failed (source=%s)", source_key)
