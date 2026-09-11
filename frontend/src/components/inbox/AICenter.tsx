import type { ReactNode } from 'react';
import { Send, Edit2, Clock, Calendar, AlertTriangle } from 'lucide-react';
import type { AIAnalysis } from '../../types';

const INTENT_LABELS: Record<string, string> = {
  reschedule_request: 'Reschedule Request',
  billing_inquiry: 'Billing Inquiry',
  new_lead: 'New Lead',
  general_question: 'General Question',
  complaint: 'Complaint',
  other: 'Other',
};

const KEY_ACTION_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  calendar_reschedule: { label: 'Calendar Reschedule', icon: <Calendar size={14} /> },
  send_invoice: { label: 'Send Invoice', icon: <Send size={14} /> },
  flag_for_review: { label: 'Flag for Review', icon: <AlertTriangle size={14} /> },
};

interface Props {
  analysis: AIAnalysis;
  platform: string;
  editMode: boolean;
  editContent: string;
  delayMode: boolean;
  delayMinutes: number;
  actionLoading: boolean;
  onEditContent: (v: string) => void;
  onApprove: () => void;
  onEditToggle: () => void;
  onEditSend: () => void;
  onDelayToggle: () => void;
  onDelayMinutesChange: (v: number) => void;
  onDelay: () => void;
}

export default function AICenter({
  analysis,
  platform,
  editMode,
  editContent,
  delayMode,
  delayMinutes,
  actionLoading,
  onEditContent,
  onApprove,
  onEditToggle,
  onEditSend,
  onDelayToggle,
  onDelayMinutesChange,
  onDelay,
}: Props) {
  const intentLabel = INTENT_LABELS[analysis.intent] ?? analysis.intent;
  const keyAction = analysis.key_action ? KEY_ACTION_LABELS[analysis.key_action] : null;
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <div className="ai-center">
      {/* Header */}
      <div className="ai-center-header">
        <div className="ai-center-title">
          <span className="ai-status-dot" />
          AI Intelligence Center
        </div>
        <span className="ai-status-badge">Context Analysis Complete</span>
      </div>

      {/* Body: Suggested response + metadata */}
      <div className="ai-center-body">
        {/* Left: suggested response */}
        <div>
          <div className="ai-suggested-response-label">Suggested Response</div>
          {editMode ? (
            <textarea
              value={editContent}
              onChange={(e) => onEditContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: 80,
                padding: '10px 14px',
                border: '1px solid var(--crimson-600)',
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <div className="ai-draft-text">
              "{analysis.suggested_reply}"
            </div>
          )}
        </div>

        {/* Right: sentiment + key action + confidence */}
        <div className="ai-meta">
          <div className="ai-meta-item">
            <div className="ai-meta-label">Sentiment</div>
            <div className="sentiment-value">
              <span className={`sentiment-dot ${analysis.sentiment}`} />
              {analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1)}
              {' / '}
              {intentLabel}
            </div>
          </div>

          {keyAction && (
            <div className="ai-meta-item">
              <div className="ai-meta-label">Key Action</div>
              <div className="key-action-value">
                {keyAction.icon}
                {keyAction.label}
              </div>
            </div>
          )}

          <div className="ai-meta-item">
            <div className="ai-meta-label">Confidence</div>
            <div className="confidence-bar-row">
              <div className="confidence-bar-track">
                <div
                  className="confidence-bar-fill"
                  style={{ width: `${analysis.confidence}%` }}
                />
              </div>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{analysis.confidence.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delay mode UI */}
      {delayMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', marginBottom: 10,
          background: 'var(--bg-secondary)', borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Delay for:</span>
          <select
            value={delayMinutes}
            onChange={(e) => onDelayMinutesChange(Number(e.target.value))}
            style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid var(--border)', fontSize: 13,
              outline: 'none',
            }}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={240}>4 hours</option>
            <option value={480}>8 hours</option>
            <option value={1440}>24 hours</option>
          </select>
          <button
            className="btn btn-primary"
            style={{ padding: '6px 16px', fontSize: 12 }}
            onClick={onDelay}
            disabled={actionLoading}
          >
            Confirm Delay
          </button>
          <button
            className="btn btn-outline"
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={onDelayToggle}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="action-buttons">
        <button
          className="btn btn-outline"
          onClick={editMode ? onEditSend : onEditToggle}
          disabled={actionLoading}
        >
          <Edit2 size={14} />
          {editMode ? 'Send Edit' : 'Custom Edit'}
        </button>

        <button
          className="btn btn-outline"
          onClick={onDelayToggle}
          disabled={actionLoading}
        >
          <Clock size={14} />
          Delay Send
        </button>

        <button
          className="btn btn-primary"
          onClick={onApprove}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <span className="spinner" />
          ) : (
            <>
              Approve & Send to {platformName}
              <Send size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
