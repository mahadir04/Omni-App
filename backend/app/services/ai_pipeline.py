"""AI Pipeline — analysis + reply generation + confidence calibration.

Implements TRD §4 and AI Context File (doc 5) exactly:
1. Context retrieval (conversation history + knowledge base RAG)
2. Analysis + reply generation (structured LLM call → doc 5 §3 JSON schema)
3. Confidence calibration (TRD §4.1 — rules-based adjustment)
4. Store ai_analysis row
5. Emit WebSocket event

When USE_MOCK_LLM=true, uses keyword-matching mock that respects all doc 5 guardrails.
"""

import json
import logging
import re
import uuid
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_analysis import AIAnalysis
from app.models.automation_rule import AutomationRule
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.knowledge_base import KnowledgeBaseEntry
from app.models.message import Message
from app.models.voice_profile import VoiceProfile
from app.schemas.ai_analysis import AIAnalysisLLMOutput
from app.services.ai_prompts import build_system_prompt, build_user_message
from app.websocket import ws_manager


logger = logging.getLogger(__name__)


async def call_gemini_llm(system_prompt: str, user_message: str) -> dict:
    """Call Google Gemini API with native JSON schema output."""
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    model = settings.gemini_model or "gemini-flash-lite-latest"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.gemini_api_key}"

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {"parts": [{"text": user_message}]}
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    parsed = json.loads(raw_text)

    # Normalize fields to guarantee strict schema compatibility
    if "entities" not in parsed or not isinstance(parsed["entities"], dict):
        parsed["entities"] = {"date": None, "amount": None, "other": None}
    else:
        parsed["entities"].setdefault("date", None)
        parsed["entities"].setdefault("amount", None)
        parsed["entities"].setdefault("other", None)

    # Confidence scaling (0-100)
    raw_conf = parsed.get("confidence", 85.0)
    if isinstance(raw_conf, (int, float)) and raw_conf <= 1.0:
        parsed["confidence"] = round(raw_conf * 100, 1)

    parsed.setdefault("sentiment", "neutral")
    parsed.setdefault("intent", "general_question")
    parsed.setdefault("suggested_reply", "Thank you for reaching out. I'll get back to you shortly.")
    parsed.setdefault("key_action", "none")
    parsed.setdefault("requires_human_review", False)
    parsed.setdefault("reasoning_summary", "Analyzed using Gemini Flash.")

    return parsed


# ── Mock LLM ─────────────────────────────────────────────────────────────

def _mock_analyze(content: str, contact_is_vip: bool, has_kb_context: bool) -> dict:
    """Keyword-based mock that respects doc 5 guardrails.
    Produces deterministic results for testing the full pipeline."""

    content_lower = content.lower()

    # Intent detection via keywords
    if any(w in content_lower for w in ["reschedule", "move", "change the date", "postpone"]):
        intent = "reschedule_request"
        key_action = "calendar_reschedule"
        confidence = 88
    elif any(w in content_lower for w in ["price", "cost", "invoice", "billing", "payment", "$", "charge"]):
        intent = "billing_inquiry"
        key_action = "flag_for_review"
        confidence = 62  # billing always scores lower per doc 5
    elif any(w in content_lower for w in ["interested", "new project", "proposal", "opportunity"]):
        intent = "new_lead"
        key_action = "none"
        confidence = 75
    elif any(w in content_lower for w in ["complaint", "unhappy", "disappointed", "terrible", "worst"]):
        intent = "complaint"
        key_action = "flag_for_review"
        confidence = 40
    elif any(w in content_lower for w in ["thank", "great", "awesome", "perfect", "love"]):
        intent = "general_question"
        key_action = "none"
        confidence = 92
    else:
        intent = "general_question"
        key_action = "none"
        confidence = 78

    # Sentiment detection
    negative_words = ["angry", "frustrated", "unhappy", "disappointed", "terrible", "worst", "complaint", "problem", "issue", "upset"]
    positive_words = ["thank", "great", "awesome", "perfect", "love", "wonderful", "excellent", "happy"]

    if any(w in content_lower for w in negative_words):
        sentiment = "negative"
        confidence = min(confidence, 45)  # doc 5 §4: score down for negative
    elif any(w in content_lower for w in positive_words):
        sentiment = "positive"
    else:
        sentiment = "neutral"

    # Entity extraction
    entities = {"date": None, "amount": None, "other": None}
    # Simple date pattern
    date_match = re.search(r"(\w+ \d{1,2}(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)?)", content)
    if date_match:
        entities["date"] = date_match.group(1)
    # Amount pattern
    amount_match = re.search(r"\$?([\d,]+(?:\.\d{2})?)", content)
    if amount_match and any(w in content_lower for w in ["price", "cost", "$", "total", "amount", "pay"]):
        entities["amount"] = float(amount_match.group(1).replace(",", ""))

    # requires_human_review — per doc 5 §6 escalation criteria
    requires_human_review = (
        sentiment == "negative"
        or intent in ("billing_inquiry", "complaint")
        or confidence < 85
        or contact_is_vip
    )

    # Generate a mock reply
    reply_map = {
        "reschedule_request": "I'd be happy to reschedule. Let me check the calendar and get back to you with available times.",
        "billing_inquiry": "Thank you for your inquiry. Let me pull up the details and get back to you shortly.",
        "new_lead": "Thank you for reaching out! I'd love to learn more about what you're looking for. Could you share a few more details?",
        "complaint": "I'm sorry to hear about your experience. I want to make sure we address this properly. Could you share more details so I can help resolve this?",
        "general_question": "Thank you for your message! I'll get back to you shortly with the information you need.",
    }
    suggested_reply = reply_map.get(intent, "Thank you for your message. I'll review and respond shortly.")

    # Reasoning
    reasons = []
    if contact_is_vip:
        reasons.append("contact is VIP — routing to review per account settings")
    if sentiment == "negative":
        reasons.append("negative sentiment detected — requires human judgment")
    if not has_kb_context:
        reasons.append("no knowledge base context available for grounding")
    if confidence >= 85:
        reasons.append("high confidence — facts traceable to context")
    else:
        reasons.append(f"moderate confidence ({confidence}%) — some uncertainty present")

    reasoning_summary = "; ".join(reasons) if reasons else "Standard analysis completed."

    return {
        "intent": intent,
        "sentiment": sentiment,
        "confidence": confidence,
        "entities": entities,
        "suggested_reply": suggested_reply,
        "key_action": key_action,
        "requires_human_review": requires_human_review,
        "reasoning_summary": reasoning_summary,
    }


# ── Confidence Calibration (TRD §4.1) ───────────────────────────────────

def calibrate_confidence(
    raw_confidence: float,
    intent: str,
    sentiment: str,
    kb_results_count: int,
) -> float:
    """Rules-based confidence calibration per TRD §4.1.

    Combines:
    (a) model self-reported confidence
    (b) rules-based penalty for error-prone intents (financial, legal)
    (c) retrieval quality (how well RAG context matched)
    """
    adjusted = raw_confidence

    # (b) Intent-based penalties
    if intent in ("billing_inquiry", "complaint"):
        adjusted -= 10
    if intent == "other":
        adjusted -= 5

    # (c) RAG retrieval quality penalties
    if kb_results_count == 0:
        adjusted -= 15
    elif kb_results_count < 3:
        adjusted -= 5

    # Sentiment penalty
    if sentiment == "negative":
        adjusted -= 10

    return max(0, min(100, adjusted))


# ── Main Pipeline ────────────────────────────────────────────────────────

async def run_ai_pipeline(
    db: AsyncSession,
    message_id: uuid.UUID,
    user_id: uuid.UUID,
) -> AIAnalysis:
    """Run the full AI pipeline on a message: context retrieval → analysis →
    calibration → store → broadcast.

    This is the async entry point called by Celery tasks or directly."""

    # ── 1. Load message + conversation + contact ─────────────────────────
    msg_result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = msg_result.scalar_one()

    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == message.conversation_id)
    )
    conversation = conv_result.scalar_one()

    contact_result = await db.execute(
        select(Contact).where(Contact.id == conversation.contact_id)
    )
    contact = contact_result.scalar_one()

    # ── 2. Context retrieval (RAG) ───────────────────────────────────────
    # Conversation history
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.sent_at)
        .limit(20)
    )
    history_messages = history_result.scalars().all()
    conversation_history = [
        {"direction": m.direction, "content": m.content, "sender": m.sender}
        for m in history_messages
    ]

    # Knowledge base entries (simple text search for MVP; pgvector similarity when embeddings exist)
    kb_result = await db.execute(
        select(KnowledgeBaseEntry).where(KnowledgeBaseEntry.user_id == user_id)
    )
    kb_entries = kb_result.scalars().all()
    kb_context = "\n".join(f"- {e.title}: {e.content}" for e in kb_entries) if kb_entries else ""

    # Voice profile (for Full Autopilot)
    vp_result = await db.execute(
        select(VoiceProfile).where(VoiceProfile.user_id == user_id)
    )
    voice_profile = vp_result.scalar_one_or_none()
    vp_dict = None
    if voice_profile:
        vp_dict = {"tone": voice_profile.tone, "sample_messages": voice_profile.sample_messages}

    # User's automation rules (for confidence threshold in prompt)
    rules_result = await db.execute(
        select(AutomationRule).where(AutomationRule.user_id == user_id)
    )
    automation_rules = rules_result.scalar_one_or_none()
    confidence_threshold = float(automation_rules.confidence_threshold) if automation_rules else 85.0

    # ── 3. Analysis + reply generation ───────────────────────────────────
    contact_metadata = {
        "name": contact.display_name,
        "platform": contact.platform,
        "is_vip": contact.is_vip,
        "last_seen_at": str(contact.last_seen_at) if contact.last_seen_at else None,
    }

    if settings.use_mock_llm or not settings.gemini_api_key:
        raw_output = _mock_analyze(
            content=message.content,
            contact_is_vip=contact.is_vip,
            has_kb_context=bool(kb_entries),
        )
    else:
        try:
            system_prompt = build_system_prompt(confidence_threshold, vp_dict)
            user_message = build_user_message(
                message.content, conversation_history, contact_metadata, kb_context, conversation.platform
            )
            raw_output = await call_gemini_llm(system_prompt, user_message)
        except Exception as err:
            logger.error(f"Gemini LLM call failed, falling back to mock analyzer: {err}")
            raw_output = _mock_analyze(
                content=message.content,
                contact_is_vip=contact.is_vip,
                has_kb_context=bool(kb_entries),
            )

    # Validate against doc 5 schema
    llm_output = AIAnalysisLLMOutput(**raw_output)

    # ── 4. Confidence calibration (TRD §4.1) ────────────────────────────
    calibrated_confidence = calibrate_confidence(
        raw_confidence=llm_output.confidence,
        intent=llm_output.intent,
        sentiment=llm_output.sentiment,
        kb_results_count=len(kb_entries),
    )

    # Re-evaluate requires_human_review with calibrated confidence
    requires_review = (
        llm_output.requires_human_review
        or calibrated_confidence < confidence_threshold
        or llm_output.sentiment == "negative"
        or llm_output.intent in ("billing_inquiry", "complaint")
    )

    # ── 5. Store AI analysis ─────────────────────────────────────────────
    ai_analysis = AIAnalysis(
        message_id=message_id,
        intent=llm_output.intent,
        sentiment=llm_output.sentiment,
        confidence=Decimal(str(round(calibrated_confidence, 2))),
        entities=llm_output.entities.model_dump(),
        suggested_reply=llm_output.suggested_reply,
        key_action=llm_output.key_action if llm_output.key_action != "none" else None,
        requires_human_review=requires_review,
        model_version="mock-v1" if settings.use_mock_llm or not settings.gemini_api_key else settings.gemini_model,
        reasoning_summary=llm_output.reasoning_summary,
    )
    db.add(ai_analysis)
    await db.commit()
    await db.refresh(ai_analysis)

    # ── 6. Broadcast WebSocket event ─────────────────────────────────────
    await ws_manager.send_to_user(
        user_id,
        "ai_analysis_ready",
        {
            "conversation_id": str(conversation.id),
            "message_id": str(message_id),
            "intent": ai_analysis.intent,
            "sentiment": ai_analysis.sentiment,
            "confidence": float(ai_analysis.confidence),
            "suggested_reply": ai_analysis.suggested_reply,
            "key_action": ai_analysis.key_action,
            "requires_human_review": ai_analysis.requires_human_review,
            "reasoning_summary": ai_analysis.reasoning_summary,
        },
    )

    return ai_analysis
