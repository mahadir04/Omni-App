"""Messages router — draft actions: approve, edit-and-send, delay."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models.ai_analysis import AIAnalysis
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.message import ApproveRequest, DelaySendRequest, EditAndSendRequest
from app.services.audit_service import log_action
from app.services.delivery_service import send_reply

router = APIRouter(prefix="/api/conversations", tags=["messages"])


async def _get_latest_analysis(
    db, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Conversation, AIAnalysis]:
    """Helper: get conversation + its latest AI analysis."""
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Find latest inbound message's analysis
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id, Message.direction == "inbound")
        .order_by(Message.sent_at.desc())
        .limit(1)
    )
    last_inbound = msgs_result.scalar_one_or_none()
    if not last_inbound:
        raise HTTPException(status_code=400, detail="No inbound message to respond to")

    ai_result = await db.execute(
        select(AIAnalysis).where(AIAnalysis.message_id == last_inbound.id)
    )
    analysis = ai_result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=400, detail="AI analysis not yet available")

    return conv, analysis


@router.post("/{conversation_id}/approve")
async def approve_and_send(
    conversation_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """Approve & Send — sends the AI-drafted reply as-is.
    
    Per PRD FR3.1 and FR3.4: sends to originating platform.
    """
    conv, analysis = await _get_latest_analysis(db, conversation_id, current_user.id)

    if not analysis.suggested_reply:
        raise HTTPException(status_code=400, detail="No suggested reply available")

    outbound = await send_reply(
        db,
        conversation_id=conv.id,
        user_id=current_user.id,
        platform=conv.platform,
        content=analysis.suggested_reply,
        sender="user",
        action_type="approve_send",
    )

    return {
        "status": "sent",
        "message_id": str(outbound.id),
        "platform": conv.platform,
        "content": analysis.suggested_reply,
    }


@router.post("/{conversation_id}/edit-and-send")
async def edit_and_send(
    conversation_id: uuid.UUID,
    body: EditAndSendRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Custom Edit — send user-modified text.
    
    Per PRD FR3.2: opens draft in editable field, then sends.
    """
    conv, analysis = await _get_latest_analysis(db, conversation_id, current_user.id)

    outbound = await send_reply(
        db,
        conversation_id=conv.id,
        user_id=current_user.id,
        platform=conv.platform,
        content=body.content,
        sender="user",
        action_type="custom_edit",
    )

    return {
        "status": "sent",
        "message_id": str(outbound.id),
        "platform": conv.platform,
        "content": body.content,
        "original_draft": analysis.suggested_reply,
    }


@router.post("/{conversation_id}/delay")
async def delay_send(
    conversation_id: uuid.UUID,
    body: DelaySendRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """Delay Send — snooze the draft for a user-chosen time.
    
    Per PRD FR3.3: re-surfaces the draft later.
    In production, this would schedule a Celery task.
    """
    conv, analysis = await _get_latest_analysis(db, conversation_id, current_user.id)

    scheduled_for = datetime.now(timezone.utc) + timedelta(minutes=body.delay_minutes)

    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="delay_send",
        conversation_id=conv.id,
        details={
            "delay_minutes": body.delay_minutes,
            "scheduled_for": scheduled_for.isoformat(),
            "content_preview": analysis.suggested_reply[:200] if analysis.suggested_reply else None,
        },
    )
    await db.commit()

    # TODO: Schedule a Celery task to re-surface the draft at scheduled_for

    return {
        "status": "delayed",
        "scheduled_for": scheduled_for.isoformat(),
        "delay_minutes": body.delay_minutes,
    }
