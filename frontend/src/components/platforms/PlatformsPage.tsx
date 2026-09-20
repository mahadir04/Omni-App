import { useState, useEffect } from 'react';
import {
  Plus, MessageSquare, RefreshCw, Send, Smartphone, SmartphoneCharging, Trash2, Copy, Check, Download
} from 'lucide-react';
import { listPlatforms, connectPlatform, simulateMessage, listDevices, getPairingInfo, deleteDevice } from '../../api';
import type { PlatformConnection, DeviceConnection, PairingInfo } from '../../types';
import Sidebar from '../layout/Sidebar';
import { AddPlatformModal, PlatformRulesModal } from './PlatformModals';

const PLATFORM_ICONS: Record<string, { color: string; letter: string }> = {
  telegram: { color: '#229ED9', letter: 'TG' },
  whatsapp: { color: '#25D366', letter: 'W' },
  messenger: { color: '#0084FF', letter: 'M' },
  instagram: { color: '#E1306C', letter: 'IG' },
  slack: { color: '#4A154B', letter: '#' },
  email: { color: '#F59E0B', letter: '@' },
  linkedin: { color: '#0A66C2', letter: 'in' },
  sms: { color: '#6366F1', letter: 'SMS' },
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [devices, setDevices] = useState<DeviceConnection[]>([]);
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConnection | null>(null);

  // Simulation state
  const [simPlatform, setSimPlatform] = useState('whatsapp');
  const [simSender, setSimSender] = useState('Sarah Jenkins');
  const [simContent, setSimContent] = useState('Hi! Can we reschedule our demo call tomorrow to 3pm instead?');
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const [customServerUrl, setCustomServerUrl] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      listPlatforms().catch(() => []),
      listDevices().catch(() => []),
    ])
      .then(([platData, devData]) => {
        setPlatforms(platData);
        setDevices(devData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handlePairClick = async (overrideHost?: string) => {
    setPairError(null);
    setPairingLoading(true);
    try {
      const host = overrideHost !== undefined ? overrideHost : customServerUrl;
      const info = await getPairingInfo(host || undefined);
      setPairingInfo(info);
      if (!customServerUrl) {
        setCustomServerUrl(info.server_url);
      }
      setShowPairingModal(true);
    } catch (e: any) {
      console.error('Failed to get pairing info', e);
      const msg = e?.response?.data?.detail || 'Failed to load pairing info. Please ensure you are logged in.';
      setPairError(msg);
      alert(msg);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Unpair this Android device?')) return;
    try {
      await deleteDevice(deviceId);
      load();
    } catch (e) {
      console.error('Failed to delete device', e);
    }
  };

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
                  const profileName = String(p.metadata_?.profile_name || p.external_account_id || `${p.platform} Profile`);
                  const accountHandle = String(p.external_account_id || p.metadata_?.account_id || 'Connected');
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

          {/* Android Phone Bridge Section */}
          <div className="settings-card" style={{ border: '1px solid #238636', background: 'rgba(35, 134, 54, 0.04)' }}>
            <div className="settings-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Smartphone size={18} color="#3FB950" />
                  <span>Android Phone Bridge (WhatsApp, Messenger, Instagram, SMS)</span>
                  <span style={{ fontSize: 11, background: '#238636', color: 'white', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                    Zero Meta API Fees
                  </span>
                </div>
                <div className="settings-card-desc" style={{ marginTop: 4 }}>
                  Connect your Android phone to intercept WhatsApp, Messenger, and Instagram notifications locally. Messages flow directly into your Omni inbox, and replies are auto-routed through your phone.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href="/app-debug.apk"
                  download="omni-bridge-latest.apk"
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  title="Download Latest Android Bridge APK"
                >
                  <Download size={15} /> Download APK
                </a>
                <button
                  className="btn-primary"
                  onClick={() => handlePairClick()}
                  disabled={pairingLoading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <SmartphoneCharging size={16} /> {pairingLoading ? 'Connecting...' : 'Pair Android Phone'}
                </button>
              </div>
            </div>

            {pairError && (
              <div style={{
                marginTop: 10,
                padding: '8px 12px',
                background: 'rgba(218, 54, 51, 0.15)',
                border: '1px solid rgba(218, 54, 51, 0.4)',
                borderRadius: 6,
                color: '#f85149',
                fontSize: 12,
              }}>
                {pairError}
              </div>
            )}

            {/* Devices List */}
            <div style={{ marginTop: 14 }}>
              {devices.length === 0 ? (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-primary)',
                  borderRadius: 8,
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                }}>
                  No Android phones paired yet. Click <b>Pair Android Phone</b> to link your device.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {devices.map((d) => (
                    <div
                      key={d.device_id}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--bg-primary)',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: d.is_online ? '#3FB950' : '#8B949E',
                            display: 'inline-block',
                            boxShadow: d.is_online ? '0 0 8px #3FB950' : 'none',
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {d.device_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {d.is_online ? 'Live Connected' : d.last_seen_at ? `Last seen ${new Date(d.last_seen_at).toLocaleTimeString()}` : 'Offline'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDevice(d.device_id)}
                        className="btn-icon"
                        style={{ color: '#F85149', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}
                        title="Unpair Device"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Webhook Reference Card */}
          <div className="settings-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="settings-card-header">
              <div className="settings-card-title">📡 Live Inbound Webhook Endpoints</div>
              <div className="settings-card-desc">
                Public webhook endpoints for cloud-based channels (Telegram, Slack, Twilio SMS).
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 8 }}>
              {[
                { name: 'Telegram Bot', method: 'Automatic', path: '/api/webhooks/telegram', note: 'Auto-configured when connecting Bot Token' },
                { name: 'Slack Events', method: 'POST', path: '/api/webhooks/slack', note: 'Request URL in Slack Event Subscriptions' },
                { name: 'Twilio SMS', method: 'POST', path: '/api/webhooks/sms', note: 'Twilio Phone Number webhook URL' },
                { name: 'Phone Bridge', method: 'WebSocket / REST', path: '/ws/device/{device_id}', note: 'WhatsApp, Messenger, Instagram local bridge' },
              ].map((wh) => (
                <div key={wh.name} style={{
                  padding: '10px 12px',
                  background: 'var(--bg-primary)',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{wh.name}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', fontWeight: 600 }}>{wh.method}</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#3B82F6', wordBreak: 'break-all' }}>
                    {wh.path.startsWith('/ws') ? `ws://localhost:8000${wh.path}` : `https://omni-app-wt70.onrender.com${wh.path}`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{wh.note}</div>
                </div>
              ))}
            </div>
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
                    <option value="telegram">Telegram</option>
                    <option value="messenger">Messenger</option>
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

      {/* Phone Pairing Modal */}
      {showPairingModal && pairingInfo && (() => {
        const effectiveServer = (customServerUrl || pairingInfo.server_url || 'http://192.168.0.100:8000').trim().replace(/\/+$/, '');
        const effectiveDeepLink = `omni://pair?server=${encodeURIComponent(effectiveServer)}&token=${encodeURIComponent(pairingInfo.token)}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(effectiveDeepLink)}`;

        return (
          <div className="modal-backdrop" onClick={() => setShowPairingModal(false)}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-header">
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Smartphone size={20} color="#3FB950" />
                  <span>Pair Android Companion App</span>
                </div>
                <button className="modal-close" onClick={() => setShowPairingModal(false)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Method 1: Direct In-App Login banner */}
                <div style={{
                  background: 'rgba(56, 139, 253, 0.1)',
                  border: '1px solid rgba(56, 139, 253, 0.3)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 16,
                  fontSize: 13,
                  lineHeight: 1.4,
                }}>
                  <div style={{ fontWeight: 600, color: '#58a6ff', marginBottom: 4 }}>
                    ⚡ Fastest Method: Sign In Directly On Your Phone
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Open the <b>Omni Bridge</b> app installed on your phone, type your email and password (or Sign Up), and tap <b>"Sign In & Link Phone"</b>. No QR scan or manual tokens required!
                  </div>
                </div>

                {/* Method 2: QR Code Scan */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'var(--bg-primary)',
                  padding: '16px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
                    Scan QR Code with Phone Camera or Omni App
                  </div>
                  <div style={{
                    background: '#ffffff',
                    padding: 8,
                    borderRadius: 8,
                    display: 'inline-block',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    <img
                      src={qrCodeUrl}
                      alt="Pairing QR Code"
                      width={180}
                      height={180}
                      style={{ display: 'block', borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Point your camera or tap "Scan QR" in the phone bridge app
                  </div>
                </div>

                {/* Server URL Input */}
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Phone-Accessible Server URL:</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(LAN IP or domain)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={customServerUrl}
                    onChange={(e) => setCustomServerUrl(e.target.value)}
                    placeholder="http://192.168.0.100:8000"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>

                {/* One-click Deep link */}
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">One-Click Deep Link:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      readOnly
                      className="form-input"
                      value={effectiveDeepLink}
                      style={{ fontFamily: 'monospace', fontSize: 11 }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(effectiveDeepLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Auth Token */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0 }}>Auth Token:</label>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => {
                        navigator.clipboard.writeText(pairingInfo.token);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2500);
                      }}
                    >
                      {copiedToken ? <Check size={12} /> : <Copy size={12} />}
                      {copiedToken ? 'Copied' : 'Copy Token'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    className="form-input"
                    rows={2}
                    value={pairingInfo.token}
                    style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowPairingModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
