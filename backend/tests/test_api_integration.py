"""
End-to-end API tests against a SQLite-backed app.

conftest.py points DATABASE_URL at a temp SQLite file before any app module
imports. Here we create_all the schema once per session and bootstrap an
admin user, then drive the public API via TestClient.
"""

from __future__ import annotations

import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def _bootstrap_db():
    """Create the schema and seed an admin user exactly once per session."""
    from app.db.database import Base, SessionLocal, engine
    from app.auth.security import hash_password
    from app.models.models import AuditLog, User, UserRole

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@example.com").first():
            db.add(User(
                email="admin@example.com",
                full_name="Admin",
                hashed_password=hash_password("super-secret-12345"),
                role=UserRole.ADMIN,
                is_active=True,
            ))
            db.add(AuditLog(
                actor_id=None, actor_email="seed@example.com",
                action="seed.test", resource_type="test", resource_id="1",
                payload={"k": "v"}, ip_hash=None,
            ))
            db.commit()
    finally:
        db.close()

    yield

    # Tear down the temp DB file at session end.
    path = os.environ.get("ULWANDLE_TEST_DB")
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except OSError:
            pass


@pytest.fixture(scope="module")
def client():
    from app.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)


def _login(client) -> str:
    r = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "super-secret-12345",
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_health_is_unauthenticated(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_metrics_endpoint_returns_prometheus_text(client):
    r = client.get("/metrics")
    assert r.status_code == 200
    body = r.text
    assert "ulwandle_http_requests_total" in body
    assert "ulwandle_scraper_runs_total" in body


def test_login_returns_jwt_and_refresh(client):
    r = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "super-secret-12345",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["role"] == "admin"


def test_login_wrong_password_returns_401(client):
    r = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "wrong-password-1234",
    })
    assert r.status_code == 401


def test_audit_logs_requires_auth(client):
    r = client.get("/api/v1/audit-logs/")
    assert r.status_code == 401


def test_audit_logs_admin_can_list_with_pagination(client):
    token = _login(client)
    r = client.get(
        "/api/v1/audit-logs/?page=1&page_size=10",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "page" in body and "total" in body and "logs" in body
    assert body["page"] == 1
    assert body["total"] >= 1


def test_audit_logs_csv_export(client):
    token = _login(client)
    r = client.get(
        "/api/v1/audit-logs/export.csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    text = r.text
    assert "action" in text.splitlines()[0]


def test_logout_all_revokes_refresh_tokens(client):
    r1 = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com", "password": "super-secret-12345",
    })
    r2 = client.post("/api/v1/auth/login", json={
        "email": "admin@example.com", "password": "super-secret-12345",
    })
    token = r1.json()["access_token"]
    refresh2 = r2.json()["refresh_token"]

    r = client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["revoked"] >= 2

    # The second login's refresh token must now fail to refresh.
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh2})
    assert r.status_code == 401


def test_alerts_list_is_paginated_shape(client):
    token = _login(client)
    r = client.get(
        "/api/v1/alerts/?page=1&page_size=10",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 1 and "total" in body and "alerts" in body


def test_districts_list_is_paginated_shape(client):
    token = _login(client)
    r = client.get(
        "/api/v1/districts/?page=1&page_size=5",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 1 and "total" in body and "districts" in body
