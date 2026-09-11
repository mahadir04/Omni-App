# Technical Requirements Document (TRD)
**Product:** Omni — Unified AI Communication Assistant
**Version:** 1.0 (Draft)
**Date:** September 11, 2026

---

## 1. Architecture Overview

```
                         ┌─────────────────────────┐
                         │      Client (React)     │
                         │  Inbox / AI Center /     │
                         │  Automation Engine UI    │
                         └────────────┬─────────────┘
                                      │ REST + WebSocket
                         ┌────────────▼─────────────┐
                         │        API Gateway        │
                         │   (FastAPI, auth, rate    │
                         │    limiting, routing)     │
                         └────────────┬─────────────┘
             ┌────────────────────────┼────────────────────────┐
             │                        │                        │
  ┌──────────▼─────────┐   ┌──────────▼─────────┐   ┌──────────▼─────────┐
  │  Ingestion Service   │   │  Automation Engine  │   │  Delivery Service   │
  │  (platform webhooks/ │   │  (decision rules +   │   │  (send to platform  │
  │   pollers, normalize)│   │   confidence gate)   │   │   via each API)     │
  └──────────┬─────────┘   └──────────┬─────────┘   └──────────┬─────────┘
             │                        │                        │
             └────────────┬───────────┴────────────┬───────────┘
                           │                        │
                ┌──────────▼─────────┐   ┌──────────▼─────────┐
                │   AI Pipeline        │   │   Task Queue         │
                │  (intent, sentiment,  │   │  (Celery + Redis)    │
                │   entities, RAG,      │   └──────────┬─────────┘
                │   reply generation)   │              │
                └──────────┬─────────┘   ┌──────────▼─────────┐
                           │              │  Scheduled Jobs      │
                ┌──────────▼─────────┐   │  (Delay Send,        │
                │  Vector Store        │   │   digests, token     │
                │  (context/history)   │   │   refresh)           │
                └──────────┬─────────┘   └─────────────────────┘
                           │
                ┌──────────▼─────────┐
                │   PostgreSQL          │
                │  (source of truth)    │
                └───────────────────────┘
```

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript + Tailwind CSS | Matches existing frontend experience; component-driven UI fits the Inbox/Intelligence Center/Automation Engine screens directly |
| Backend API | Python + FastAPI | Async-first, strong typing via Pydantic, matches prior full-stack RAG work |
| AI Orchestration | LangChain (or direct provider SDKs) | Chains for intent → context retrieval → reply generation; swappable LLM backend |
| LLM Provider | Claude or GPT-4o class model | Function-calling / structured JSON output for the AI Context File schema (see doc 5) |
| Relational DB | PostgreSQL | Transactional integrity for messages, automation rules, audit log |
| Vector Store | Pinecone or pgvector (Postgres extension) | Conversation-history + knowledge-base retrieval for RAG-grounded replies |
| Cache / Queue broker | Redis | Celery broker, session cache, rate-limit counters |
| Async Task Queue | Celery | AI processing jobs, delayed sends, digest emails, token refresh |
| Real-time updates | WebSockets (Socket.IO or native FastAPI WS) | Push new messages / AI drafts to the Inbox UI live |
| Event streaming (V1+, optional) | Kafka | Only if message volume justifies decoupling ingestion from processing at scale — not required for MVP |
| Auth | OAuth2 (per-platform) + JWT (app session) | Platform tokens stored separately from app session auth |
| Secrets / Token storage | Vault or cloud KMS-encrypted DB column | Never store platform tokens in plaintext |
| Deployment | Docker + docker-compose (MVP), Kubernetes (scale-out later) | Matches prior Dockerized project experience |
| Observability | Structured logging + Prometheus/Grafana (reused pattern from prior project) + Sentry for error tracking | |

## 3. Third-Party Integrations

| Platform | API | Notes / Constraints |
|---|---|---|
| WhatsApp | WhatsApp Business Cloud API (Meta) | Requires Meta Business verification; template-message rules for messages outside the 24-hour customer-service window |
| Slack | Slack Web API + Events API | Bot token per workspace; Events API webhook for real-time inbound messages |
| Email | Gmail API / Microsoft Graph API (OAuth), fallback IMAP/SMTP | Prefer provider APIs over raw IMAP for reliability and push notifications (Gmail Pub/Sub, Graph webhooks) |
| LinkedIn | LinkedIn Messaging API | Access is restricted/partner-gated — flag as V1 risk; may require LinkedIn Marketing Partner status or a browser-automation fallback with clear ToS review |
| Calendar | Google Calendar API | Powers the "Calendar Reschedule" key action |
| SMS/Calls (V2) | Twilio | Programmable SMS + Voice; call transcription via Twilio + Whisper/ASR if pursued |

All inbound platform events land through a **webhook receiver** (or short-interval poller where webhooks aren't available) and are normalized into a single internal `Message` schema before anything else touches them — this is what makes the unified inbox possible.

## 4. AI / ML Pipeline

1. **Normalization** — every inbound message (regardless of platform) is converted to a common internal shape: `{platform, contact_id, thread_id, content, attachments, timestamp}`.
2. **Context retrieval (RAG)** — pull recent conversation history + relevant knowledge-base entries (pricing, FAQs, calendar availability) from the vector store, scoped to this contact/thread.
3. **Analysis pass** (single structured LLM call, function-calling / JSON mode):
   - Intent classification (e.g., `reschedule_request`, `billing_inquiry`, `new_lead`, `general`).
   - Sentiment (`positive` / `neutral` / `negative`).
   - Entity extraction (dates, amounts, names referenced).
   - Confidence score (model self-reported + calibration layer — see §4.1).
4. **Reply generation** — second call (or same call via tool-use) grounded in retrieved context + the user's Voice Profile (if Full Autopilot), producing the suggested reply text and a `key_action` if applicable (e.g., `calendar_reschedule`).
5. **Automation Decision Engine** (deterministic, not LLM-driven) evaluates:
   - Is the Master Automation Switch on?
   - Which Response Strategy is active?
   - Is the contact tagged VIP? → force human review regardless of mode.
   - Is intent `billing`/`financial`? → route to review queue if that trigger is on.
   - Is confidence ≥ the user's threshold? → eligible for auto-send under Hybrid/Full modes.
   - Is sentiment negative? → fire an immediate notification regardless of outcome.
6. **Outcome** — either queued to the Inbox for approval, or sent directly via the Delivery Service, with every step written to the audit log.

### 4.1 Confidence Calibration
Raw LLM-reported confidence is not trustworthy alone. MVP approach: combine (a) model self-reported confidence, (b) a rules-based penalty for intents historically prone to error (financial figures, legal commitments), and (c) retrieval quality (how well the RAG context matched the query) into a single calibrated score shown to the user and used by the Automation Decision Engine.

## 5. Security & Compliance
- Platform OAuth tokens encrypted at rest; refreshed proactively before expiry (scheduled Celery job), with UI reflecting `Re-auth required` on failure — matches the design's LinkedIn "Offline / Reconnect" state.
- Webhook signature verification for every inbound platform event (Meta/Slack both sign payloads).
- Role-based access control, even in single-user MVP, to make team seats (V2) straightforward later.
- Full audit log: every AI suggestion, every human decision (approve/edit/delay), every automated send — immutable, timestamped, actor-attributed.
- Data retention policy needed for message content stored for RAG (recommend configurable retention window + user-triggered delete/export, given this is personal/business communication data).
- Rate limiting on the API gateway to protect against platform webhook floods and abuse.

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Draft generation latency | < 5s p95 from inbound message to suggested reply appearing |
| Auto-send latency (Hybrid/Full) | < 10s p95 end-to-end |
| Inbox real-time update | < 2s from server event to UI update via WebSocket |
| Uptime | 99.5% for MVP (single-region) |
| Webhook processing | At-least-once delivery, idempotent handling (dedupe by platform message ID) |
| Token refresh | Proactive refresh ≥ 24h before expiry where platform supports it |

## 7. Deployment
- Docker Compose for local/dev; single docker image per service (API, worker, ingestion).
- CI: lint + type-check + test on PR; CD: build + push image + deploy on merge to main.
- Environments: local → staging → production, with separate platform app credentials per environment (critical for WhatsApp/Slack app review requirements).

## 8. Monitoring & Observability
- Structured JSON logs per request/job, correlated by `trace_id` across ingestion → AI pipeline → delivery.
- Dashboards: message volume by platform, AI confidence distribution, auto-send vs. approval-queue ratio, failed-send rate.
- Alerting: failed webhook signature checks, repeated send failures, token refresh failures, latency SLA breaches.
