"""
Small JSON cache: Redis primary, in-process fallback.

Used for Claude recommendation payloads. With Redis (Upstash in prod) the cache
survives Render free-tier spin-downs and is shared across the gunicorn workers,
so repeated dashboard views don't each re-bill Anthropic. If Redis is
unreachable we degrade to a per-process dict rather than failing the request —
correctness over a cold cache.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:  # redis is a declared dependency, but degrade gracefully if missing.
    import redis as _redis
except Exception:  # pragma: no cover
    _redis = None


class JsonCache:
    def __init__(self, namespace: str) -> None:
        self._ns = namespace
        self._client = None
        self._mem: dict[str, tuple[float, dict]] = {}
        if _redis is not None:
            try:
                client = _redis.Redis.from_url(
                    settings.REDIS_URL,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                    decode_responses=True,
                )
                client.ping()
                self._client = client
                logger.info("JsonCache[%s]: backed by Redis", namespace)
            except Exception:
                logger.warning(
                    "JsonCache[%s]: Redis unavailable; using in-process fallback",
                    namespace)

    def _key(self, key: str) -> str:
        return f"ulw:{self._ns}:{key}"

    def get(self, key: str) -> Optional[dict]:
        rk = self._key(key)
        if self._client is not None:
            try:
                raw = self._client.get(rk)
                return json.loads(raw) if raw else None
            except Exception:
                logger.warning("JsonCache[%s]: Redis get failed; using fallback", self._ns)
        entry = self._mem.get(rk)
        if entry is None:
            return None
        expires_at, payload = entry
        if time.time() > expires_at:
            self._mem.pop(rk, None)
            return None
        return payload

    def put(self, key: str, payload: dict, ttl_seconds: int) -> None:
        rk = self._key(key)
        if self._client is not None:
            try:
                self._client.set(rk, json.dumps(payload), ex=ttl_seconds)
                return
            except Exception:
                logger.warning("JsonCache[%s]: Redis put failed; using fallback", self._ns)
        if len(self._mem) > 256:  # bound the fallback dict
            self._mem.clear()
        self._mem[rk] = (time.time() + ttl_seconds, payload)
