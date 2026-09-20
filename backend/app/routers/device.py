"""Device Bridge Router — Android companion app integration.

Endpoints:
  POST /api/device/register       — Pair Android device with a user account
  POST /api/device/message        — Receive notification captured from phone
  POST /api/device/reply-ack      — Phone confirms reply was dispatched (or failed)
  GET  /api/device/status         — List registered devices (browser UI)
  DELETE /api/device/{device_id}  — Unpair a device

WebSocket endpoint (registered in main.py):
  GET  /ws/device/{device_id}?secret={device_secret}
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbSession
from app.models.device_connection import DeviceConnection
from app.schemas.device import (
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    DeviceMessagePayload,
    DeviceReplyAck,
    DeviceStatusResponse,
)
from app.services.audit_service import log_action
from app.services.ingestion_service import ingest_message
from app.tasks.ai_tasks import process_message_ai, process_message_sync
from app.websocket.device_ws import device_ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/device", tags=["device"])

# Supported platforms via phone bridge (no cloud API tokens required)
PHONE_BRIDGE_PLATFORMS = {"whatsapp", "messenger", "instagram", "sms"}


# ── Auth helper ───────────────────────────────────────────────────────────────

def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


async def _authenticate_device(
    db: AsyncSession, device_id: str, device_secret: str
) -> DeviceConnection:
    """Validate device credentials. Raises 401 on failure."""
    result = await db.execute(
        select(DeviceConnection).where(DeviceConnection.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device or device.device_secret_hash != _hash_secret(device_secret):
        raise HTTPException(status_code=401, detail="Invalid device credentials")
    return device


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=DeviceRegisterResponse, status_code=201)
async def register_device(
    body: DeviceRegisterRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Register an Android companion device with the current user's account.

    Returns a one-time device_secret — store it in Android EncryptedSharedPreferences.
    """
    device_id = str(uuid.uuid4())
    raw_secret = os.urandom(32).hex()  # 64-char hex

    device = DeviceConnection(
        user_id=current_user.id,
        device_id=device_id,
        device_secret_hash=_hash_secret(raw_secret),
        device_name=body.device_name,
        metadata_=body.metadata_ or {},
    )
    db.add(device)

    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="device_registered",
        details={"device_name": body.device_name, "device_id": device_id},
    )
    await db.commit()

    logger.info(f"Device registered: {device_id} ({body.device_name}) for user {current_user.id}")
    return DeviceRegisterResponse(device_id=device_id, device_secret=raw_secret)


@router.post("/message")
async def receive_device_message(body: DeviceMessagePayload, db: DbSession):
    """Receive a notification payload captured by the Android NotificationListenerService.

    Flow:
    1. Authenticate device
    2. Ingest message into unified pipeline (Contact → Conversation → Message)
    3. Update conversation metadata with bridge routing info (device_id + notification_key)
    4. Run AI pipeline + Automation Engine asynchronously
    """
    if body.platform not in PHONE_BRIDGE_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Platform '{body.platform}' not supported via phone bridge. "
                   f"Supported: {sorted(PHONE_BRIDGE_PLATFORMS)}",
        )

    device = await _authenticate_device(db, body.device_id, body.device_secret)

    # Bridge metadata stored in conversation — used by delivery_service to route replies
    bridge_metadata = {
        "source": "phone_bridge",
        "device_id": body.device_id,
        "notification_key": body.notification_key,
        "app_package": body.app_package or "",
    }

    # Use notification_key as platform_msg_id for dedup (unique per notification)
    message, conversation, contact = await ingest_message(
        db,
        user_id=device.user_id,
        platform=body.platform,
        sender_name=body.sender_name,
        sender_handle=body.sender_handle,
        content=body.content,
        platform_msg_id=body.notification_key,
        raw_payload={
            "notification_key": body.notification_key,
            "app_package": body.app_package,
            "timestamp_ms": body.timestamp_ms,
        },
        bridge_metadata=bridge_metadata,
    )

    # Update device heartbeat
    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()

    # Run AI pipeline (intent, sentiment, suggested reply, automation decision)
    try:
        process_message_ai.delay(str(message.id), str(device.user_id))
    except Exception as e:
        logger.warning(f"Celery dispatch failed ({e}), falling back to sync processing")
        await process_message_sync(message.id, device.user_id)

    return {
        "status": "processed",
        "message_id": str(message.id),
        "conversation_id": str(conversation.id),
    }


@router.post("/reply-ack")
async def reply_ack(body: DeviceReplyAck, db: DbSession):
    """Android app confirms a reply was dispatched (or reports a failure).

    status: "sent"      — RemoteInput fired, message sent through app
    status: "failed"    — RemoteInput expired or notification dismissed
    status: "dismissed" — User dismissed the notification before reply was sent
    """
    device = await _authenticate_device(db, body.device_id, body.device_secret)

    device.last_seen_at = datetime.now(timezone.utc)

    conv_id = None
    if body.conversation_id:
        try:
            conv_id = uuid.UUID(body.conversation_id)
        except (ValueError, TypeError):
            pass

    await log_action(
        db,
        user_id=device.user_id,
        actor="system",
        action=f"phone_bridge_reply_{body.status}",
        conversation_id=conv_id,
        details={
            "device_id": body.device_id,
            "status": body.status,
            "error": body.error,
        },
    )
    await db.commit()

    return {"status": "ok", "ack": body.status}


@router.get("/pairing-info")
async def get_pairing_info(
    request: Request,
    current_user: CurrentUser,
    server_host: str | None = None,
):
    """Generate pairing URL, token, and deep link for Android app registration."""
    from app.services.auth_service import create_access_token
    token = create_access_token(str(current_user.id))
    
    # Use specified server_host or fallback to request base url
    if server_host and server_host.strip():
        server_url = server_host.strip().rstrip("/")
    else:
        server_url = str(request.base_url).rstrip("/")
        # If running on localhost inside docker/desktop, default to port 8000
        if "localhost" in server_url or "127.0.0.1" in server_url:
            # Android phones on the same Wi-Fi need LAN IP or host IP
            server_url = "http://192.168.0.100:8000"

    deep_link = f"omni://pair?server={server_url}&token={token}"
    return {
        "server_url": server_url,
        "token": token,
        "deep_link": deep_link,
        "user_email": current_user.email,
    }


@router.get("/status", response_model=list[DeviceStatusResponse])
async def list_devices(db: DbSession, current_user: CurrentUser):
    """List all registered bridge devices for the current user (for the web UI)."""
    result = await db.execute(
        select(DeviceConnection).where(DeviceConnection.user_id == current_user.id)
    )
    devices = result.scalars().all()
    return [
        DeviceStatusResponse(
            device_id=d.device_id,
            device_name=d.device_name,
            is_online=device_ws_manager.is_online(d.device_id),
            last_seen_at=d.last_seen_at,
            created_at=d.created_at,
        )
        for d in devices
    ]


@router.delete("/{device_id}", status_code=204)
async def delete_device(device_id: str, db: DbSession, current_user: CurrentUser):
    """Unpair a device. Closes its WebSocket if connected."""
    result = await db.execute(
        select(DeviceConnection).where(
            DeviceConnection.device_id == device_id,
            DeviceConnection.user_id == current_user.id,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device_ws_manager.disconnect(device_id)
    await db.delete(device)
    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="device_unpaired",
        details={"device_id": device_id, "device_name": device.device_name},
    )
    await db.commit()


# ── WebSocket handler (called from main.py) ───────────────────────────────────

async def device_websocket_handler(
    websocket: WebSocket,
    device_id: str,
    secret: str,
    db: AsyncSession,
):
    """Persistent WebSocket connection from the Android companion app.

    Auth: device_id in path, device_secret as query param ?secret=...
    Protocol:
      - Server sends: {"event": "reply_push", "data": {...}}
      - Client sends: {"event": "ping"} or {"event": "ack", "data": {...}}
    """
    # Authenticate before accepting
    result = await db.execute(
        select(DeviceConnection).where(DeviceConnection.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device or device.device_secret_hash != _hash_secret(secret):
        await websocket.close(code=4001, reason="Invalid device credentials")
        return

    await device_ws_manager.connect(websocket, device_id)

    # Mark online
    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                import json
                msg = json.loads(raw)
                event = msg.get("event")
                if event == "ping":
                    await websocket.send_text('{"event":"pong"}')
                    device.last_seen_at = datetime.now(timezone.utc)
                    await db.commit()
            except Exception:
                pass  # Ignore malformed frames
    except WebSocketDisconnect:
        device_ws_manager.disconnect(device_id)
        logger.info(f"Device WebSocket disconnected: {device_id}")
