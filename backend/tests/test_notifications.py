"""
Notification dispatch: threshold gating, channel selection, never-raise.

We don't speak SMTP or hit real webhooks in these tests; we patch the
transport functions and assert that dispatch routes correctly.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models.models import Alert, AlertLevel
from app.services import notifications


def _alert(level: AlertLevel, **kw) -> Alert:
    return Alert(
        id=kw.get("id", 1),
        alert_type=kw.get("alert_type", "scraper"),
        level=level,
        title=kw.get("title", "T"),
        message=kw.get("message", "M"),
        district_id=kw.get("district_id"),
        alert_metadata=kw.get("alert_metadata", {}),
        created_at=datetime.now(timezone.utc),
    )


def test_threshold_skip_below_warning(monkeypatch):
    called = []
    monkeypatch.setattr(notifications, "_send_email", lambda *_a, **_k: called.append("email"))
    monkeypatch.setattr(notifications, "_send_webhook", lambda *_a, **_k: called.append("webhook"))
    monkeypatch.setattr(notifications.settings, "NOTIFICATION_MIN_LEVEL", "warning")

    notifications.dispatch_alert(_alert(AlertLevel.INFO))
    assert called == []


def test_dispatch_passes_through_at_or_above_threshold(monkeypatch):
    called = []
    monkeypatch.setattr(notifications, "_send_email", lambda *_a, **_k: called.append("email"))
    monkeypatch.setattr(notifications, "_send_webhook", lambda *_a, **_k: called.append("webhook"))
    monkeypatch.setattr(notifications.settings, "NOTIFICATION_MIN_LEVEL", "warning")

    notifications.dispatch_alert(_alert(AlertLevel.CRITICAL))
    assert "email" in called and "webhook" in called


def test_dispatch_never_raises_on_channel_failure(monkeypatch):
    """A downed SMTP relay must not propagate into the request lifecycle —
    valve operations and scrapers depend on dispatch being fire-and-forget."""
    def boom(*_a, **_k):
        raise RuntimeError("SMTP timeout")
    monkeypatch.setattr(notifications, "_send_email", boom)
    monkeypatch.setattr(notifications, "_send_webhook", boom)
    monkeypatch.setattr(notifications.settings, "NOTIFICATION_MIN_LEVEL", "warning")
    # Must NOT raise.
    notifications.dispatch_alert(_alert(AlertLevel.WARNING))


def test_invalid_min_level_falls_back_to_warning(monkeypatch):
    called = []
    monkeypatch.setattr(notifications, "_send_email", lambda *_a, **_k: called.append("email"))
    monkeypatch.setattr(notifications, "_send_webhook", lambda *_a, **_k: called.append("webhook"))
    monkeypatch.setattr(notifications.settings, "NOTIFICATION_MIN_LEVEL", "nonsense")

    notifications.dispatch_alert(_alert(AlertLevel.INFO))    # below "warning"
    assert called == []
    notifications.dispatch_alert(_alert(AlertLevel.WARNING)) # at "warning"
    assert "email" in called


def test_send_email_skipped_when_smtp_host_unset(monkeypatch):
    """SMTP is optional — no host means no email attempt (and certainly no crash)."""
    monkeypatch.setattr(notifications.settings, "SMTP_HOST", "")
    # Touch _send_email directly; it must short-circuit and return.
    notifications._send_email(_alert(AlertLevel.CRITICAL), ["test@example.com"])
