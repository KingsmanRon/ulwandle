"""
WebSocket manager. Connections are authenticated via JWT before being
admitted. Per-user, per-role, and broadcast channels are supported.
"""

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:

    def __init__(self) -> None:
        # user_id -> list of websockets (a user may have multiple devices)
        self._by_user: dict[int, list[WebSocket]] = defaultdict(list)
        self._by_role: dict[str, list[WebSocket]] = defaultdict(list)

    async def attach(self, websocket: WebSocket, user_id: int, role: str) -> None:
        await websocket.accept()
        self._by_user[user_id].append(websocket)
        self._by_role[role].append(websocket)
        await self._send(websocket, {
            "type": "connection",
            "status": "connected",
            "ts": _now_iso(),
        })

    def detach(self, websocket: WebSocket, user_id: int, role: str) -> None:
        for store in (self._by_user.get(user_id, []), self._by_role.get(role, [])):
            try:
                store.remove(websocket)
            except ValueError:
                pass

    async def _send(self, ws: WebSocket, payload: dict[str, Any]) -> None:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            logger.warning("WebSocket send failed", exc_info=True)

    async def broadcast(self, payload: dict[str, Any], roles: tuple[str, ...] | None = None) -> None:
        targets: set[WebSocket] = set()
        if roles is None:
            for ws_list in self._by_role.values():
                targets.update(ws_list)
        else:
            for role in roles:
                targets.update(self._by_role.get(role, []))
        for ws in list(targets):
            await self._send(ws, payload)

    async def send_to_user(self, user_id: int, payload: dict[str, Any]) -> None:
        for ws in list(self._by_user.get(user_id, [])):
            await self._send(ws, payload)

    # ---------- Domain notifications ----------

    async def send_valve_notification(self, valve_id: str, action: str,
                                      district_name: str,
                                      employee_ids: list[str] | None = None) -> None:
        payload = {
            "type": "valve_operation",
            "valve_id": valve_id,
            "action": action,
            "district": district_name,
            "ts": _now_iso(),
        }
        # Restrict to operator/supervisor/admin/employee dashboards.
        await self.broadcast(payload, roles=("admin", "supervisor", "operator"))

    async def send_water_quality_alert(self, district_id: int, district_name: str,
                                       quality_status: str, payload: dict[str, Any]) -> None:
        msg = {
            "type": "water_quality",
            "district_id": district_id,
            "district_name": district_name,
            "status": quality_status,
            "data": payload,
            "ts": _now_iso(),
        }
        await self.broadcast(msg, roles=("admin", "supervisor", "operator", "viewer"))

    async def send_leak_detection(self, district_id: int, district_name: str,
                                  leak_data: dict[str, Any]) -> None:
        await self.broadcast({
            "type": "leak_detected",
            "district_id": district_id,
            "district_name": district_name,
            "leak": leak_data,
            "ts": _now_iso(),
        }, roles=("admin", "supervisor", "operator"))

    async def send_prediction_update(self, district_id: int, district_name: str,
                                     prediction: dict[str, Any]) -> None:
        await self.broadcast({
            "type": "prediction",
            "district_id": district_id,
            "district_name": district_name,
            "prediction": prediction,
            "ts": _now_iso(),
        }, roles=("admin", "supervisor", "operator", "viewer"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


websocket_manager = WebSocketManager()
