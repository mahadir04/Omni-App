# Product Requirements Document (PRD)
**Product:** Omni — Unified AI Communication Assistant
**Version:** 1.0 (Draft)
**Date:** September 11, 2026
**Owner:** Mahadir

---

## 1. Overview & Vision

Omni is an AI agent that sits across every channel a person communicates through — WhatsApp, Slack, LinkedIn, Email, SMS, and calls — and acts as a single intelligent inbox. It reads incoming messages, understands intent and sentiment, drafts a contextually correct reply, and either asks for human approval or sends it automatically, depending on rules the user configures.

The core value proposition: **stop switching between six apps to answer the same ten questions.** Omni turns fragmented, multi-platform communication into one prioritized queue with AI-drafted responses the user can approve in one tap.

## 2. Problem Statement

Busy professionals (freelancers, consultants, small-business owners, sales reps, executives) lose significant time:
- Context-switching between WhatsApp, Slack, LinkedIn, email, and phone/SMS.
- Manually re-reading a thread to figure out what's being asked (reschedule? invoice? new lead?).
- Typing near-identical replies to recurring questions (pricing, availability, confirmations).
- Missing high-intent messages (VIP clients, new leads) buried under low-priority noise.

Omni removes the "read → understand → compose → send" cycle for routine messages while keeping a human in control of anything sensitive, ambiguous, or high-stakes.

## 3. Target Users / Personas

| Persona | Description | Primary Need |
|---|---|---|
| **The Solo Operator** (consultant, coach, freelance service provider) | Handles all client comms personally across WhatsApp + Email + Instagram DMs | Fast, accurate replies without hiring an assistant |
| **The Executive** | High message volume, delegates but wants final say | Human-in-the-loop drafting, VIP handling, zero risk of AI mistakes going out unchecked |
| **The Sales/BD Rep** | LinkedIn + Slack + Email heavy, lead-driven | Fast triage, lead tagging, never missing a "hot" reply window |
| **The Small Team Lead** | Slack-heavy, some external client channels | Routine replies automated, complex ones escalated |

## 4. Goals & Success Metrics

| Goal | Metric | MVP Target |
|---|---|---|
| Reduce time-to-reply | Median first-response time | < 5 min for auto-handled, < 30 min for queued |
| Reduce manual typing | % of sent replies that were AI-drafted (edited or as-is) | > 60% |
| Keep trust high | % of Approve & Send used without edits vs. Custom Edit | Track as leading indicator, no hard target for MVP |
| Automation adoption | % of users who move from Human-in-the-Loop to Hybrid within 30 days | > 25% |
| Reliability | Wrongly-sent / off-tone message rate (user-reported) | < 0.5% of automated sends |
| Coverage | Platforms connected per active user | ≥ 2 |

## 5. Scope

### 5.1 In Scope (MVP)
- Unified inbox across **WhatsApp, Slack, Email**, with **LinkedIn** as a fast-follow (messaging APIs are more restricted — see TRD §3).
- AI Intelligence Center per conversation: intent detection, sentiment, confidence score, suggested reply, key action extraction (e.g., "Calendar Reschedule").
- Three response strategies: **Human-in-the-Loop, Hybrid Autopilot, Full Autopilot**.
- Reliability filters: AI confidence threshold slider, urgency triggers (negative sentiment alert, VIP bypass, financial-query routing).
- Manual actions per draft: **Approve & Send, Custom Edit, Delay Send**.
- Contact tagging: VIP, labels (Urgent, Action, New Lead).
- Platform connection management with reconnect/re-auth handling.
- Calendar reschedule as the first "key action" integration (Google Calendar).
- Audit log of every AI action and every human decision.

### 5.2 Out of Scope (MVP)
- Voice/phone call transcription and live-call assistance (calls are listed in inbox as a channel but only for logging/callback tasks in MVP, not in-call AI).
- Outbound cold outreach / campaign sending.
- Multi-user/team seat management (single-user account only in MVP).
- Invoice generation (billing questions are answered from a pricing knowledge base, not generated as documents).
- Native mobile apps (MVP is responsive web; mobile app is V2).

## 6. Feature Requirements by Epic

### Epic 1 — Unified Inbox
- FR1.1: Aggregate conversations from all connected platforms into one list, sorted by recency/priority.
- FR1.2: Filter by platform (All / WhatsApp / Slack / LinkedIn / Email), by status (All / Unread / Flagged).
- FR1.3: Search across all conversations and contacts.
- FR1.4: Per-conversation badges: Urgent, Action, New Lead (system-assigned from AI analysis, user can override).
- FR1.5: Unread count badge on Inbox nav item.

### Epic 2 — AI Intelligence Center
- FR2.1: On each new inbound message, run intent detection + sentiment analysis + entity extraction (dates, amounts, names).
- FR2.2: Generate a suggested reply grounded in conversation history and the user's knowledge base (pricing, availability, FAQs).
- FR2.3: Display a confidence score (0–100%) for the suggested reply.
- FR2.4: Surface a "key action" when detected (e.g., Calendar Reschedule, Send Invoice, Flag for Legal).
- FR2.5: Show sentiment label (Positive/Neutral/Negative) and intent summary as a banner above the draft.

### Epic 3 — Human-in-the-Loop Approval Workflow
- FR3.1: **Approve & Send** — sends the draft as-is to the originating platform.
- FR3.2: **Custom Edit** — opens the draft in an editable field before sending.
- FR3.3: **Delay Send** — snoozes the draft for a user-chosen time window; re-surfaces it later.
- FR3.4: Every draft shows which platform it will be sent to (e.g., "Approve & Send to WhatsApp").

### Epic 4 — Automation Engine
- FR4.1: **Master Automation Switch** — global on/off for all AI monitoring and drafting.
- FR4.2: **Response Strategy** (mutually exclusive, one active at a time):
  - *Human-in-the-Loop*: AI drafts everything; nothing sends without explicit approval.
  - *Hybrid Autopilot*: routine replies (scheduling, confirmations) send automatically; complex/ambiguous queries route to approval queue.
  - *Full Autopilot*: AI sends using the user's Voice Profile; only high-risk items notify the user.
- FR4.3: **AI Confidence Threshold** slider (Aggressive 0% → Precise 100%); replies below threshold always require approval regardless of strategy.
- FR4.4: **Urgency Triggers** (toggleable):
  - Notify immediately if sentiment is Negative.
  - Bypass automation entirely for contacts tagged VIP (always route to human).
  - Forward financial/billing queries to a designated reviewer ("legal assistant" role in MVP = a flagged queue, not a real legal integration).
- FR4.5: Changes to automation settings must be explicitly confirmed via **Approve Automation Plan** / **Discard Changes** before taking effect; confirmation banner shown on save.

### Epic 5 — Platform Integration Management
- FR5.1: Connect/disconnect WhatsApp, Slack, Email, LinkedIn from a settings screen.
- FR5.2: Per-platform status indicator: Connected / Offline / Re-auth required.
- FR5.3: Reconnect flow triggered directly from the integration card.
- FR5.4: Per-platform rules (e.g., quiet hours, auto-reply scope) accessible via "Platform Rules."
- FR5.5: Display platform-level metadata (e.g., WhatsApp average response time, Slack active workspace count).

### Epic 6 — Contact & Conversation Management
- FR6.1: Mark/unmark a contact as VIP.
- FR6.2: View contact metadata in the conversation header (name, platform, last seen, VIP status).
- FR6.3: Per-conversation automation toggle (override global setting for one contact/thread).

### Epic 7 — Calendar & Key Actions
- FR7.1: When intent = reschedule, offer to update the linked calendar event and confirm the new time in the reply.
- FR7.2: Send calendar invite automatically after an approved reschedule.
- FR7.3: Key actions are logged and visible in the audit trail.

### Epic 8 — Notifications
- FR8.1: In-app notification for messages requiring approval.
- FR8.2: Immediate alert for negative-sentiment or VIP messages regardless of automation mode.
- FR8.3: Daily/weekly digest of automated actions taken (for trust-building/transparency).

### Epic 9 — Voice Profile (required for Full Autopilot)
- FR9.1: User provides sample messages / tone settings (formal, casual, warm, concise) used to condition AI-generated replies.
- FR9.2: Full Autopilot is locked until a Voice Profile has been created and previewed by the user.

## 7. Sample User Stories

- *As an executive*, I want every AI-drafted reply queued for my approval, so that nothing goes out under my name without me seeing it first.
- *As a solo consultant*, I want routine confirmations (dates, prices) sent automatically, so I only deal with the messages that actually need my judgment.
- *As any user*, I want VIP clients always routed to me personally, regardless of automation mode, so I never let automation handle my most important relationships.
- *As any user*, I want to see why the AI is confident (or not) in a draft, so I can trust the system's judgment over time.
- *As a user reconnecting LinkedIn*, I want a clear one-click re-auth flow, so a token expiry doesn't silently break my inbox.

## 8. Non-Functional Requirements (summary — full detail in TRD)
- Draft generation latency target: < 5 seconds from inbound message to suggested reply.
- No automated send may bypass the confidence threshold or VIP bypass rule — this is a hard product guarantee, not just a UI setting.
- All AI actions (auto-sent or approved) must be auditable and reversible where the platform allows (e.g., calendar changes).

## 9. Release Plan

| Phase | Scope |
|---|---|
| **MVP** | WhatsApp + Slack + Email, Human-in-the-Loop + Hybrid strategies, confidence threshold, VIP bypass, calendar reschedule action, audit log |
| **V1** | LinkedIn integration, Full Autopilot + Voice Profile, financial-query routing, platform-level rules |
| **V2** | Call logging/transcription, team seats, native mobile app, invoice generation, analytics dashboard |

## 10. Risks & Assumptions
- **Assumption:** Users are individual account holders (not shared team inboxes) in MVP.
- **Risk:** WhatsApp Business API and LinkedIn messaging both require business verification and have rate/policy restrictions — onboarding friction is likely (see TRD §3).
- **Risk:** Auto-sending incorrect information (wrong price, wrong date) damages trust fast — confidence threshold and VIP bypass are non-negotiable safety rails, not optional polish.
- **Risk:** Over-notifying users defeats the purpose of automation — urgency triggers must be tunable and off by default except negative sentiment.

## 11. Open Questions
- Should "Delay Send" have a default snooze duration, or always prompt the user to pick one?
- Does the legal/financial routing in V1 go to a human reviewer role, or a separate AI reviewer with stricter rules?
- What's the data retention policy for message content used in RAG context (see TRD §5)?
