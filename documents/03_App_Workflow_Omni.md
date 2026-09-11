# App Workflow
**Product:** Omni — Unified AI Communication Assistant
**Version:** 1.0 (Draft)

---

## Flow A — Onboarding & Platform Connection

```
1. User signs up / logs in
2. Land on empty Inbox → prompted to "Add Platform"
3. Select platform (WhatsApp / Slack / Email / LinkedIn)
4. OAuth consent screen for that platform
5. On success → platform card shows "Connected" + metadata (e.g., workspace count)
   On failure → platform card shows "Re-auth required" + Reconnect CTA
6. User repeats for additional platforms
7. User is prompted to set an initial Automation Plan (defaults to Human-in-the-Loop,
   Strict 85% confidence threshold, VIP bypass ON, negative-sentiment alert ON)
8. User lands on live Inbox
```

## Flow B — Core Loop: Inbound Message → AI Draft → Approval → Send

This is the heart of the product — every message goes through this pipeline.

```
[Inbound message arrives on any connected platform]
        │
        ▼
Ingestion Service receives webhook / poll result
        │
        ▼
Normalize into internal Message schema, store in DB
        │
        ▼
Push "new message" event to Inbox UI (WebSocket) — appears in list immediately
        │
        ▼
AI Pipeline triggered (async, via task queue):
   1. Retrieve context (conversation history + knowledge base) — RAG
   2. Run analysis: intent, sentiment, entities, confidence
   3. Generate suggested reply + key_action (if any)
        │
        ▼
Store AI analysis + suggested reply, attach to conversation
Push "AI Intelligence Center ready" event to UI
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│              Automation Decision Engine                     │
│                                                               │
│  Is Master Automation Switch ON?                             │
│     NO → always require manual review                        │
│     │                                                          │
│     YES ▼                                                     │
│  Is contact tagged VIP AND "Bypass automation for VIP" ON?    │
│     YES → force to Approval Queue, notify user immediately    │
│     │                                                          │
│     NO ▼                                                       │
│  Is intent financial/billing AND that trigger is ON?          │
│     YES → route to review queue                               │
│     │                                                          │
│     NO ▼                                                       │
│  Is confidence ≥ user's threshold?                             │
│     NO → route to Approval Queue                              │
│     │                                                          │
│     YES ▼                                                      │
│  What is the active Response Strategy?                        │
│     Human-in-the-Loop → Approval Queue (always)                │
│     Hybrid Autopilot   → auto-send if intent is "routine"      │
│                          (scheduling/confirmation), else queue │
│     Full Autopilot     → auto-send using Voice Profile,        │
│                          notify only if flagged high-risk       │
└───────────────────────────────────────────────────────────┘
        │                                    │
   (queued for review)                 (auto-send path)
        ▼                                    ▼
User opens conversation,                Delivery Service sends
sees AI Intelligence Center             reply via platform API
card: sentiment, confidence,                    │
suggested reply, key action                     ▼
        │                                Write to audit log
        ▼                                        │
User chooses one of:                             ▼
  • Approve & Send → Delivery Service      If negative sentiment
    sends as-is                            was flagged → notify
  • Custom Edit → edit text, then send      user anyway
  • Delay Send → snooze, re-surface later
        │
        ▼
Write decision + final text to audit log
        │
        ▼
If key_action present (e.g., calendar reschedule):
  trigger the relevant integration
  (e.g., update Google Calendar event, send invite)
```

## Flow C — Automation Plan Setup / Edit

```
1. User opens Automation Engine settings
2. Toggles Master Automation Switch
3. Selects one Response Strategy (Human-in-the-Loop / Hybrid / Full)
   — selecting Full Autopilot checks whether a Voice Profile exists;
     if not, user is redirected to create one first
4. Adjusts AI Confidence Threshold slider
5. Toggles Urgency Triggers (negative sentiment alert / VIP bypass / financial routing)
6. Reviews Platform Integration section, connects/reconnects as needed
7. Clicks "Approve Automation Plan"
   → confirmation banner: "Plan Successfully Approved" summarizing the active strategy
   → new settings take effect immediately for all subsequent inbound messages
   OR clicks "Discard Changes" → reverts to last saved plan, no changes applied
```

## Flow D — VIP / Escalation Handling

```
1. Message arrives from a contact tagged VIP
2. AI analysis still runs (so a draft is ready), but Automation Decision Engine
   forces this into the Approval Queue regardless of Response Strategy
3. Immediate notification sent to user: "VIP message from <name>"
4. User reviews in Inbox — conversation header shows "VIP Client" tag
5. User acts via Approve & Send / Custom Edit / Delay Send as normal
```

## Flow E — Platform Reconnect / Token Expiry

```
1. Scheduled token-refresh job detects a token nearing expiry or already invalid
2. Platform Integration card updates to "Offline" / "Re-auth required"
3. In-app notification sent to user
4. User clicks "Reconnect" on the platform card
5. OAuth consent flow repeats for that platform
6. On success, card returns to "Connected"; any messages that arrived while
   disconnected are backfilled where the platform API allows it
```
