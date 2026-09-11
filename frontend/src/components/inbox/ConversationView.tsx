import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { getConversation, approveAndSend, editAndSend, delaySend } from '../../api';
import type { ConversationDetail } from '../../types';
import AICenter from './AICenter';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Props {
  conversationId: string;
  onBack: () => void;
  onRefreshList: () => void;
}

export default function ConversationView({ conversationId, onBack, onRefreshList }: Props) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [delayMode, setDelayMode] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(60);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getConversation(conversationId);
      setConversation(data);
      if (data.latest_ai_analysis?.suggested_reply) {
        setEditContent(data.latest_ai_analysis.suggested_reply);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleApprove = async () => {
    if (!conversation) return;
    setActionLoading(true);
    try {
      await approveAndSend(conversation.id);
      await load();
      onRefreshList();
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSend = async () => {
    if (!conversation || !editContent.trim()) return;
    setActionLoading(true);
    try {
      await editAndSend(conversation.id, editContent);
      setEditMode(false);
      await load();
      onRefreshList();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelay = async () => {
    if (!conversation) return;
    setActionLoading(true);
    try {
      await delaySend(conversation.id, delayMinutes);
      setDelayMode(false);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="conversation-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading conversation…</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="conversation-detail empty-state">
        <div className="empty-state-title">Conversation not found</div>
      </div>
    );
  }

  const { contact, messages, latest_ai_analysis: ai } = conversation;

  // Group messages by date
  let lastDate = '';

  return (
    <div className="conversation-detail">
      {/* ── Header ── */}
      <div className="detail-header">
        <div className="detail-header-left">
          <button className="icon-btn" onClick={onBack} title="Back">
            <ChevronLeft size={18} />
          </button>

          <div
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0,
            }}
          >
            {contact.display_name[0].toUpperCase()}
          </div>

          <div>
            <div className="detail-contact-name">
              {contact.display_name}
              {contact.is_vip && <span className="vip-badge">VIP Client</span>}
            </div>
            <div className="detail-contact-sub">
              {contact.platform_handle}
              {contact.last_seen_at && ` · Last seen ${new Date(contact.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ago`}
            </div>
          </div>
        </div>

        <div className="detail-header-actions">
          <div className="automation-toggle-row">
            Automation:
            <span
              style={{
                width: 34, height: 18, borderRadius: 9,
                background: conversation.automation_override === 'force_manual' ? 'var(--border-strong)' : 'var(--crimson-600)',
                display: 'inline-block', cursor: 'pointer', position: 'relative',
              }}
              title={`Override: ${conversation.automation_override}`}
            >
              <span style={{
                position: 'absolute', top: 2, left: conversation.automation_override === 'force_manual' ? 2 : 16,
                width: 14, height: 14, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s',
              }} />
            </span>
          </div>
          <button className="icon-btn" title="More options"><MoreHorizontal size={16} /></button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="messages-area">
        {messages.map((msg) => {
          const msgDate = formatDate(msg.sent_at);
          const showDate = msgDate !== lastDate;
          if (showDate) lastDate = msgDate;

          return (
            <div key={msg.id}>
              {showDate && <div className="date-divider">Today · {msgDate}</div>}
              <div className={`message-row ${msg.direction}`}>
                {msg.direction === 'inbound' && (
                  <div
                    className="message-avatar-placeholder"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  >
                    {contact.display_name[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className={`message-bubble ${msg.direction}`}>
                    {msg.content}
                  </div>
                  <div className="message-time">{formatTime(msg.sent_at)}</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* AI processing indicator */}
        {ai && (
          <div className="ai-processing-indicator">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--crimson-600)', display: 'inline-block' }} />
            AI detected {ai.intent.replace(/_/g, ' ')} · Confidence: {ai.confidence.toFixed(0)}%
            {ai.sentiment && ` · Sentiment: ${ai.sentiment.charAt(0).toUpperCase() + ai.sentiment.slice(1)}`}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── AI Intelligence Center ── */}
      {ai && (
        <AICenter
          analysis={ai}
          platform={conversation.platform}
          editMode={editMode}
          editContent={editContent}
          delayMode={delayMode}
          delayMinutes={delayMinutes}
          actionLoading={actionLoading}
          onEditContent={setEditContent}
          onApprove={handleApprove}
          onEditToggle={() => {
            setEditMode(!editMode);
            setDelayMode(false);
          }}
          onEditSend={handleEditSend}
          onDelayToggle={() => {
            setDelayMode(!delayMode);
            setEditMode(false);
          }}
          onDelayMinutesChange={setDelayMinutes}
          onDelay={handleDelay}
        />
      )}
    </div>
  );
}
