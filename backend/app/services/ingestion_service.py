"""Ingestion service — normalizes inbound messages from any platform,
creates/finds contacts and conversations, stores the message,
and triggers the AI pipeline.

This is the core of the "unified inbox" — every platform webhook
funnels through here into the same internal schema."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.websocket import ws_manager


async def ingest_message(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    platform: str,
    sender_name: str,
    sender_handle: str,
    content: str,
    platform_msg_id: str | None = None,
    raw_payload: dict | None = None,
    is_vip: bool = False,
) -> tuple[Message, Conversation, Contact]:
    """Normalize and store an inbound message. Returns (message, conversation, contact).

    Steps:
    1. Find or create Contact
    2. Find or create Conversation
    3. Create Message (idempotent via platform_msg_id unique constraint)
    4. Update conversation.last_message_at + unread_count
    5. Broadcast 'new_message' WebSocket event
    """

    # ── 1. Find or create Contact ────────────────────────────────────────
    result = await db.execute(
        select(Contact).where(
            Contact.user_id == user_id,
            Contact.platform == platform,
            Contact.platform_handle == sender_handle,
        )
    )
    contact = result.scalar_one_or_none()

    if contact is None:
        contact = Contact(
            user_id=user_id,
            display_name=sender_name,
            platform=platform,
            platform_handle=sender_handle,
            is_vip=is_vip,
        )
        db.add(contact)
        await db.flush()

    # Update last_seen
    now = datetime.utcnow()
    contact.last_seen_at = now

    # ── 2. Find or create Conversation ───────────────────────────────────
    result = await db.execute(
        select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.contact_id == contact.id,
            Conversation.platform == platform,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        conversation = Conversation(
            user_id=user_id,
            contact_id=contact.id,
            platform=platform,
            status="open",
        )
        db.add(conversation)
        await db.flush()

    # ── 3. Create Message ────────────────────────────────────────────────
    message = Message(
        conversation_id=conversation.id,
        direction="inbound",
        sender="contact",
        content=content,
        platform_msg_id=platform_msg_id,
        raw_payload=raw_payload,
        sent_at=now,
    )
    db.add(message)

    # ── 4. Update conversation metadata ──────────────────────────────────
    conversation.last_message_at = now
    conversation.unread_count += 1

    await db.commit()
    await db.refresh(message)
    await db.refresh(conversation)
    await db.refresh(contact)

    # ── 5. Broadcast WebSocket event ─────────────────────────────────────
    await ws_manager.send_to_user(
        user_id,
        "new_message",
        {
            "conversation_id": str(conversation.id),
            "message_id": str(message.id),
            "platform": platform,
            "sender_name": contact.display_name,
            "content": content[:100],  # preview
            "sent_at": now.isoformat(),
            "unread_count": conversation.unread_count,
        },
    )

    return message, conversation, contact
