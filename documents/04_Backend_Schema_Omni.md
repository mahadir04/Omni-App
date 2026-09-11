# Backend Schema
**Product:** Omni — Unified AI Communication Assistant
**Database:** PostgreSQL (+ pgvector or external vector store for embeddings)
**Version:** 1.0 (Draft)

---

## 1. Entity Overview

```
users ──< platform_connections
users ──< contacts ──< conversations ──< messages ──< ai_analysis
users ──< automation_rules
users ──< voice_profiles
conversations ──< key_actions
users ──< audit_log
users ──< knowledge_base_entries
```

## 2. Core Tables (DDL)

```sql
-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    full_name       TEXT NOT NULL,
    password_hash   TEXT,                     -- null if SSO-only
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLATFORM CONNECTIONS  (one row per connected external platform)
-- ============================================================
CREATE TABLE platform_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL CHECK (platform IN
                         ('whatsapp','slack','email','linkedin','sms')),
    status              TEXT NOT NULL DEFAULT 'connected' CHECK (status IN
                         ('connected','offline','reauth_required')),
    external_account_id TEXT,                 -- e.g. Slack workspace id, Gmail address
    access_token_enc    TEXT NOT NULL,         -- encrypted at rest (KMS/Vault)
    refresh_token_enc   TEXT,
    token_expires_at    TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}',    -- e.g. {"workspace_count": 3, "avg_response_time_min": 2}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, platform, external_account_id)
);

-- ============================================================
-- CONTACTS  (the people messaging the user, per platform identity)
-- ============================================================
CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name    TEXT NOT NULL,
    platform        TEXT NOT NULL,
    platform_handle TEXT NOT NULL,             -- phone number, slack user id, email, linkedin urn
    is_vip          BOOLEAN NOT NULL DEFAULT false,
    avatar_url      TEXT,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, platform, platform_handle)
);

-- ============================================================
-- CONVERSATIONS  (a thread with a contact on a given platform)
-- ============================================================
CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id          UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN
                         ('open','flagged','archived')),
    label               TEXT CHECK (label IN ('urgent','action','new_lead', NULL)),
    automation_override TEXT CHECK (automation_override IN
                         ('inherit','force_manual','force_auto')) DEFAULT 'inherit',
    unread_count        INTEGER NOT NULL DEFAULT 0,
    last_message_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_user_lastmsg ON conversations (user_id, last_message_at DESC);

-- ============================================================
-- MESSAGES  (normalized, platform-agnostic message record)
-- ============================================================
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    sender          TEXT NOT NULL,             -- 'contact' | 'user' | 'ai'
    content         TEXT NOT NULL,
    platform_msg_id TEXT,                      -- external id, for idempotent webhook handling
    raw_payload     JSONB,                     -- original platform payload, for debugging
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, platform_msg_id)
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, sent_at);

-- ============================================================
-- AI ANALYSIS  (one row per inbound message that was analyzed)
-- ============================================================
CREATE TABLE ai_analysis (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    intent              TEXT NOT NULL,          -- e.g. 'reschedule_request', 'billing_inquiry'
    sentiment           TEXT NOT NULL CHECK (sentiment IN ('positive','neutral','negative')),
    confidence          NUMERIC(5,2) NOT NULL,  -- 0.00 - 100.00
    entities            JSONB DEFAULT '{}',     -- {"date": "2026-10-26T15:00:00", "amount": 1240}
    suggested_reply     TEXT,
    key_action           TEXT,                   -- e.g. 'calendar_reschedule'
    requires_human_review BOOLEAN NOT NULL DEFAULT true,
    model_version       TEXT,                    -- for traceability / evals
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTOMATION RULES  (per-user automation plan, single active row per user)
-- ============================================================
CREATE TABLE automation_rules (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    master_switch_enabled       BOOLEAN NOT NULL DEFAULT true,
    response_strategy           TEXT NOT NULL DEFAULT 'human_in_the_loop' CHECK (response_strategy IN
                                 ('human_in_the_loop','hybrid_autopilot','full_autopilot')),
    confidence_threshold        NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    notify_on_negative_sentiment BOOLEAN NOT NULL DEFAULT true,
    bypass_automation_for_vip   BOOLEAN NOT NULL DEFAULT true,
    forward_financial_queries   BOOLEAN NOT NULL DEFAULT true,
    status                      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN
                                 ('draft','approved')),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- VOICE PROFILES  (required for full_autopilot)
-- ============================================================
CREATE TABLE voice_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tone            TEXT,                       -- 'formal' | 'casual' | 'warm' | 'concise'
    sample_messages JSONB DEFAULT '[]',         -- array of example replies the user approved/wrote
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- KNOWLEDGE BASE  (pricing, FAQs, availability — grounds RAG replies)
-- ============================================================
CREATE TABLE knowledge_base_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(1536),                   -- pgvector; or store externally in Pinecone
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- KEY ACTIONS  (side-effects triggered by an approved reply, e.g. calendar update)
-- ============================================================
CREATE TABLE key_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    ai_analysis_id  UUID REFERENCES ai_analysis(id),
    action_type     TEXT NOT NULL,              -- 'calendar_reschedule', 'send_invoice', ...
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                     ('pending','completed','failed')),
    payload         JSONB DEFAULT '{}',
    executed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG  (every AI suggestion + every human/system decision)
-- ============================================================
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    message_id      UUID REFERENCES messages(id),
    actor           TEXT NOT NULL,              -- 'user' | 'system'
    action          TEXT NOT NULL,              -- 'approve_send','custom_edit','delay_send',
                                                  -- 'auto_send','plan_approved','plan_discarded',
                                                  -- 'reconnect_platform'
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_user_time ON audit_log (user_id, created_at DESC);
```

## 3. Notes on Design Decisions
- **`ai_analysis` is separate from `messages`** so re-analysis (e.g., re-running with a new model version) never mutates the original message record — full traceability for evals.
- **`automation_rules` is one row per user** (not versioned) for MVP simplicity; if plan history matters later, add an `automation_rules_history` table populated on every "Approve Automation Plan" action.
- **`conversations.automation_override`** implements the per-conversation automation toggle seen in the conversation header, without needing a separate join table.
- **`platform_msg_id` + unique constraint on `messages`** guarantees idempotent webhook processing — critical since most platform webhooks are at-least-once delivery.
- **`key_actions`** is decoupled from `ai_analysis` so an action can be retried/tracked independently of the AI call that suggested it.
- Encrypt `access_token_enc` / `refresh_token_enc` at the application layer (KMS-backed) rather than relying on DB-level encryption alone.
