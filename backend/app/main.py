"""
Ulwandle Tech RAC — FastAPI entrypoint.

Hardening summary:
- Strict CORS, optional TrustedHost, security headers, body size cap.
- slowapi rate limits with per-route overrides.
- Authenticated WebSocket with JWT-in-query (browsers can't set headers on WS upgrades).
- No `Base.metadata.create_all`: schema is owned by Alembic.
"""

import logging
import os
from contextlib import asynccontextmanager

import jwt as pyjwt
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import alerts, dashboard, data_sources, districts, evidence, kill_switch, metros, monitoring, predictions, recommendations, water_quality
from app.auth import router as auth_router
from app.auth.security import decode_token
from app.core.config import settings
from app.core.net import rate_limit_key
from app.db.database import SessionLocal
from app.middleware.security import MaxBodySizeMiddleware, SecurityHeadersMiddleware
from app.models.models import User
from app.services.websocket_manager import websocket_manager


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)
DEPLOY_REVISION = (
    os.getenv("RENDER_GIT_COMMIT")
    or os.getenv("GIT_COMMIT_SHA")
    or "unknown"
)


# key_func honours X-Forwarded-For behind the proxy (see app.core.net) so limits
# are per-client, not shared across everyone behind Render's single egress IP.
# storage_uri=Redis makes the limit counters shared across the 2 gunicorn
# workers and durable across spin-downs. SlowAPI 0.1.9's swallow_errors path
# can leave request.state.view_rate_limit unset, which then crashes its own
# middleware while injecting headers. The in-memory fallback keeps requests
# available if Redis cannot be reached and avoids that broken path.
limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    storage_uri=settings.REDIS_URL,
    swallow_errors=True,
    in_memory_fallback_enabled=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Ulwandle RAC starting (env=%s, valve_control=%s, dual_control=%s)",
                settings.APP_ENV, settings.VALVE_CONTROL_ENABLED, settings.DUAL_CONTROL_REQUIRED)
    yield
    logger.info("Ulwandle RAC shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Smart Water Monitoring System for South Africa — RAC",
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.APP_ENV != "production" else None,
)


# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Body size cap
app.add_middleware(MaxBodySizeMiddleware, max_bytes=settings.MAX_REQUEST_BYTES)

# Security response headers
app.add_middleware(SecurityHeadersMiddleware)

# Strict trusted hosts (production only — empty list disables)
if settings.TRUSTED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

# Strict CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        max_age=600,
    )


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


# ---------- Health ----------

@app.get("/health", tags=["Health"])
@limiter.exempt
async def health():
    # DB-free on purpose: this is Render's healthCheckPath, so a transient DB
    # blip must not fail the deploy / kill the container.
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "revision": DEPLOY_REVISION,
    }


@app.get("/ready", tags=["Health"])
@limiter.exempt
async def ready():
    """Readiness probe that touches the DB. An external warm-ping against this
    keeps both the (free-tier, spin-down) web service and the (free-tier,
    auto-suspending) Neon database awake, so a cold prospect hitting the demo
    doesn't wait ~50s. Never raises — returns 503 on DB failure."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "db": "ok",
            "version": settings.APP_VERSION,
            "revision": DEPLOY_REVISION,
        }
    except Exception:
        logger.exception("readiness check: DB unreachable")
        return JSONResponse({"status": "degraded", "db": "down"}, status_code=503)
    finally:
        db.close()


# ---------- Authenticated WebSocket ----------

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    """
    Auth via `?token=<JWT access token>`. Browsers cannot set Authorization
    headers on WebSocket upgrades, so a query token is the standard pattern.
    The token is the same access token returned by /auth/login.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        payload = decode_token(token)
    except pyjwt.InvalidTokenError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = int(payload["sub"])
    role = payload.get("role", "viewer")

    # Verify user is still active
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    finally:
        db.close()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket_manager.attach(websocket, user_id, role)
    try:
        while True:
            # We do not echo. Server-initiated channel only; reads are
            # accepted to detect close, but content is discarded.
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.detach(websocket, user_id, role)
    except Exception:
        logger.exception("WebSocket loop failed")
        websocket_manager.detach(websocket, user_id, role)


# ---------- Routers ----------

app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["Monitoring"])
app.include_router(water_quality.router, prefix="/api/v1/water-quality", tags=["Water Quality"])
app.include_router(kill_switch.router, prefix="/api/v1/kill-switch", tags=["Kill Switch"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["Predictions"])
app.include_router(districts.router, prefix="/api/v1/districts", tags=["Districts"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(metros.router, prefix="/api/v1/metros", tags=["Metros"])
app.include_router(data_sources.router, prefix="/api/v1/data-sources", tags=["Data Sources"])
app.include_router(recommendations.router, prefix="/api/v1/recommendations", tags=["AI Recommendations"])
app.include_router(evidence.router, prefix="/api/v1/evidence", tags=["Evidence"])
