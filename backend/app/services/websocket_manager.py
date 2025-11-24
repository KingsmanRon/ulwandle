"""
WebSocket Manager for Real-time Communications
Handles live notifications to employees and dashboard updates
"""

from fastapi import WebSocket
from typing import Dict, List
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        """Initialize WebSocket manager"""
        self.active_connections: Dict[str, WebSocket] = {}
        self.employee_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        """
        Accept new WebSocket connection

        Args:
            websocket: WebSocket connection
            client_id: Unique client identifier
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")

        # Send welcome message
        await self.send_personal_message(
            json.dumps({
                "type": "connection",
                "status": "connected",
                "client_id": client_id,
                "timestamp": datetime.utcnow().isoformat()
            }),
            client_id
        )

    def disconnect(self, client_id: str):
        """
        Remove WebSocket connection

        Args:
            client_id: Client identifier to disconnect
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

        if client_id in self.employee_connections:
            del self.employee_connections[client_id]

    async def send_personal_message(self, message: str, client_id: str):
        """
        Send message to specific client

        Args:
            message: Message to send
            client_id: Target client ID
        """
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {str(e)}")
                self.disconnect(client_id)

    async def broadcast(self, message: str, exclude: List[str] = None):
        """
        Broadcast message to all connected clients

        Args:
            message: Message to broadcast
            exclude: List of client IDs to exclude
        """
        exclude = exclude or []
        disconnected = []

        for client_id, connection in self.active_connections.items():
            if client_id not in exclude:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to {client_id}: {str(e)}")
                    disconnected.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected:
            self.disconnect(client_id)

    async def send_alert(self, alert_data: Dict, district_id: int = None):
        """
        Send alert notification to relevant clients

        Args:
            alert_data: Alert information
            district_id: Optional district ID to target specific area
        """
        message = json.dumps({
            "type": "alert",
            "data": alert_data,
            "district_id": district_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        await self.broadcast(message)
        logger.info(f"Alert broadcast: {alert_data.get('title', 'Unknown alert')}")

    async def send_valve_notification(
        self,
        valve_id: str,
        action: str,
        district_name: str,
        employees: List[str] = None
    ):
        """
        Send valve operation notification to employees

        Args:
            valve_id: Valve identifier
            action: Valve action (open/close)
            district_name: District name
            employees: List of employee IDs to notify
        """
        notification = {
            "type": "valve_operation",
            "valve_id": valve_id,
            "action": action,
            "district": district_name,
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Kill Switch activated: Valve {valve_id} in {district_name} - Action: {action}"
        }

        message = json.dumps(notification)

        # Send to specific employees if specified
        if employees:
            for employee_id in employees:
                await self.send_personal_message(message, f"employee_{employee_id}")
        else:
            # Broadcast to all employees
            await self.broadcast(message)

        logger.info(f"Valve notification sent: {valve_id} - {action}")

    async def send_water_quality_alert(
        self,
        district_id: int,
        district_name: str,
        status: str,
        quality_data: Dict
    ):
        """
        Send water quality alert

        Args:
            district_id: District ID
            district_name: District name
            status: Quality status (green/yellow/red)
            quality_data: Quality readings
        """
        alert = {
            "type": "water_quality",
            "district_id": district_id,
            "district_name": district_name,
            "status": status,
            "quality_data": quality_data,
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Water quality alert for {district_name}: Status changed to {status.upper()}"
        }

        if status == "red":
            alert["priority"] = "CRITICAL"
            alert["action_required"] = "Immediate action required - Water may be undrinkable"

        await self.broadcast(json.dumps(alert))
        logger.warning(f"Water quality alert: {district_name} - {status}")

    async def send_leak_detection(
        self,
        district_id: int,
        district_name: str,
        leak_data: Dict
    ):
        """
        Send leak detection notification

        Args:
            district_id: District ID
            district_name: District name
            leak_data: Leak information
        """
        notification = {
            "type": "leak_detected",
            "district_id": district_id,
            "district_name": district_name,
            "leak_data": leak_data,
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"Potential leak detected in {district_name}"
        }

        await self.broadcast(json.dumps(notification))
        logger.warning(f"Leak detection notification: {district_name}")

    async def send_prediction_update(
        self,
        district_id: int,
        district_name: str,
        prediction_data: Dict
    ):
        """
        Send consumption prediction update

        Args:
            district_id: District ID
            district_name: District name
            prediction_data: Prediction results
        """
        update = {
            "type": "prediction",
            "district_id": district_id,
            "district_name": district_name,
            "prediction_data": prediction_data,
            "timestamp": datetime.utcnow().isoformat()
        }

        await self.broadcast(json.dumps(update))
        logger.info(f"Prediction update sent: {district_name}")

    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)

    def get_connected_clients(self) -> List[str]:
        """Get list of connected client IDs"""
        return list(self.active_connections.keys())


# Singleton instance
websocket_manager = WebSocketManager()
