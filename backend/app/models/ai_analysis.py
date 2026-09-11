"""AIAnalysis model — doc 4 §2 'ai_analysis' table."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    intent: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # positive | neutral | negative
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False
    )  # 0.00 - 100.00
    entities: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    suggested_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    requires_human_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    model_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasoning_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now()
    )

    # ── Relationships ────────────────────────────────────────────────────
    message = relationship("Message", back_populates="ai_analysis")
