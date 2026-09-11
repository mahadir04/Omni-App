"""Message model — doc 4 §2 'messages' table."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "platform_msg_id"),
        Index("idx_messages_conversation", "conversation_id", "sent_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    direction: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # inbound | outbound
    sender: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # contact | user | ai
    content: Mapped[str] = mapped_column(Text, nullable=False)
    platform_msg_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # ── Relationships ────────────────────────────────────────────────────
    conversation = relationship("Conversation", back_populates="messages")
    ai_analysis = relationship(
        "AIAnalysis", back_populates="message", uselist=False, cascade="all, delete-orphan"
    )
