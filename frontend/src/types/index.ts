// ── API Types — matching backend Pydantic schemas ─────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Contact {
  id: string;
  display_name: string;
  platform: string;
  platform_handle: string;
  is_vip: boolean;
  avatar_url: string | null;
  last_seen_at: string | null;
}

export type ConversationLabel = 'urgent' | 'action' | 'new_lead' | null;
export type ConversationStatus = 'open' | 'flagged' | 'archived';
export type AutomationOverride = 'inherit' | 'force_manual' | 'force_auto';

export interface ConversationListItem {
  id: string;
  platform: string;
  status: ConversationStatus;
  label: ConversationLabel;
  unread_count: number;
  last_message_at: string | null;
  automation_override: AutomationOverride;
  contact: Contact;
  last_message_preview: string | null;
  ai_sentiment: 'positive' | 'neutral' | 'negative' | null;
  ai_intent: string | null;
  ai_confidence: number | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  sender: 'contact' | 'user' | 'ai';
  content: string;
  sent_at: string;
}

export interface AIAnalysis {
  id: string;
  message_id: string;
  intent: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  entities: {
    date?: string | null;
    amount?: number | null;
    other?: string | null;
  };
  suggested_reply: string | null;
  key_action: string | null;
  requires_human_review: boolean;
  reasoning_summary: string | null;
  model_version: string | null;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  platform: string;
  status: ConversationStatus;
  label: ConversationLabel;
  unread_count: number;
  last_message_at: string | null;
  automation_override: AutomationOverride;
  contact: Contact;
  messages: Message[];
  latest_ai_analysis: AIAnalysis | null;
}

export type ResponseStrategy = 'human_in_the_loop' | 'hybrid_autopilot' | 'full_autopilot';

export interface AutomationRules {
  master_switch_enabled: boolean;
  response_strategy: ResponseStrategy;
  confidence_threshold: number;
  notify_on_negative_sentiment: boolean;
  bypass_automation_for_vip: boolean;
  forward_financial_queries: boolean;
  status: 'draft' | 'approved';
}

export interface PlatformConnection {
  id: string;
  platform: string;
  status: 'connected' | 'offline' | 'reauth_required';
  external_account_id: string | null;
  metadata_: Record<string, unknown>;
  created_at: string;
}

// ── WebSocket Events ──────────────────────────────────────────────────────

export interface WsNewMessageEvent {
  event: 'new_message';
  data: {
    conversation_id: string;
    message_id: string;
    platform: string;
    sender_name: string;
    content: string;
    sent_at: string;
    unread_count: number;
  };
}

export interface WsAIReadyEvent {
  event: 'ai_analysis_ready';
  data: {
    conversation_id: string;
    message_id: string;
    intent: string;
    sentiment: string;
    confidence: number;
    suggested_reply: string;
    key_action: string | null;
    requires_human_review: boolean;
    reasoning_summary: string;
  };
}

export interface WsNotificationEvent {
  event: 'notification';
  data: {
    type: 'urgent' | 'info';
    title: string;
    conversation_id: string;
    reason: string;
  };
}

export type WsEvent = WsNewMessageEvent | WsAIReadyEvent | WsNotificationEvent;
