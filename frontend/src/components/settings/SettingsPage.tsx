import { useState } from 'react';
import { User, Bell, Mic, Shield, Check, LogOut } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Sidebar from '../layout/Sidebar';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Voice profile settings (Epic 9)
  const [tone, setTone] = useState<'executive' | 'concise' | 'friendly' | 'formal'>('executive');
  const [signature, setSignature] = useState('Sent via Omni Executive Assistant');
  const [notifyNegative, setNotifyNegative] = useState(true);
  const [notifyVip, setNotifyVip] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="settings-page">
        <div className="settings-container">
          {/* Header */}
          <div>
            <h1 className="header-title" style={{ fontSize: 24, margin: 0 }}>
              Account & System Settings
            </h1>
            <p className="header-sub" style={{ marginTop: 4 }}>
              Manage your personal profile, AI voice persona, and application configurations.
            </p>
          </div>

          {/* User Profile Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} /> User Profile
              </div>
              <div className="settings-card-desc">Your authentication and contact details</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={user?.full_name ?? ''}
                  disabled
                  style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={user?.email ?? ''}
                  disabled
                  style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#DC2626' }}
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          </div>

          {/* AI Voice Persona (Epic 9) */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mic size={18} /> AI Voice Persona & Tone
              </div>
              <div className="settings-card-desc">
                Defines the communication style and signature used by the AI model when generating suggested replies.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="form-label">Communication Persona</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { id: 'executive', name: 'Executive & Strategic', desc: 'Direct, polite, concise, focused on action items.' },
                  { id: 'concise', name: 'Ultra Concise', desc: 'Minimal words, bullet points, zero fluff.' },
                  { id: 'friendly', name: 'Warm & Consultative', desc: 'Approachable, relationship-oriented, empathetic.' },
                  { id: 'formal', name: 'Strict Corporate Formal', desc: 'Traditional corporate register suitable for legal and finance.' },
                ].map((t) => (
                  <div
                    key={t.id}
                    className={`strategy-card ${tone === t.id ? 'active' : ''}`}
                    onClick={() => setTone(t.id as any)}
                    style={{ padding: 14 }}
                  >
                    <div className="strategy-name">{t.name}</div>
                    <div className="strategy-desc">{t.desc}</div>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Outgoing Reply Signature</label>
                <input
                  type="text"
                  className="form-input"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="e.g. Best regards, Alex"
                />
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} /> Notification Preferences
              </div>
              <div className="settings-card-desc">Control when you receive immediate alerts</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Immediate Negative Sentiment Alerts
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Trigger instant browser alerts whenever a client expresses frustration or complaints
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="trigger-checkbox"
                  checked={notifyNegative}
                  onChange={(e) => setNotifyNegative(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    VIP Contact Priority Alerts
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Never auto-send replies to VIP contacts and notify immediately on arrival
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="trigger-checkbox"
                  checked={notifyVip}
                  onChange={(e) => setNotifyVip(e.target.checked)}
                />
              </div>
            </div>
          </div>

          {/* Save Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20 }}>
            <Link to="/platforms" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Manage Platform Integrations →
            </Link>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saved ? <Check size={16} /> : null}
              {saved ? 'Settings Saved' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
