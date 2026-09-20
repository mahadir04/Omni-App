import api from './client';
import type {
  ConversationListItem,
  ConversationDetail,
  AutomationRules,
  PlatformConnection,
} from '../types';

// ── Conversations ─────────────────────────────────────────────────────────

export const listConversations = (params?: {
  platform?: string;
  status?: string;
  label?: string;
  search?: string;
  page?: number;
}) => api.get<ConversationListItem[]>('/conversations', { params }).then((r) => r.data);

export const getConversation = (id: string) =>
  api.get<ConversationDetail>(`/conversations/${id}`).then((r) => r.data);

export const updateConversation = (
  id: string,
  data: { status?: string; label?: string; automation_override?: string }
) => api.patch(`/conversations/${id}`, data).then((r) => r.data);

export const approveAndSend = (conversationId: string) =>
  api.post(`/conversations/${conversationId}/approve`).then((r) => r.data);

export const editAndSend = (conversationId: string, content: string) =>
  api.post(`/conversations/${conversationId}/edit-and-send`, { content }).then((r) => r.data);

export const delaySend = (conversationId: string, delay_minutes: number) =>
  api.post(`/conversations/${conversationId}/delay`, { delay_minutes }).then((r) => r.data);

// ── Automation Rules ──────────────────────────────────────────────────────

export const getAutomationRules = () =>
  api.get<AutomationRules>('/automation-rules').then((r) => r.data);

export const updateAutomationRules = (data: Partial<AutomationRules>) =>
  api.put<AutomationRules>('/automation-rules', data).then((r) => r.data);

export const approveAutomationPlan = () =>
  api.post<AutomationRules>('/automation-rules/approve').then((r) => r.data);

export const discardAutomationChanges = () =>
  api.post<AutomationRules>('/automation-rules/discard').then((r) => r.data);

// ── Platforms ─────────────────────────────────────────────────────────────

export const listPlatforms = () =>
  api.get<PlatformConnection[]>('/platforms').then((r) => r.data);

export const connectPlatform = (data: {
  platform: string;
  external_account_id?: string;
  profile_name?: string;
  metadata_?: Record<string, any>;
  access_token?: string;
}) => api.post<PlatformConnection>('/platforms/connect', data).then((r) => r.data);

export const disconnectPlatform = (id: string) =>
  api.delete(`/platforms/${id}`);

export const reconnectPlatform = (id: string) =>
  api.post<PlatformConnection>(`/platforms/${id}/reconnect`).then((r) => r.data);

// ── Contacts ──────────────────────────────────────────────────────────────

export const updateContact = (id: string, data: { is_vip?: boolean; display_name?: string }) =>
  api.patch(`/contacts/${id}`, data).then((r) => r.data);

// ── Device Bridge ─────────────────────────────────────────────────────────

export const listDevices = () =>
  api.get<import('../types').DeviceConnection[]>('/device/status').then((r) => r.data);

export const getPairingInfo = () =>
  api.get<import('../types').PairingInfo>('/device/pairing-info').then((r) => r.data);

export const deleteDevice = (deviceId: string) =>
  api.delete(`/device/${deviceId}`);

// ── Dev ───────────────────────────────────────────────────────────────────

export const simulateMessage = (data: {
  sender_name: string;
  sender_handle: string;
  content: string;
  platform?: string;
}) => api.post('/dev/simulate-message', data).then((r) => r.data);
