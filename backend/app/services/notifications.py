"""
Outbound operational alerts.

A single best-effort webhook poster used to turn otherwise-silent failures
(a scraper that stopped matching the gov-site format, an AI feed gone dark)
into something a human actually sees. Posts a Slack/Discord/generic-compatible
``{"text": ...}`` payload to ``NOTIFICATION_WEBHOOK_URL``.

Never raises: an alerting failure must not take down the thing it's reporting
on. If the webhook is unset, this is a no-op (logged at debug).
"""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def notify_ops(text: str, *, level: str = "warning") -> bool:
    """Post an operational alert to the configured webhook.

    Returns True if a request was sent and accepted, False otherwise (including
    when no webhook is configured). Swallows every error by design.
    """
    url = (settings.NOTIFICATION_WEBHOOK_URL or "").strip()
    if not url:
        logger.debug("notify_ops: no NOTIFICATION_WEBHOOK_URL set; skipping (%s)", text)
        return False

    emoji = {"info": "ℹ️", "warning": "⚠️", "error": "🚨"}.get(level, "⚠️")
    payload = {"text": f"{emoji} [Ulwandle/{settings.APP_ENV}] {text}"}
    try:
        resp = httpx.post(url, json=payload, timeout=10.0)
        resp.raise_for_status()
        return True
    except Exception:
        logger.exception("notify_ops: failed to post alert")
        return False
