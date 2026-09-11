"""Audit logging service — writes immutable records of every AI/human action."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    actor: str,  # "user" | "system"
    action: str,  # approve_send | custom_edit | delay_send | auto_send | ...
    conversation_id: uuid.UUID | None = None,
    message_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> AuditLog:
    """Create an immutable audit log entry. Per TRD §5 — every AI suggestion
    and every human decision must be logged."""
    entry = AuditLog(
        user_id=user_id,
        conversation_id=conversation_id,
        message_id=message_id,
        actor=actor,
        action=action,
        details=details or {},
    )
    db.add(entry)
    await db.flush()
    return entry
