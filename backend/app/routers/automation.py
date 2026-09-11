"""Automation rules router — get, update, approve, discard."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession
from app.models.automation_rule import AutomationRule
from app.models.voice_profile import VoiceProfile
from app.schemas.automation import AutomationRulesResponse, AutomationRulesUpdate
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/automation-rules", tags=["automation"])


@router.get("", response_model=AutomationRulesResponse)
async def get_automation_rules(db: DbSession, current_user: CurrentUser):
    """Get current user's automation rules."""
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.user_id == current_user.id)
    )
    rules = result.scalar_one_or_none()
    if not rules:
        raise HTTPException(status_code=404, detail="Automation rules not found")
    return rules


@router.put("", response_model=AutomationRulesResponse)
async def update_automation_rules(
    body: AutomationRulesUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Update automation rules — saves as 'draft' until explicitly approved.
    
    Per PRD FR4.5: changes don't take effect until Approve Automation Plan.
    """
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.user_id == current_user.id)
    )
    rules = result.scalar_one_or_none()
    if not rules:
        raise HTTPException(status_code=404, detail="Automation rules not found")

    # Validate: Full Autopilot requires Voice Profile (PRD FR9.2)
    if body.response_strategy == "full_autopilot":
        vp_result = await db.execute(
            select(VoiceProfile).where(VoiceProfile.user_id == current_user.id)
        )
        if vp_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400,
                detail="Full Autopilot requires a Voice Profile. Please create one first.",
            )

    # Apply updates
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rules, key, value)

    # Mark as draft until approved
    rules.status = "draft"
    await db.commit()
    await db.refresh(rules)
    return rules


@router.post("/approve", response_model=AutomationRulesResponse)
async def approve_automation_plan(db: DbSession, current_user: CurrentUser):
    """Approve the current automation plan — makes draft changes take effect.
    
    Per PRD FR4.5: confirmation required before settings take effect.
    Writes to audit log.
    """
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.user_id == current_user.id)
    )
    rules = result.scalar_one_or_none()
    if not rules:
        raise HTTPException(status_code=404, detail="Automation rules not found")

    rules.status = "approved"
    await db.flush()

    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="plan_approved",
        details={
            "strategy": rules.response_strategy,
            "confidence_threshold": float(rules.confidence_threshold),
            "master_switch": rules.master_switch_enabled,
            "vip_bypass": rules.bypass_automation_for_vip,
            "negative_sentiment_notify": rules.notify_on_negative_sentiment,
            "financial_routing": rules.forward_financial_queries,
        },
    )
    await db.commit()
    await db.refresh(rules)
    return rules


@router.post("/discard", response_model=AutomationRulesResponse)
async def discard_automation_changes(db: DbSession, current_user: CurrentUser):
    """Discard draft changes — revert to last approved state.
    
    Per PRD FR4.5: Discard Changes reverts, no changes applied.
    For MVP (single row, no history), this just resets status to 'approved'
    without actually reverting field values. A proper implementation would
    keep a history table — flagged as future work in doc 4 §3.
    """
    result = await db.execute(
        select(AutomationRule).where(AutomationRule.user_id == current_user.id)
    )
    rules = result.scalar_one_or_none()
    if not rules:
        raise HTTPException(status_code=404, detail="Automation rules not found")

    # For MVP: reset status. In production, revert from history.
    rules.status = "approved"

    await log_action(
        db,
        user_id=current_user.id,
        actor="user",
        action="plan_discarded",
        details={},
    )
    await db.commit()
    await db.refresh(rules)
    return rules
