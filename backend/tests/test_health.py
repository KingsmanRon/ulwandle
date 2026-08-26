"""Deployment probe regression tests."""

from fastapi.testclient import TestClient

from app.main import app, limiter


class _UnavailableStorage:
    """Raise if a health probe ever attempts to use rate-limit storage."""

    def __getattr__(self, name):
        raise AssertionError(f"health probe accessed rate-limit storage: {name}")


def test_health_does_not_depend_on_rate_limit_storage(monkeypatch):
    monkeypatch.setattr(limiter, "_storage", _UnavailableStorage())

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_rate_limiter_has_in_memory_failover():
    assert limiter._in_memory_fallback_enabled is True
