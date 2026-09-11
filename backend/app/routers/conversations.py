"""Conversations router — list, detail, update conversations."""

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DbSession
from app.models.ai_analysis import AIAnalysis
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import (
    ConversationDetail,
    ConversationListItem,
    ConversationUpdate,
    ContactBrief,
)
from app.schemas.message import MessageResponse
from app.schemas.ai_analysis import AIAnalysisResponse

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationListItem])
async def list_conversations(
    db: DbSession,
    current_user: CurrentUser,
    platform: str | None = Query(None),
    conv_status: str | None = Query(None, alias="status"),
    label: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List conversations with filters, sorted by last_message_at DESC.
    
    Filters: platform, status, label, search (across contact name + message content).
    Includes: contact brief, last message preview, latest AI sentiment/intent.
    """
    query = (
        select(Conversation)
        .options(selectinload(Conversation.contact))
        .where(Conversation.user_id == current_user.id)
    )

    if platform:
        query = query.where(Conversation.platform == platform)
    if conv_status:
        query = query.where(Conversation.status == conv_status)
    if label:
        query = query.where(Conversation.label == label)

    # Sort by last_message_at DESC, with NULLs last
    query = query.order_by(Conversation.last_message_at.desc().nulls_last())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    conversations = result.scalars().all()

    items = []
    for conv in conversations:
        # Get last message preview
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.sent_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Get latest AI analysis
        ai_data = None
        if last_msg:
            ai_result = await db.execute(
                select(AIAnalysis).where(AIAnalysis.message_id == last_msg.id)
            )
            ai_data = ai_result.scalar_one_or_none()

        # Apply search filter on contact name or message content
        if search:
            search_lower = search.lower()
            name_match = search_lower in conv.contact.display_name.lower()
            content_match = last_msg and search_lower in last_msg.content.lower()
            if not name_match and not content_match:
                continue

        items.append(
            ConversationListItem(
                id=conv.id,
                platform=conv.platform,
                status=conv.status,
                label=conv.label,
                unread_count=conv.unread_count,
                last_message_at=conv.last_message_at,
                automation_override=conv.automation_override,
                contact=ContactBrief.model_validate(conv.contact),
                last_message_preview=last_msg.content[:100] if last_msg else None,
                ai_sentiment=ai_data.sentiment if ai_data else None,
                ai_intent=ai_data.intent if ai_data else None,
                ai_confidence=float(ai_data.confidence) if ai_data else None,
            )
        )

    return items


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
):
    """Get conversation detail with messages and latest AI analysis."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.contact))
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.sent_at)
    )
    messages = msgs_result.scalars().all()

    # Get latest AI analysis (from the most recent inbound message)
    latest_ai = None
    for msg in reversed(messages):
        if msg.direction == "inbound":
            ai_result = await db.execute(
                select(AIAnalysis).where(AIAnalysis.message_id == msg.id)
            )
            latest_ai = ai_result.scalar_one_or_none()
            if latest_ai:
                break

    # Mark as read
    conv.unread_count = 0
    await db.commit()

    return ConversationDetail(
        id=conv.id,
        platform=conv.platform,
        status=conv.status,
        label=conv.label,
        unread_count=0,
        last_message_at=conv.last_message_at,
        automation_override=conv.automation_override,
        contact=ContactBrief.model_validate(conv.contact),
        messages=[MessageResponse.model_validate(m) for m in messages],
        latest_ai_analysis=AIAnalysisResponse.model_validate(latest_ai) if latest_ai else None,
    )


@router.patch("/{conversation_id}", response_model=ConversationDetail)
async def update_conversation(
    conversation_id: uuid.UUID,
    body: ConversationUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Update conversation status, label, or automation override."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.contact))
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.status is not None:
        conv.status = body.status
    if body.label is not None:
        conv.label = body.label
    if body.automation_override is not None:
        conv.automation_override = body.automation_override

    await db.commit()

    # Re-fetch for response
    return await get_conversation(conversation_id, db, current_user)
