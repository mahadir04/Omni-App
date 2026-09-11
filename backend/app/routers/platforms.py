"""Platforms router — list, connect, disconnect, reconnect."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models.ai_analysis import AIAnalysis
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.platform_connection import PlatformConnection
from app.schemas.platform import PlatformConnectionResponse, PlatformConnectRequest
from app.services.audit_service import log_action
from app.websocket import ws_manager

router = APIRouter(prefix="/api/platforms", tags=["platforms"])

VALID_PLATFORMS = {"whatsapp", "slack", "email", "linkedin", "sms", "messenger"}


@router.get("", response_model=list[PlatformConnectionResponse])
async def list_platforms(db: DbSession, current_user: CurrentUser):
    """List all platform connections for the current user."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == current_user.id
        )
    )
    connections = result.scalars().all()
    return [
        PlatformConnectionResponse(
            id=c.id,
            platform=c.platform,
            status=c.status,
            external_account_id=c.external_account_id,
            metadata_=c.metadata_ or {},
            created_at=c.created_at,
        )
        for c in connections
    ]


@router.post("/connect", response_model=PlatformConnectionResponse, status_code=201)
async def connect_platform(
    body: PlatformConnectRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Connect a platform. Stores profile info and creates a welcome notification in messages."""
    if body.platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {body.platform}")

    account_handle = (body.external_account_id or "Connected Account").strip()
    profile_name = (body.profile_name or body.external_account_id or f"{body.platform.capitalize()} User").strip()

    meta = body.metadata_ or {}
    meta.update({
        "profile_name": profile_name,
        "account_id": account_handle,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    })

    try:
        # Check for existing connection by platform & user
        result = await db.execute(
            select(PlatformConnection).where(
                PlatformConnection.user_id == current_user.id,
                PlatformConnection.platform == body.platform,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            # Re-auth: update tokens + status + metadata
            existing.external_account_id = body.external_account_id
            existing.access_token_enc = body.access_token or "token"
            existing.refresh_token_enc = body.refresh_token
            existing.status = "connected"
            existing.metadata_ = meta
            await db.flush()
            conn = existing
        else:
            conn = PlatformConnection(
                user_id=current_user.id,
                platform=body.platform,
                external_account_id=body.external_account_id,
                access_token_enc=body.access_token or "token",
                refresh_token_enc=body.refresh_token,
                status="connected",
                metadata_=meta,
            )
            db.add(conn)
            await db.flush()

        # ── Create / Retrieve System Contact for this Platform ───────────
        contact_res = await db.execute(
            select(Contact).where(
                Contact.user_id == current_user.id,
                Contact.platform == body.platform,
                Contact.platform_handle == f"system@{body.platform}",
            )
        )
        contact = contact_res.scalar_one_or_none()
        if not contact:
            contact = Contact(
                user_id=current_user.id,
                display_name=f"{body.platform.capitalize()} Assistant",
                platform=body.platform,
                platform_handle=f"system@{body.platform}",
                avatar_url=None,
            )
            db.add(contact)
            await db.flush()

        # ── Create or Find Welcome Notification Conversation & Message ───
        conv_res = await db.execute(
            select(Conversation).where(
                Conversation.user_id == current_user.id,
                Conversation.contact_id == contact.id,
            )
        )
        conv = conv_res.scalar_one_or_none()
        now_dt = datetime.utcnow()
        if not conv:
            conv = Conversation(
                user_id=current_user.id,
                contact_id=contact.id,
                platform=body.platform,
                status="open",
                label="action",
                unread_count=1,
                last_message_at=now_dt,
            )
            db.add(conv)
            await db.flush()
        else:
            conv.unread_count = (conv.unread_count or 0) + 1
            conv.last_message_at = now_dt
            conv.status = "open"

        welcome_text = (
            f"🎉 **{body.platform.capitalize()} Connected Successfully!**\n\n"
            f"Your profile **{profile_name}** ({account_handle}) is now linked to Omni. "
            f"All incoming messages, client queries, and notifications will be synchronized in real-time "
            f"with AI sentiment tracking, action extraction, and automated reply drafts."
        )

        msg = Message(
            conversation_id=conv.id,
            direction="inbound",
            sender="contact",
            content=welcome_text,
            platform_msg_id=f"conn_notify_{uuid.uuid4()}",
        )
        db.add(msg)
        await db.flush()

        # AI Analysis for the welcome notification
        ai_ana = AIAnalysis(
            message_id=msg.id,
            intent="platform_connected",
            sentiment="positive",
            confidence=Decimal("99.00"),
            suggested_reply=f"Thank you! Ready to manage {body.platform.capitalize()} messages.",
            key_action=f"Synchronize {body.platform.capitalize()} inbox",
            requires_human_review=False,
        )
        db.add(ai_ana)

        await log_action(
            db,
            user_id=current_user.id,
            actor="user",
            action="connect_platform",
            details={"platform": body.platform, "account": body.external_account_id, "profile": profile_name},
        )
        await db.commit()
        await db.refresh(conn)

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to connect platform: {str(e)}")

    # ── Broadcast WebSocket Event ────────────────────────────────────────
    await ws_manager.send_to_user(
        current_user.id,
        "new_message",
        {
            "conversation_id": str(conv.id),
            "platform": body.platform,
            "message": {
                "id": str(msg.id),
                "content": welcome_text,
                "sender": "contact",
            },
        },
    )
    await ws_manager.send_to_user(
        current_user.id,
        "notification",
        {
            "title": f"{body.platform.capitalize()} Connected",
            "body": f"Profile {profile_name} is now active.",
            "conversation_id": str(conv.id),
        },
    )

    return PlatformConnectionResponse(
        id=conn.id,
        platform=conn.platform,
        status=conn.status,
        external_account_id=conn.external_account_id,
        metadata_=conn.metadata_ or {},
        created_at=conn.created_at,
    )


@router.delete("/{connection_id}", status_code=204)
async def disconnect_platform(
    connection_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """Disconnect a platform."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.id == connection_id,
            PlatformConnection.user_id == current_user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    await db.delete(conn)
    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="disconnect_platform",
        details={"platform": conn.platform},
    )
    await db.commit()


@router.post("/{connection_id}/reconnect", response_model=PlatformConnectionResponse)
async def reconnect_platform(
    connection_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """Trigger re-auth for a platform (stub — returns OAuth URL in production)."""
    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.id == connection_id,
            PlatformConnection.user_id == current_user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Platform connection not found")

    conn.status = "reauth_required"
    await db.commit()
    await db.refresh(conn)
    # TODO: Return OAuth URL for the platform
    return PlatformConnectionResponse(
        id=conn.id,
        platform=conn.platform,
        status=conn.status,
        external_account_id=conn.external_account_id,
        metadata_=conn.metadata_ or {},
        created_at=conn.created_at,
    )
