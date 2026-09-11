"""Contacts router — VIP toggle, contact metadata updates."""

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models.contact import Contact
from app.schemas.conversation import ContactBrief, ContactUpdate
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.patch("/{contact_id}", response_model=ContactBrief)
async def update_contact(
    contact_id: uuid.UUID,
    body: ContactUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Update contact — VIP toggle (PRD FR6.1), display name, etc."""
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.user_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if body.is_vip is not None:
        vip_changed = contact.is_vip != body.is_vip
        contact.is_vip = body.is_vip
        if vip_changed:
            await log_action(
                db,
                user_id=current_user.id,
                actor="user",
                action="vip_toggled",
                details={
                    "contact_id": str(contact_id),
                    "contact_name": contact.display_name,
                    "is_vip": body.is_vip,
                },
            )

    if body.display_name is not None:
        contact.display_name = body.display_name

    await db.commit()
    await db.refresh(contact)
    return ContactBrief.model_validate(contact)
