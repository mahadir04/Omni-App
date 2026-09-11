"""Automation Decision Engine — deterministic backend logic implementing
Flow B from doc 3 (03_App_Workflow_Omni.md).

THIS MUST NEVER BE DELEGATED TO THE LLM.

The engine evaluates automation rules against the AI analysis output
and returns a deterministic decision: auto_send or require_approval.
"""

from dataclasses import dataclass
from decimal import Decimal

from app.models.ai_analysis import AIAnalysis
from app.models.automation_rule import AutomationRule
from app.models.contact import Contact
from app.models.conversation import Conversation


# Intents considered "routine" for Hybrid Autopilot auto-send.
# HARD RULE (doc 5 guardrail #4): billing_inquiry and complaint are NEVER routine.
# new_lead is NEVER routine — first-touch replies are too high-value to auto-send generically.
# general_question is included but the confidence gate (step 4) is the primary safety net:
# a confidently-wrong general answer still won't auto-send if confidence < threshold.
# Future: split into general_question_grounded vs general_question_open for tighter control.
ROUTINE_INTENTS = {"reschedule_request", "general_question"}
NEVER_ROUTINE_INTENTS = {"billing_inquiry", "complaint", "new_lead"}


@dataclass
class AutomationDecision:
    action: str  # "auto_send" | "require_approval"
    notify: bool  # whether to fire an immediate notification
    reason: str  # human-readable explanation for audit log


def evaluate(
    ai_analysis: AIAnalysis,
    automation_rules: AutomationRule,
    contact: Contact,
    conversation: Conversation,
) -> AutomationDecision:
    """Deterministic decision tree — exactly matches Flow B from doc 3.

    Decision order (critical — do not reorder):
    1. Master switch OFF → always require_approval
    2. VIP contact + bypass_automation_for_vip ON → require_approval + notify
    3. Financial/billing intent + forward_financial_queries ON → require_approval
    4. Confidence < threshold → require_approval
    5. Response strategy:
       - human_in_the_loop → always require_approval
       - hybrid_autopilot → auto_send only if routine intent, else require_approval
       - full_autopilot → auto_send, notify only if high-risk
    6. Conversation-level override (force_manual / force_auto)
    7. Negative sentiment → always notify regardless of outcome

    Returns AutomationDecision with action, notify flag, and reason.
    """

    notify = False
    confidence = float(ai_analysis.confidence)
    threshold = float(automation_rules.confidence_threshold)

    # ── Step 1: Master switch ────────────────────────────────────────────
    if not automation_rules.master_switch_enabled:
        return AutomationDecision(
            action="require_approval",
            notify=_should_notify_sentiment(ai_analysis, automation_rules),
            reason="Master automation switch is OFF — all messages require manual review",
        )

    # ── Step 2: VIP bypass ───────────────────────────────────────────────
    if contact.is_vip and automation_rules.bypass_automation_for_vip:
        return AutomationDecision(
            action="require_approval",
            notify=True,  # VIP always gets immediate notification per doc 3 Flow D
            reason=f"Contact '{contact.display_name}' is VIP — bypassing automation, notifying immediately",
        )

    # ── Step 3: Financial/billing routing ────────────────────────────────
    if (
        ai_analysis.intent in ("billing_inquiry",)
        and automation_rules.forward_financial_queries
    ):
        return AutomationDecision(
            action="require_approval",
            notify=_should_notify_sentiment(ai_analysis, automation_rules),
            reason=f"Financial/billing query detected (intent: {ai_analysis.intent}) — routing to review queue",
        )

    # ── Step 4: Confidence gate ──────────────────────────────────────────
    if confidence < threshold:
        return AutomationDecision(
            action="require_approval",
            notify=_should_notify_sentiment(ai_analysis, automation_rules),
            reason=f"Confidence {confidence:.1f}% below threshold {threshold:.1f}% — requires human review",
        )

    # ── Step 5: Response strategy ────────────────────────────────────────
    strategy = automation_rules.response_strategy

    if strategy == "human_in_the_loop":
        return AutomationDecision(
            action="require_approval",
            notify=_should_notify_sentiment(ai_analysis, automation_rules),
            reason="Response strategy is Human-in-the-Loop — all messages require approval",
        )

    elif strategy == "hybrid_autopilot":
        # Explicitly block NEVER_ROUTINE intents even if forward_financial_queries is off
        if ai_analysis.intent in NEVER_ROUTINE_INTENTS:
            decision = AutomationDecision(
                action="require_approval",
                notify=_should_notify_sentiment(ai_analysis, automation_rules),
                reason=f"Hybrid Autopilot: intent '{ai_analysis.intent}' is never auto-sent — routing to approval queue",
            )
        elif ai_analysis.intent in ROUTINE_INTENTS:
            decision = AutomationDecision(
                action="auto_send",
                notify=_should_notify_sentiment(ai_analysis, automation_rules),
                reason=f"Hybrid Autopilot: routine intent '{ai_analysis.intent}' with confidence {confidence:.1f}% — auto-sending",
            )
        else:
            decision = AutomationDecision(
                action="require_approval",
                notify=_should_notify_sentiment(ai_analysis, automation_rules),
                reason=f"Hybrid Autopilot: non-routine intent '{ai_analysis.intent}' — routing to approval queue",
            )

    elif strategy == "full_autopilot":
        decision = AutomationDecision(
            action="auto_send",
            notify=_should_notify_sentiment(ai_analysis, automation_rules),
            reason=f"Full Autopilot: confidence {confidence:.1f}% — auto-sending",
        )

    else:
        # Unknown strategy — safe fallback
        decision = AutomationDecision(
            action="require_approval",
            notify=True,
            reason=f"Unknown response strategy '{strategy}' — defaulting to require_approval",
        )

    # ── Step 6: Conversation-level override ──────────────────────────────
    if conversation.automation_override == "force_manual":
        return AutomationDecision(
            action="require_approval",
            notify=decision.notify,
            reason=f"Conversation override: force_manual — overriding to require_approval (original: {decision.reason})",
        )
    elif conversation.automation_override == "force_auto":
        # force_auto still respects VIP and confidence gates (steps 2, 4 already passed)
        return AutomationDecision(
            action="auto_send",
            notify=decision.notify,
            reason=f"Conversation override: force_auto — overriding to auto_send (original: {decision.reason})",
        )

    return decision


def _should_notify_sentiment(
    ai_analysis: AIAnalysis,
    automation_rules: AutomationRule,
) -> bool:
    """Negative sentiment → always fire notification regardless of outcome.
    Per doc 3 Flow B and PRD FR4.4."""
    if ai_analysis.sentiment == "negative" and automation_rules.notify_on_negative_sentiment:
        return True
    return False
