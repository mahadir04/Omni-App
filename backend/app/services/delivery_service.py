"""Delivery service — sends replies back to the originating platform.

Dispatches to real platform adapters (Slack, Twilio WhatsApp/SMS) when configured,
or gracefully records local delivery.
"""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.audit_service import log_action
from app.websocket import ws_manager

logger = logging.getLogger(__name__)


from app.models.platform_connection import PlatformConnection


async def _dispatch_to_platform(
    db: AsyncSession,
    user_id: uuid.UUID,
    platform: str,
    recipient_handle: str,
    content: str,
) -> str:
    """Send message via platform API if credentials are provided."""
    # Look up connection token if stored in database
    conn_res = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == user_id,
            PlatformConnection.platform == platform,
        )
    )
    conn = conn_res.scalars().first()
    access_token = conn.access_token_enc if conn else None

    # ── Telegram ─────────────────────────────────────────────────────────
    if platform == "telegram":
        token = access_token or getattr(settings, "telegram_bot_token", None)
        if token and token != "mock-token":
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json={"chat_id": recipient_handle, "text": content},
                    )
                    if res.status_code == 200 and res.json().get("ok"):
                        return "delivered_telegram"
                    logger.warning(f"Telegram sendMessage failed: {res.text}")
            except Exception as e:
                logger.error(f"Error dispatching to Telegram: {e}")

    # ── Messenger ────────────────────────────────────────────────────────
    if platform == "messenger":
        token = access_token or getattr(settings, "meta_page_access_token", None)
        if token and token != "mock-token":
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        "https://graph.facebook.com/v19.0/me/messages",
                        params={"access_token": token},
                        json={
                            "recipient": {"id": recipient_handle},
                            "message": {"text": content},
                        },
                    )
                    if res.status_code in (200, 201):
                        return "delivered_messenger"
                    logger.warning(f"Messenger dispatch failed: {res.text}")
            except Exception as e:
                logger.error(f"Error dispatching to Messenger: {e}")

    # ── Slack ────────────────────────────────────────────────────────────
    if platform == "slack":
        token = access_token or settings.slack_bot_token
        if token and token != "mock-token":
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        "https://slack.com/api/chat.postMessage",
                        headers={"Authorization": f"Bearer {token}"},
                        json={"channel": recipient_handle, "text": content},
                    )
                    data = res.json()
                    if data.get("ok"):
                        return "delivered_slack"
                    logger.warning(f"Slack postMessage failed: {data.get('error')}")
            except Exception as e:
                logger.error(f"Error dispatching to Slack: {e}")

    # ── Twilio (WhatsApp & SMS) ──────────────────────────────────────────
    if platform in ("whatsapp", "sms") and settings.twilio_account_sid and settings.twilio_auth_token:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
            from_number = settings.twilio_phone_number or ""
            if platform == "whatsapp" and not from_number.startswith("whatsapp:"):
                from_number = f"whatsapp:{from_number}"
            to_number = recipient_handle
            if platform == "whatsapp" and not to_number.startswith("whatsapp:"):
                to_number = f"whatsapp:{to_number}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    url,
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                    data={"From": from_number, "To": to_number, "Body": content},
                )
                if res.status_code in (200, 201):
                    return f"delivered_{platform}"
                logger.warning(f"Twilio message send returned {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Error dispatching to Twilio: {e}")

    return "delivered_local"


async def send_reply(
    db: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    platform: str,
    content: str,
    sender: str = "ai",  # "ai" for auto-send, "user" for approved sends
    action_type: str = "auto_send",  # audit log action type
) -> Message:
    """Send a reply to the originating platform.

    1. Retrieves recipient handle
    2. Dispatches to real external API (if configured) or local delivery
    3. Stores outbound message in database
    4. Updates conversation metadata
    5. Records audit log
    6. Broadcasts via WebSocket
    """
    now = datetime.utcnow()

    # Lookup contact handle for destination
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conv_result.scalar_one_or_none()
    recipient_handle = ""
    if conversation:
        contact_result = await db.execute(
            select(Contact).where(Contact.id == conversation.contact_id)
        )
        contact = contact_result.scalar_one_or_none()
        if contact:
            recipient_handle = contact.platform_handle

    # Dispatch to platform
    delivery_status = await _dispatch_to_platform(
        db, user_id, platform, recipient_handle, content
    )

    # Store outbound message
    outbound_msg = Message(
        conversation_id=conversation_id,
        direction="outbound",
        sender=sender,
        content=content,
        sent_at=now,
    )
    db.add(outbound_msg)

    if conversation:
        conversation.last_message_at = now
        # When user/ai replies, conversation status is active
        conversation.status = "open"

    await db.flush()

    # Audit log per TRD §5
    await log_action(
        db,
        user_id=user_id,
        actor="system" if action_type == "auto_send" else "user",
        action=action_type,
        conversation_id=conversation_id,
        message_id=outbound_msg.id,
        details={
            "platform": platform,
            "recipient": recipient_handle,
            "content_preview": content[:200],
            "delivery_status": delivery_status,
        },
    )

    await db.commit()
    await db.refresh(outbound_msg)

    # Broadcast WebSocket event so UI updates immediately
    await ws_manager.send_to_user(
        user_id,
        "new_message",
        {
            "conversation_id": str(conversation_id),
            "message_id": str(outbound_msg.id),
            "platform": platform,
            "sender_name": "You" if sender == "user" else "Omni AI",
            "content": content[:100],
            "sent_at": now.isoformat(),
            "direction": "outbound",
            "sender": sender,
        },
    )

    return outbound_msg
