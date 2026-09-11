"""AI pipeline Celery tasks — async processing of inbound messages.

For MVP without Redis/Celery running, the pipeline can also be called
directly (synchronously within the request) via the ingestion service.
"""

import asyncio
import uuid

from app.tasks.celery_app import celery_app


@celery_app.task(name="process_message_ai", bind=True, max_retries=3)
def process_message_ai(self, message_id: str, user_id: str):
    """Celery task: run AI pipeline on a newly ingested message,
    then run the Automation Decision Engine on the result.

    This is the async path triggered after message ingestion.
    For MVP, we also support a synchronous fallback (called directly).
    """
    try:
        asyncio.run(_process(uuid.UUID(message_id), uuid.UUID(user_id)))
    except Exception as exc:
        self.retry(exc=exc, countdown=5)


async def _process(message_id: uuid.UUID, user_id: uuid.UUID):
    """Async inner function that runs the full pipeline."""
    from app.database import async_session_factory
    from app.services.ai_pipeline import run_ai_pipeline
    from app.services.automation_engine import evaluate
    from app.services.delivery_service import send_reply
    from app.services.audit_service import log_action
    from app.models.automation_rule import AutomationRule
    from app.models.contact import Contact
    from app.models.conversation import Conversation
    from app.models.message import Message
    from app.websocket import ws_manager
    from sqlalchemy import select

    async with async_session_factory() as db:
        # 1. Run AI pipeline
        ai_analysis = await run_ai_pipeline(db, message_id, user_id)

        # 2. Load context for automation decision
        msg = await db.get(Message, message_id)
        conv = await db.get(Conversation, msg.conversation_id)
        contact = await db.get(Contact, conv.contact_id)

        rules_result = await db.execute(
            select(AutomationRule).where(AutomationRule.user_id == user_id)
        )
        rules = rules_result.scalar_one_or_none()

        if rules is None:
            # No rules = default to manual review
            return

        # 3. Run Automation Decision Engine
        decision = evaluate(ai_analysis, rules, contact, conv)

        # 4. Execute decision
        if decision.action == "auto_send" and ai_analysis.suggested_reply:
            await send_reply(
                db,
                conversation_id=conv.id,
                user_id=user_id,
                platform=conv.platform,
                content=ai_analysis.suggested_reply,
                sender="ai",
                action_type="auto_send",
            )

        # 5. Send notification if needed
        if decision.notify:
            await ws_manager.send_to_user(
                user_id,
                "notification",
                {
                    "type": "urgent" if ai_analysis.sentiment == "negative" else "info",
                    "title": f"{'⚠️ Negative sentiment' if ai_analysis.sentiment == 'negative' else '🔔 VIP message'} from {contact.display_name}",
                    "conversation_id": str(conv.id),
                    "reason": decision.reason,
                },
            )

        # 6. Log the automation decision
        await log_action(
            db,
            user_id=user_id,
            actor="system",
            action=f"automation_decision_{decision.action}",
            conversation_id=conv.id,
            message_id=message_id,
            details={
                "decision": decision.action,
                "notify": decision.notify,
                "reason": decision.reason,
                "confidence": float(ai_analysis.confidence),
                "intent": ai_analysis.intent,
                "sentiment": ai_analysis.sentiment,
            },
        )
        await db.commit()


async def process_message_sync(message_id: uuid.UUID, user_id: uuid.UUID):
    """Synchronous fallback — runs the pipeline directly without Celery.
    Used when Redis is not available (local dev)."""
    await _process(message_id, user_id)
