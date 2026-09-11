"""Conversation & contact schemas."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.message import MessageResponse
from app.schemas.ai_analysis import AIAnalysisResponse


# ── Contact ──────────────────────────────────────────────────────────────

class ContactBrief(BaseModel):
    id: uuid.UUID
    display_name: str
    platform: str
    platform_handle: str
    is_vip: bool
    avatar_url: str | None = None
    last_seen_at: datetime | None = None

    model_config = {"from_attributes": True}


class ContactUpdate(BaseModel):
    is_vip: bool | None = None
    display_name: str | None = None


# ── Conversation ─────────────────────────────────────────────────────────

class ConversationListItem(BaseModel):
    id: uuid.UUID
    platform: str
    status: str
    label: str | None = None
    unread_count: int
    last_message_at: datetime | None = None
    automation_override: str
    contact: ContactBrief
    # Preview: last message snippet + latest AI sentiment/intent
    last_message_preview: str | None = None
    ai_sentiment: str | None = None
    ai_intent: str | None = None
    ai_confidence: float | None = None

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: uuid.UUID
    platform: str
    status: str
    label: str | None = None
    unread_count: int
    last_message_at: datetime | None = None
    automation_override: str
    contact: ContactBrief
    messages: list[MessageResponse]
    latest_ai_analysis: AIAnalysisResponse | None = None

    model_config = {"from_attributes": True}


class ConversationUpdate(BaseModel):
    status: Literal["open", "flagged", "archived"] | None = None
    label: Literal["urgent", "action", "new_lead"] | None = None
    automation_override: Literal["inherit", "force_manual", "force_auto"] | None = None


class ConversationListParams(BaseModel):
    platform: str | None = None
    status: str | None = None
    label: str | None = None
    search: str | None = None
    page: int = 1
    page_size: int = 20
