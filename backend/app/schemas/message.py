"""Message schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: str  # inbound | outbound
    sender: str  # contact | user | ai
    content: str
    sent_at: datetime

    model_config = {"from_attributes": True}


class ApproveRequest(BaseModel):
    """Approve & Send the AI-drafted reply as-is."""
    pass  # No body needed — draft text comes from ai_analysis.suggested_reply


class EditAndSendRequest(BaseModel):
    """Custom Edit — send user-modified text."""
    content: str


class DelaySendRequest(BaseModel):
    """Delay Send — snooze the draft for a chosen duration."""
    delay_minutes: int = 60  # default 1 hour


class SimulateMessageRequest(BaseModel):
    """Dev-only: simulate an inbound message for pipeline testing."""
    sender_name: str
    sender_handle: str
    content: str
    platform: str = "whatsapp"
    platform_msg_id: str | None = None
