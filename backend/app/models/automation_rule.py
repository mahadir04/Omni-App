"""AutomationRule model — doc 4 §2 'automation_rules' table."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    master_switch_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    response_strategy: Mapped[str] = mapped_column(
        Text, nullable=False, default="human_in_the_loop"
    )  # human_in_the_loop | hybrid_autopilot | full_autopilot
    confidence_threshold: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=85.00
    )
    notify_on_negative_sentiment: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    bypass_automation_for_vip: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    forward_financial_queries: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    status: Mapped[str] = mapped_column(
        Text, nullable=False, default="approved"
    )  # draft | approved
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ────────────────────────────────────────────────────
    user = relationship("User", back_populates="automation_rule")
