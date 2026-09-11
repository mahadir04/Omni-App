import type { ConversationListItem } from '../../types';

const PLATFORM_COLORS: Record<string, string> = {
  messenger: '#0084FF',
  whatsapp: '#25D366',
  slack: '#4A154B',
  linkedin: '#0A66C2',
  email: '#F59E0B',
  sms: '#6366F1',
};

const PLATFORM_LETTERS: Record<string, string> = {
  messenger: 'M',
  whatsapp: 'W',
  slack: 'S',
  linkedin: 'in',
  email: '@',
  sms: 'SMS',
};

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
}

interface Props {
  conversation: ConversationListItem;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationCard({ conversation: c, isActive, onClick }: Props) {
  const initial = c.contact.display_name[0]?.toUpperCase() ?? '?';
  const platformColor = PLATFORM_COLORS[c.platform] ?? '#6B7280';
  const platformLetter = PLATFORM_LETTERS[c.platform] ?? '?';

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Avatar with platform dot */}
      <div className="conv-avatar">
        {c.contact.avatar_url ? (
          <img src={c.contact.avatar_url} alt={c.contact.display_name} />
        ) : (
          <div
            className="conv-avatar-placeholder"
            style={{ background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` }}
          >
            {initial}
          </div>
        )}
        <div
          className="platform-dot"
          style={{ background: platformColor, fontSize: 7, color: 'white', fontWeight: 700 }}
        >
          {platformLetter}
        </div>
      </div>

      {/* Body */}
      <div className="conv-body">
        <div className="conv-header">
          <span className="conv-name">{c.contact.display_name}</span>
          <div className="conv-meta">
            {c.label && (
              <span className={`conv-label ${c.label}`}>
                {c.label === 'new_lead' ? 'New Lead' : c.label.charAt(0).toUpperCase() + c.label.slice(1)}
              </span>
            )}
            {c.unread_count > 0 && (
              <span className="conv-unread">{c.unread_count}</span>
            )}
          </div>
        </div>

        <div className="conv-platform-name">
          {c.platform.charAt(0).toUpperCase() + c.platform.slice(1)}
          {' · '}
          <span className="conv-time">{formatTime(c.last_message_at)}</span>
        </div>

        <div className="conv-preview">
          {c.last_message_preview ?? 'No messages yet'}
        </div>
      </div>
    </div>
  );
}
