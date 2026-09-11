"""Webhooks router — receives live inbound platform events + dev simulate endpoint."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import CurrentUser, DbSession
from app.models.platform_connection import PlatformConnection
from app.models.user import User
from app.schemas.message import SimulateMessageRequest
from app.services.ingestion_service import ingest_message
from app.tasks.ai_tasks import process_message_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["webhooks"])


async def _resolve_webhook_user(db: AsyncSession, platform: str) -> User | None:
    """Find the user associated with this platform connection, or default to the primary user."""
    res = await db.execute(
        select(PlatformConnection).where(PlatformConnection.platform == platform)
    )
    conn = res.scalars().first()
    if conn:
        user_res = await db.execute(select(User).where(User.id == conn.user_id))
        user = user_res.scalar_one_or_none()
        if user:
            return user

    # Fallback to the first registered user
    fallback = await db.execute(select(User).limit(1))
    return fallback.scalars().first()


@router.get("/webhooks/{platform}")
async def verify_webhook(platform: str, request: Request):
    """Handle Meta / Messenger / WhatsApp webhook verification challenge."""
    params = request.query_params
    hub_mode = params.get("hub.mode")
    hub_challenge = params.get("hub.challenge")
    hub_verify_token = params.get("hub.verify_token")

    if hub_mode == "subscribe" and hub_challenge:
        # Return challenge as plain text
        return Response(content=hub_challenge, media_type="text/plain")
    return {"status": "ok", "platform": platform}


@router.post("/webhooks/{platform}")
async def receive_webhook(platform: str, request: Request, db: DbSession):
    """Receive live inbound webhook from an external platform (Twilio, Slack, Messenger, Email, etc.)."""
    content_type = request.headers.get("content-type", "")

    sender_name = "Incoming Contact"
    sender_handle = "unknown"
    content = ""
    platform_msg_id = None
    raw_payload = None

    # ── 1. Parse platform payload ────────────────────────────────────────
    if "application/json" in content_type:
        try:
            body = await request.json()
            raw_payload = body

            # Slack URL verification challenge during app setup
            if body.get("type") == "url_verification":
                return {"challenge": body.get("challenge")}

            if platform == "slack" and "event" in body:
                event = body.get("event", {})
                # Ignore bot echoes to prevent loops
                if event.get("bot_id") or event.get("subtype") == "bot_message":
                    return {"status": "ignored_bot_event"}

                content = event.get("text", "")
                sender_handle = event.get("user", "slack_user")
                sender_name = f"Slack User ({sender_handle})"
                platform_msg_id = event.get("client_msg_id") or event.get("ts")
            elif platform == "telegram":
                # Telegram Bot webhook payload
                tg_msg = body.get("message") or body.get("channel_post") or body.get("edited_message") or {}
                content = tg_msg.get("text") or tg_msg.get("caption") or ""
                tg_from = tg_msg.get("from", {})
                tg_chat = tg_msg.get("chat", {})
                sender_handle = str(tg_chat.get("id") or tg_from.get("id") or "telegram_user")
                first_name = tg_from.get("first_name", "")
                last_name = tg_from.get("last_name", "")
                username = tg_from.get("username", "")
                sender_name = f"{first_name} {last_name}".strip() or (f"@{username}" if username else f"Telegram User {sender_handle}")
                platform_msg_id = str(tg_msg.get("message_id") or uuid.uuid4())
            elif platform == "messenger" and "entry" in body:
                # Meta / Facebook Messenger webhook payload format
                entries = body.get("entry", [])
                for entry in entries:
                    for messaging in entry.get("messaging", []):
                        if "message" in messaging:
                            msg_obj = messaging.get("message", {})
                            content = msg_obj.get("text", "")
                            platform_msg_id = msg_obj.get("mid")
                            sender_handle = str(messaging.get("sender", {}).get("id", "messenger_user"))
                            sender_name = f"Messenger User ({sender_handle[-4:] if len(sender_handle) >= 4 else sender_handle})"
                            break
            elif platform == "whatsapp" and "entry" in body:
                # Meta WhatsApp Cloud API webhook payload
                entries = body.get("entry", [])
                for entry in entries:
                    for change in entry.get("changes", []):
                        value = change.get("value", {})
                        contacts_list = value.get("contacts", [])
                        contact_profile = contacts_list[0].get("profile", {}).get("name") if contacts_list else None
                        for msg_item in value.get("messages", []):
                            content = msg_item.get("text", {}).get("body", "")
                            sender_handle = str(msg_item.get("from", "whatsapp_user"))
                            sender_name = contact_profile or f"WhatsApp ({sender_handle})"
                            platform_msg_id = str(msg_item.get("id") or uuid.uuid4())
                            break
            else:
                # Generic JSON / Postmark / SendGrid / Custom
                content = (
                    body.get("content")
                    or body.get("text")
                    or body.get("TextBody")
                    or body.get("message")
                    or ""
                )
                sender_handle = body.get("sender_handle") or body.get("from") or body.get("From") or "unknown"
                sender_name = body.get("sender_name") or body.get("name") or sender_handle
                platform_msg_id = body.get("platform_msg_id") or body.get("id")

        except Exception as e:
            logger.error(f"Failed to parse JSON webhook: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        # Twilio WhatsApp / SMS webhook format
        form = await request.form()
        raw_payload = dict(form)
        content = str(form.get("Body", "")).strip()
        sender_handle = str(form.get("From", "")).strip()
        sender_name = str(form.get("ProfileName", "")).strip() or sender_handle
        platform_msg_id = str(form.get("MessageSid", "")).strip()
    else:
        # Raw text fallback
        raw_bytes = await request.body()
        content = raw_bytes.decode("utf-8", errors="ignore")

    if not content:
        return {"status": "ignored_empty_content"}

    # ── 2. Identify target user ──────────────────────────────────────────
    user = await _resolve_webhook_user(db, platform)
    if not user:
        logger.warning(f"No user found to route inbound webhook for {platform}")
        return {"status": "no_active_user"}

    # ── 3. Ingest into unified pipeline ──────────────────────────────────
    message, conversation, contact = await ingest_message(
        db,
        user_id=user.id,
        platform=platform,
        sender_name=sender_name,
        sender_handle=sender_handle,
        content=content,
        platform_msg_id=platform_msg_id or str(uuid.uuid4()),
        raw_payload=raw_payload,
    )

    # ── 4. Process AI analysis & Autopilot / Review decision ─────────────
    await process_message_sync(message.id, user.id)

    # ── 5. Return platform-compatible receipt ────────────────────────────
    if platform in ("whatsapp", "sms") and ("form-urlencoded" in content_type or "multipart" in content_type):
        return Response(content="<Response></Response>", media_type="application/xml")

    return {
        "status": "processed",
        "message_id": str(message.id),
        "conversation_id": str(conversation.id),
    }


@router.post("/dev/simulate-message")
async def simulate_message(
    body: SimulateMessageRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Simulate an inbound message for end-to-end pipeline testing."""
    # 1. Ingest the message
    message, conversation, contact = await ingest_message(
        db,
        user_id=current_user.id,
        platform=body.platform,
        sender_name=body.sender_name,
        sender_handle=body.sender_handle,
        content=body.content,
        platform_msg_id=body.platform_msg_id or str(uuid.uuid4()),
    )

    # 2. Run AI pipeline + automation decision
    await process_message_sync(message.id, current_user.id)

    return {
        "status": "processed",
        "message_id": str(message.id),
        "conversation_id": str(conversation.id),
        "contact_id": str(contact.id),
    }
