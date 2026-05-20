"""
Prometheus metrics.

Exposes a multi-process-safe `/metrics` endpoint and a small middleware that
records request count + latency per (method, route, status). Route templates
(e.g. `/api/v1/metros/{metro_id}`) are used as labels — never raw paths —
to avoid label cardinality blowup on user input.
"""

from __future__ import annotations

import time
from typing import Awaitable, Callable

from fastapi import Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Gauge, Histogram,
    generate_latest,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import PlainTextResponse


REGISTRY = CollectorRegistry()

REQUESTS_TOTAL = Counter(
    "ulwandle_http_requests_total",
    "HTTP requests handled by the API.",
    labelnames=("method", "route", "status"),
    registry=REGISTRY,
)

REQUEST_LATENCY = Histogram(
    "ulwandle_http_request_duration_seconds",
    "Request latency in seconds.",
    labelnames=("method", "route"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=REGISTRY,
)

SCRAPER_RUNS_TOTAL = Counter(
    "ulwandle_scraper_runs_total",
    "Scraper run outcomes, labeled by source and status.",
    labelnames=("source", "status"),
    registry=REGISTRY,
)

SCRAPER_ROWS_LAST_RUN = Gauge(
    "ulwandle_scraper_rows_last_run",
    "Rows written by the most recent scraper run.",
    labelnames=("source",),
    registry=REGISTRY,
)

ALERTS_CREATED_TOTAL = Counter(
    "ulwandle_alerts_created_total",
    "Alerts created, labeled by type and level.",
    labelnames=("alert_type", "level"),
    registry=REGISTRY,
)

VALVE_OPERATIONS_TOTAL = Counter(
    "ulwandle_valve_operations_total",
    "Executed valve operations, labeled by action.",
    labelnames=("action",),
    registry=REGISTRY,
)


def _route_template(request: Request) -> str:
    """Return the FastAPI route template (`/api/v1/metros/{metro_id}`),
    not the raw URL path. Falls back to the raw path when no route matched
    (404s); in that case we use a static placeholder to cap cardinality."""
    route = request.scope.get("route")
    if route is not None and getattr(route, "path", None):
        return route.path
    return "__unmatched__"


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.url.path == "/metrics":
            return await call_next(request)
        start = time.perf_counter()
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            elapsed = time.perf_counter() - start
            route = _route_template(request)
            REQUEST_LATENCY.labels(request.method, route).observe(elapsed)
            REQUESTS_TOTAL.labels(request.method, route, str(status_code)).inc()


async def metrics_endpoint(_request: Request) -> Response:
    return PlainTextResponse(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
