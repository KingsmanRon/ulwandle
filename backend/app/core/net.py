"""
Client-IP resolution.

Behind Render/Vercel/most PaaS proxies, ``request.client.host`` is the proxy's
IP — identical for every caller. Keying rate limits or hashing audit-trail IPs
on that value makes per-client limits global and the audit IP useless. When
``BEHIND_PROXY`` is set we trust the platform's ``X-Forwarded-For`` header and
take the left-most entry (the original client). When not behind a proxy we use
the socket peer, which can't be spoofed.
"""

from __future__ import annotations

from starlette.requests import Request

from app.core.config import settings


def get_client_ip(request: Request) -> str:
    """Best-effort real client IP for rate limiting and audit hashing."""
    if settings.BEHIND_PROXY:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # "client, proxy1, proxy2" — the first hop is the original client.
            first = xff.split(",")[0].strip()
            if first:
                return first
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit_key(request: Request) -> str:
    """slowapi key function — see get_client_ip."""
    return get_client_ip(request)
