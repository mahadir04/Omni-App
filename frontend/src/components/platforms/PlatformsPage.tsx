import { useState, useEffect } from 'react';
import {
  Plus, MessageSquare, RefreshCw, Send
} from 'lucide-react';
import { listPlatforms, connectPlatform, simulateMessage } from '../../api';
import type { PlatformConnection } from '../../types';
import Sidebar from '../layout/Sidebar';
import { AddPlatformModal, PlatformRulesModal } from './PlatformModals';

const PLATFORM_ICONS: Record<string, { color: string; letter: string }> = {
  whatsapp: { color: '#25D366', letter: 'W' },
  slack: { color: '#4A154B', letter: '#' },
  email: { color: '#F59E0B', letter: '@' },
  linkedin: { color: '#0A66C2', letter: 'in' },
  sms: { color: '#6366F1', letter: 'SMS' },
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConnection | null>(null);

  // Simulation state
  const [simPlatform, setSimPlatform] = useState('whatsapp');
  const [simSender, setSimSender] = useState('Sarah Jenkins');
  const [simContent, setSimContent] = useState('Hi! Can we reschedule our demo call tomorrow to 3pm instead?');
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const load = () => {
    setLoading(true);
    listPlatforms()
      .then(setPlatforms)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleReconnect = async (p: PlatformConnection) => {
    try {
      await connectPlatform({
        platform: p.platform,
        external_account_id: p.external_account_id ?? undefined,
        access_token: 'mock-reconnected-token',
      });
      load();
    } catch (err) {
      console.error('Reconnect failed', err);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      await simulateMessage({
        sender_name: simSender,
        sender_handle: simPlatform === 'email' ? 'sarah@example.com' : '+15550192834',
        content: simContent,
        platform: simPlatform,
      });
      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 3000);
    } catch (err) {
      console.error('Simulation failed', err);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="settings-page">
        <div className="settings-container">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="header-title" style={{ fontSize: 24, margin: 0 }}>
                Platform Integrations
              </h1>
              <p className="header-sub" style={{ marginTop: 4 }}>
                Connect and manage all communication channels synchronized with your Omni AI Inbox.
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus size={16} /> Connect Platform
            </button>
          </div>

          {/* Connected Platforms Grid */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-title">Connected Channels</div>
              <div className="settings-card-desc">
                Active messaging streams routing conversations into your unified inbox.
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Loading platforms…
              </div>
            ) : platforms.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 20px' }}>
                <MessageSquare size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                <div className="empty-state-title">No Platforms Connected Yet</div>
                <div className="empty-state-desc">
                  Connect WhatsApp, Slack, Email, or LinkedIn to start automating your inbox.
                </div>
                <button
                  className="btn-primary"
                  onClick={() => setAddModalOpen(true)}
                  style={{ marginTop: 12 }}
                >
                  <Plus size={14} /> Connect Channel
                </button>
              </div>
            ) : (
              <div className="platform-grid">
                {platforms.map((p) => {
                  const icon = PLATFORM_ICONS[p.platform];
                  const profileName = p.metadata_?.profile_name || p.external_account_id || `${p.platform} Profile`;
                  const accountHandle = p.external_account_id || p.metadata_?.account_id || 'Connected';
                  return (
                    <div className="platform-card" key={p.id}>
                      <div className="platform-card-header">
                        <div
                          className="platform-card-icon"
                          style={{ background: icon?.color ?? '#6B7280', color: 'white', fontWeight: 700, fontSize: 13 }}
                        >
                          {icon?.letter ?? '?'}
                        </div>
                        <span
                          className={`platform-status ${
                            p.status === 'connected' ? 'connected' : p.status === 'reauth_required' ? 'reauth' : 'offline'
                          }`}
                        >
                          ● {p.status === 'connected' ? 'Active' : p.status === 'reauth_required' ? 'Re-auth required' : 'Offline'}
                        </span>
                      </div>

                      <div className="platform-name" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                        {p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}
                      </div>

                      {/* Connected Profile Details */}
                      <div style={{
                        marginTop: 10,
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          👤 {profileName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {accountHandle}
                        </div>
                        {p.created_at && (
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Synced since {new Date(p.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {p.status === 'reauth_required' ? (
                          <button
                            className="platform-card-btn reconnect-btn"
                            style={{ flex: 1 }}
                            onClick={() => handleReconnect(p)}
                          >
                            Reconnect
                          </button>
                        ) : (
                          <button
                            className="platform-card-btn"
                            style={{ flex: 1 }}
                            onClick={() => setSelectedPlatform(p)}
                          >
                            Platform Rules
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Platform dashed card */}
                <div className="platform-add-card" onClick={() => setAddModalOpen(true)}>
                  <Plus size={24} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Add Another Channel</span>
                </div>
              </div>
            )}
          </div>

          {/* Test & Simulation Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-title">Simulate Inbound Message</div>
              <div className="settings-card-desc">
                Send a test message through any platform to verify AI classification, entity extraction, and auto-reply suggestions.
              </div>
            </div>

            <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select
                    className="form-input"
                    value={simPlatform}
                    onChange={(e) => setSimPlatform(e.target.value)}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="slack">Slack</option>
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sender Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={simSender}
                    onChange={(e) => setSimSender(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Inbound Message Text</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: 70, resize: 'vertical' }}
                  value={simContent}
                  onChange={(e) => setSimContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {simSuccess && (
                  <span style={{ color: '#16A34A', fontSize: 13, fontWeight: 600 }}>
                    ✓ Message sent to Inbox! Check your Inbox to review the AI analysis.
                  </span>
                )}
                {!simSuccess && <span />}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={simulating}
                >
                  {simulating ? <RefreshCw size={14} className="spinner" /> : <Send size={14} />}
                  Simulate Message
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddPlatformModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={load}
      />

      <PlatformRulesModal
        platform={selectedPlatform}
        onClose={() => setSelectedPlatform(null)}
        onUpdated={load}
      />
    </div>
  );
}
