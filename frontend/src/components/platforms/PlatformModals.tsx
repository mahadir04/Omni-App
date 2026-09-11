import { useState } from 'react';
import { X, Check, Clock, Shield } from 'lucide-react';
import type { PlatformConnection } from '../../types';
import { connectPlatform, disconnectPlatform } from '../../api';

interface AddPlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_PLATFORMS = [
  { id: 'telegram', name: 'Telegram', color: '#229ED9', letter: 'TG', placeholder: 'e.g. 7123456789:AAHk...', desc: 'Connect free bot created with @BotFather', isToken: true },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', letter: 'W', placeholder: '+1 (555) 234-5678', desc: 'Twilio Sandbox or Meta Cloud API' },
  { id: 'messenger', name: 'Messenger', color: '#0084FF', letter: 'M', placeholder: 'Facebook Page ID or Page Name', desc: 'Facebook & Meta Messenger' },
  { id: 'slack', name: 'Slack', color: '#4A154B', letter: '#', placeholder: 'acme-corp.slack.com', desc: 'Bot Token or Workspace' },
  { id: 'email', name: 'Email', color: '#F59E0B', letter: '@', placeholder: 'user@company.com', desc: 'Work inbox & newsletters' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', letter: 'in', placeholder: 'linkedin.com/in/profile', desc: 'InMail & network messages' },
  { id: 'sms', name: 'SMS', color: '#6366F1', letter: 'SMS', placeholder: '+1 (555) 987-6543', desc: 'Twilio SMS messaging' },
];

export function AddPlatformModal({ isOpen, onClose, onSuccess }: AddPlatformModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState('telegram');
  const [profileName, setProfileName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPlatformInfo = AVAILABLE_PLATFORMS.find((p) => p.id === selectedPlatform)!;
  const webhookUrl = `https://omni-app-wt70.onrender.com/api/webhooks/${selectedPlatform}`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = apiToken.trim() || (selectedPlatform === 'telegram' ? accountId.trim() : 'mock-token');
      await connectPlatform({
        platform: selectedPlatform,
        profile_name: profileName.trim() || undefined,
        external_account_id: accountId.trim() || undefined,
        access_token: token,
      });
      onSuccess();
      onClose();
      setProfileName('');
      setAccountId('');
      setApiToken('');
    } catch (err: any) {
      console.error(err);
      const serverMsg = err?.response?.data?.detail || err?.message;
      setError(serverMsg || 'Failed to connect platform. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Connect Communication Platform</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleConnect}>
          <div className="modal-body">
            <label className="form-label">Select Channel</label>
            <div className="platform-selector-grid">
              {AVAILABLE_PLATFORMS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`platform-select-btn ${selectedPlatform === p.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPlatform(p.id);
                    setError(null);
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: p.color,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.letter}
                  </span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Platform Setup Helper / Guide */}
            {selectedPlatform === 'telegram' && (
              <div style={{
                background: 'rgba(34, 158, 217, 0.08)',
                border: '1px solid rgba(34, 158, 217, 0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 700, color: '#229ED9', marginBottom: 4 }}>
                  ⚡ Free Instant Setup via Telegram Bot
                </div>
                1. Open Telegram &amp; message <b>@BotFather</b><br />
                2. Send <code>/newbot</code> and follow prompts to get your Bot Token<br />
                3. Paste the Bot Token below — Omni will automatically register the live webhook!
              </div>
            )}

            {selectedPlatform === 'whatsapp' && (
              <div style={{
                background: 'rgba(37, 211, 102, 0.08)',
                border: '1px solid rgba(37, 211, 102, 0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 700, color: '#25D366', marginBottom: 4 }}>
                  🔗 Webhook URL for Twilio / Meta Cloud API
                </div>
                Paste this Webhook URL in your Twilio WhatsApp Sandbox or Meta App settings:
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input
                    type="text"
                    readOnly
                    className="form-input"
                    style={{ fontSize: 11, fontFamily: 'monospace', padding: '6px 8px' }}
                    value={webhookUrl}
                  />
                  <button type="button" className="btn-secondary" onClick={copyWebhook} style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '6px 12px' }}>
                    {copiedWebhook ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {selectedPlatform === 'messenger' && (
              <div style={{
                background: 'rgba(0, 132, 255, 0.08)',
                border: '1px solid rgba(0, 132, 255, 0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 700, color: '#0084FF', marginBottom: 4 }}>
                  🔗 Meta Messenger Webhook URL
                </div>
                In Meta Developer Dashboard &gt; Messenger &gt; Webhooks, subscribe to <code>messages</code>:
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input
                    type="text"
                    readOnly
                    className="form-input"
                    style={{ fontSize: 11, fontFamily: 'monospace', padding: '6px 8px' }}
                    value={webhookUrl}
                  />
                  <button type="button" className="btn-secondary" onClick={copyWebhook} style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '6px 12px' }}>
                    {copiedWebhook ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Profile / Display Name</label>
              <input
                type="text"
                className="form-input"
                placeholder={selectedPlatform === 'telegram' ? 'e.g. My Telegram Bot' : 'e.g. Support Inbox or Personal'}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {selectedPlatform === 'telegram' ? 'Telegram Bot Token' : 'Account Identifier / Number / Page'}
              </label>
              <input
                type={selectedPlatform === 'telegram' ? 'password' : 'text'}
                className="form-input"
                required
                placeholder={currentPlatformInfo.placeholder}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {currentPlatformInfo.desc}
              </div>
            </div>

            {selectedPlatform !== 'telegram' && (
              <div className="form-group">
                <label className="form-label">API Access Token / Secret (Optional)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Paste OAuth token, Bot token, or API Key (optional)"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>
            )}

            {error && <div className="error-text">{error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Connecting…' : `Connect ${currentPlatformInfo.name}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PlatformRulesModalProps {
  platform: PlatformConnection | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function PlatformRulesModal({ platform, onClose, onUpdated }: PlatformRulesModalProps) {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [quietHours, setQuietHours] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!platform) return null;

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${platform.platform.toUpperCase()}?`)) return;
    setDisconnecting(true);
    try {
      await disconnectPlatform(platform.id);
      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to disconnect platform.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {platform.platform.toUpperCase()} Rules & Settings
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Account: {platform.external_account_id ?? 'Default'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Connected on {new Date(platform.created_at).toLocaleDateString()}
              </div>
            </div>
            <span className={`platform-status ${platform.status === 'connected' ? 'connected' : 'reauth'}`}>
              ● {platform.status === 'connected' ? 'Active' : 'Re-auth required'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Auto-Reply via AI
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Allow AI autopilot & suggestion engine on this channel
                </div>
              </div>
              <input
                type="checkbox"
                className="trigger-checkbox"
                checked={autoReplyEnabled}
                onChange={(e) => setAutoReplyEnabled(e.target.checked)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Quiet Hours (10:00 PM – 07:00 AM)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Queue replies for morning delivery instead of sending overnight
                </div>
              </div>
              <input
                type="checkbox"
                className="trigger-checkbox"
                checked={quietHours}
                onChange={(e) => setQuietHours(e.target.checked)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  VIP Protection
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  VIP contacts on this channel always bypass auto-send
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4 }}>
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              {saved ? <Check size={14} /> : 'Save Rules'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
