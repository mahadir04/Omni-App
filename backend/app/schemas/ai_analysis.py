"""AI Analysis schemas — matches doc 5 §3 output schema exactly."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AIAnalysisEntities(BaseModel):
    date: str | None = None
    amount: float | None = None
    other: str | None = None


class AIAnalysisResponse(BaseModel):
    id: uuid.UUID
    message_id: uuid.UUID
    intent: str
    sentiment: str
    confidence: float
    entities: dict
    suggested_reply: str | None = None
    key_action: str | None = None
    requires_human_review: bool
    reasoning_summary: str | None = None
    model_version: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AIAnalysisLLMOutput(BaseModel):
    """The exact JSON shape the LLM must return — doc 5 §3."""
    intent: str  # reschedule_request | billing_inquiry | new_lead | general_question | complaint | other
    sentiment: str  # positive | neutral | negative
    confidence: float  # 0-100
    entities: AIAnalysisEntities
    suggested_reply: str
    key_action: str  # calendar_reschedule | send_invoice | flag_for_review | none
    requires_human_review: bool
    reasoning_summary: str
