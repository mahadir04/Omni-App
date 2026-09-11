"""WebSocket manager — broadcasts real-time events to connected clients."""

import json
import uuid
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages per-user WebSocket connections for real-time inbox updates.
    
    Events pushed:
    - new_message: when an inbound message is ingested
    - ai_analysis_ready: when AI analysis completes for a message
    - notification: for VIP alerts, negative sentiment alerts, etc.
    """

    def __init__(self):
        # user_id -> list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self._connections:
            self._connections[user_id] = [
                ws for ws in self._connections[user_id] if ws is not websocket
            ]
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_to_user(self, user_id: str | uuid.UUID, event: str, data: Any):
        """Broadcast an event to all of a user's active connections."""
        uid = str(user_id)
        if uid not in self._connections:
            return
        payload = json.dumps({"event": event, "data": data}, default=str)
        dead = []
        for ws in self._connections[uid]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        # Clean up broken connections
        for ws in dead:
            self.disconnect(ws, uid)


# Singleton instance
ws_manager = ConnectionManager()
