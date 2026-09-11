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
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', letter: 'W', placeholder: '+1 (555) 234-5678', desc: 'Direct client messaging' },
  { id: 'slack', name: 'Slack', color: '#4A154B', letter: '#', placeholder: 'acme-corp.slack.com', desc: 'Internal team & client channels' },
  { id: 'email', name: 'Email', color: '#F59E0B', letter: '@', placeholder: 'user@company.com', desc: 'Work inbox & newsletters' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', letter: 'in', placeholder: 'linkedin.com/in/profile', desc: 'InMail & network messages' },
  { id: 'sms', name: 'SMS', color: '#6366F1', letter: 'SMS', placeholder: '+1 (555) 987-6543', desc: 'SMS text messaging' },
];

export function AddPlatformModal({ isOpen, onClose, onSuccess }: AddPlatformModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState('whatsapp');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPlatformInfo = AVAILABLE_PLATFORMS.find((p) => p.id === selectedPlatform)!;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await connectPlatform({
        platform: selectedPlatform,
        external_account_id: accountId.trim() || undefined,
        access_token: 'mock-oauth-token',
      });
      onSuccess();
      onClose();
      setAccountId('');
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to connect platform. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
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
                  onClick={() => setSelectedPlatform(p.id)}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: p.color,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 11,
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

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Account Identifier / Handle</label>
              <input
                type="text"
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
