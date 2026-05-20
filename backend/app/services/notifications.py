"""
Alert dispatch — email (SMTP) and webhook.

Called when a high-severity alert row is written. Designed to be fire-and-forget
from request paths: failures are logged but never raised, so a downed SMTP
relay cannot break valve operations or scraper runs.

Configuration (all optional — empty values disable that channel):
    SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_TLS
    NOTIFICATION_WEBHOOK_URL
    NOTIFICATION_MIN_LEVEL    (alerts below this level are skipped)
"""

from __future__ import annotations

import json
import logging
import smtplib
from email.mime.text import MIMEText
from typing import Iterable

import httpx

from app.core.config import settings
from app.models.models import Alert, AlertLevel


logger = logging.getLogger(__name__)


_LEVEL_RANK = {
    AlertLevel.INFO: 0,
    AlertLevel.WARNING: 1,
    AlertLevel.CRITICAL: 2,
    AlertLevel.EMERGENCY: 3,
}


def _meets_threshold(level: AlertLevel) -> bool:
    try:
        floor = AlertLevel(settings.NOTIFICATION_MIN_LEVEL)
    except ValueError:
        floor = AlertLevel.WARNING
    return _LEVEL_RANK[level] >= _LEVEL_RANK[floor]


def _format_subject(alert: Alert) -> str:
    return f"[Ulwandle RAC] {alert.level.value.upper()}: {alert.title}"


def _format_body(alert: Alert) -> str:
    lines = [
        f"Level: {alert.level.value}",
        f"Type:  {alert.alert_type}",
        f"Title: {alert.title}",
        "",
        alert.message or "",
    ]
    if alert.alert_metadata:
        lines.extend(["", "Metadata:", json.dumps(alert.alert_metadata, indent=2, default=str)])
    return "\n".join(lines)


def _send_email(alert: Alert, recipients: Iterable[str]) -> None:
    if not settings.SMTP_HOST:
        return
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    msg = MIMEText(_format_body(alert), "plain", "utf-8")
    msg["Subject"] = _format_subject(alert)
    msg["From"] = settings.SMTP_FROM or (settings.SMTP_USERNAME or "alerts@ulwandle.tech")
    msg["To"] = ", ".join(recipients)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
            if settings.SMTP_USE_TLS:
                s.starttls()
            if settings.SMTP_USERNAME:
                s.login(settings.SMTP_USERNAME,
                        settings.SMTP_PASSWORD.get_secret_value())
            s.send_message(msg)
        logger.info("alert.notify.email level=%s alert_id=%s recipients=%d",
                    alert.level.value, alert.id, len(recipients))
    except Exception:
        logger.exception("alert.notify.email failed (alert_id=%s)", alert.id)


def _send_webhook(alert: Alert) -> None:
    url = settings.NOTIFICATION_WEBHOOK_URL
    if not url:
        return
    payload = {
        "alert_id": alert.id,
        "alert_type": alert.alert_type,
        "level": alert.level.value,
        "title": alert.title,
        "message": alert.message,
        "district_id": alert.district_id,
        "metadata": alert.alert_metadata,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }
    try:
        with httpx.Client(timeout=10.0) as c:
            r = c.post(url, json=payload)
            r.raise_for_status()
        logger.info("alert.notify.webhook level=%s alert_id=%s",
                    alert.level.value, alert.id)
    except Exception:
        logger.exception("alert.notify.webhook failed (alert_id=%s)", alert.id)


def dispatch_alert(alert: Alert, *, extra_recipients: Iterable[str] = ()) -> None:
    """
    Best-effort delivery across configured channels. Never raises.

    Skipped silently when the alert is below NOTIFICATION_MIN_LEVEL, when no
    channels are configured, or when delivery fails.
    """
    try:
        if not _meets_threshold(alert.level):
            return
        recipients = list(extra_recipients) or [settings.ALERT_EMAIL]
        _send_email(alert, recipients)
        _send_webhook(alert)
    except Exception:
        logger.exception("alert.notify dispatch failed (alert_id=%s)", alert.id)
