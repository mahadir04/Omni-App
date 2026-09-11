"""KeyAction model — doc 4 §2 'key_actions' table."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class KeyAction(Base):
    __tablename__ = "key_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    ai_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_analysis.id"),
        nullable=True,
    )
    action_type: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # calendar_reschedule | send_invoice | ...
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="pending"
    )  # pending | completed | failed
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    executed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # ── Relationships ────────────────────────────────────────────────────
    conversation = relationship("Conversation", back_populates="key_actions")
    ai_analysis = relationship("AIAnalysis")
