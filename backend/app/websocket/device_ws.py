"""Device WebSocket manager — manages persistent connections from Android bridge devices.

Events pushed TO device:
  - reply_push: content to deliver via RemoteInput + notification_key to route it

Events received FROM device (via ws.receive_text):
  - ping: keepalive heartbeat
  - ack: reply was sent or failed
"""

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class DeviceConnectionManager:
    """Per-device WebSocket connections (one device = one connection at a time)."""

    def __init__(self):
        # device_id → active WebSocket
        self._connections: dict[str, WebSocket] = {}
        # device_id → list of payloads queued while device was offline
        self._offline_queue: dict[str, list[dict]] = {}

    # ── Connection lifecycle ──────────────────────────────────────────────

    async def connect(self, websocket: WebSocket, device_id: str) -> None:
        await websocket.accept()
        # Disconnect any stale connection for the same device
        if device_id in self._connections:
            try:
                await self._connections[device_id].close()
            except Exception:
                pass
        self._connections[device_id] = websocket
        logger.info(f"Device connected: {device_id}")

        # Flush offline queue
        if device_id in self._offline_queue:
            queued = self._offline_queue.pop(device_id)
            for payload in queued:
                await self._send(device_id, payload)
            logger.info(f"Flushed {len(queued)} queued replies to device {device_id}")

    def disconnect(self, device_id: str) -> None:
        self._connections.pop(device_id, None)
        logger.info(f"Device disconnected: {device_id}")

    # ── Send reply to device ──────────────────────────────────────────────

    async def send_reply_push(
        self,
        device_id: str,
        notification_key: str,
        content: str,
        conversation_id: str,
        platform: str,
    ) -> bool:
        """Push a reply to the Android device. Returns True if delivered live, False if queued."""
        payload = {
            "event": "reply_push",
            "data": {
                "notification_key": notification_key,
                "content": content,
                "conversation_id": conversation_id,
                "platform": platform,
            },
        }
        if device_id in self._connections:
            await self._send(device_id, payload)
            return True
        else:
            # Queue for when device reconnects
            if device_id not in self._offline_queue:
                self._offline_queue[device_id] = []
            self._offline_queue[device_id].append(payload)
            logger.info(f"Reply queued for offline device {device_id}")
            return False

    async def send_event(self, device_id: str, event: str, data: Any) -> None:
        """Generic event push to a device."""
        await self._send(device_id, {"event": event, "data": data})

    async def _send(self, device_id: str, payload: dict) -> None:
        ws = self._connections.get(device_id)
        if not ws:
            return
        try:
            await ws.send_text(json.dumps(payload, default=str))
        except Exception as e:
            logger.warning(f"Failed to send to device {device_id}: {e}")
            self.disconnect(device_id)

    # ── Status ────────────────────────────────────────────────────────────

    def is_online(self, device_id: str) -> bool:
        return device_id in self._connections

    def queue_length(self, device_id: str) -> int:
        return len(self._offline_queue.get(device_id, []))


# Singleton
device_ws_manager = DeviceConnectionManager()
