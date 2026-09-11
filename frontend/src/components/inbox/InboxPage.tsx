import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { listConversations } from '../../api';
import type { ConversationListItem, WsEvent } from '../../types';
import { useWebSocket } from '../../hooks/useWebSocket';
import ConversationCard from './ConversationCard';
import ConversationView from './ConversationView';
import Sidebar from '../layout/Sidebar';
import { useAuthStore } from '../../store/authStore';

const STATUS_FILTERS = ['All', 'Unread', 'Flagged'];
const PLATFORM_FILTERS = ['All', 'Messenger', 'WhatsApp', 'Slack', 'Email', 'LinkedIn', 'SMS'];

export default function InboxPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  const loadConversations = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (platformFilter !== 'All') params.platform = platformFilter.toLowerCase();
      if (statusFilter === 'Unread') params.status = 'open';
      if (statusFilter === 'Flagged') params.status = 'flagged';
      if (search) params.search = search;
      const data = await listConversations(params);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoading(false);
    }
  }, [platformFilter, statusFilter, search]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Live updates via WebSocket
  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.event === 'new_message') {
      // Reload conversation list to reflect new message
      loadConversations();
    } else if (event.event === 'ai_analysis_ready') {
      // Update AI preview in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === event.data.conversation_id
            ? {
                ...c,
                ai_sentiment: event.data.sentiment as ConversationListItem['ai_sentiment'],
                ai_intent: event.data.intent,
                ai_confidence: event.data.confidence,
              }
            : c
        )
      );
    } else if (event.event === 'notification') {
      // TODO: Show a toast/notification
      console.log('[Notification]', event.data.title);
    }
  }, [loadConversations]);

  useWebSocket(user?.id ?? null, handleWsEvent);

  const filtered = conversations.filter((c) => {
    if (statusFilter === 'Unread') return c.unread_count > 0;
    if (statusFilter === 'Flagged') return c.status === 'flagged';
    return true;
  });

  return (
    <div className="app-shell">
      <Sidebar unreadCount={totalUnread} />

      {/* ── Inbox list panel ──────────────────────────────────────────── */}
      <div className={`inbox-panel ${selectedId ? 'has-selection' : ''}`}>
        <div className="inbox-header">
          <div className="inbox-title">
            Inbox
            {totalUnread > 0 && <span className="inbox-count">{totalUnread}</span>}
          </div>
          <div className="search-bar">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Status filters */}
        <div className="filter-tabs">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Platform filter chips */}
        <div className="platform-filter">
          {PLATFORM_FILTERS.map((p) => (
            <button
              key={p}
              className={`platform-chip ${platformFilter === p ? 'active' : ''}`}
              onClick={() => setPlatformFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="conversation-list">
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Loading conversations…
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-title">No conversations yet</div>
              <div className="empty-state-desc">Messages from your connected platforms will appear here</div>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                isActive={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Conversation detail ───────────────────────────────────────── */}
      {selectedId ? (
        <ConversationView
          conversationId={selectedId}
          onBack={() => setSelectedId(null)}
          onRefreshList={loadConversations}
        />
      ) : (
        <div className="empty-state empty-state-desktop" style={{ flex: 1 }}>
          <div style={{ fontSize: 40 }}>💬</div>
          <div className="empty-state-title">Select a conversation</div>
          <div className="empty-state-desc">Choose a conversation from the list to view it</div>
        </div>
      )}
    </div>
  );
}
