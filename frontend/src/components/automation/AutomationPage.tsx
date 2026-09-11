import { useState, useEffect } from 'react';
import {
  Zap, CheckCircle2, Shield, Bell, Landmark, Plus, AlertCircle,
} from 'lucide-react';
import {
  getAutomationRules,
  updateAutomationRules,
  approveAutomationPlan,
  discardAutomationChanges,
  listPlatforms,
  connectPlatform,
} from '../../api';
import type { AutomationRules, PlatformConnection, ResponseStrategy } from '../../types';
import Sidebar from '../layout/Sidebar';
import { AddPlatformModal, PlatformRulesModal } from '../platforms/PlatformModals';

const STRATEGIES: {
  value: ResponseStrategy;
  name: string;
  desc: string;
  rec?: string;
}[] = [
  {
    value: 'human_in_the_loop',
    name: 'Human-in-the-Loop',
    desc: 'AI drafts everything, but you must manually approve every single message before it\'s sent.',
    rec: 'Recommended for Executives',
  },
  {
    value: 'hybrid_autopilot',
    name: 'Hybrid Autopilot',
    desc: 'AI sends routine replies (scheduling, confirmation) automatically. Complex queries require approval.',
  },
  {
    value: 'full_autopilot',
    name: 'Full Autopilot',
    desc: 'AI handles 100% of interactions using your voice profile. Only high-risk flags notify you.',
  },
];

const PLATFORM_ICONS: Record<string, { color: string; letter: string }> = {
  whatsapp: { color: '#25D366', letter: 'W' },
  slack: { color: '#4A154B', letter: '#' },
  email: { color: '#F59E0B', letter: '@' },
  linkedin: { color: '#0A66C2', letter: 'in' },
};

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRules | null>(null);
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConnection | null>(null);

  const loadPlatforms = () => {
    listPlatforms().then(setPlatforms).catch(console.error);
  };

  useEffect(() => {
    Promise.all([getAutomationRules(), listPlatforms()])
      .then(([r, p]) => {
        setRules(r);
        setPlatforms(p);
        if (r.status === 'approved') setShowBanner(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleReconnect = async (p: PlatformConnection) => {
    try {
      await connectPlatform({
        platform: p.platform,
        external_account_id: p.external_account_id ?? undefined,
        access_token: 'mock-reconnected-token',
      });
      loadPlatforms();
    } catch (err) {
      console.error('Reconnect failed', err);
    }
  };

  const updateField = async <K extends keyof AutomationRules>(key: K, value: AutomationRules[K]) => {
    if (!rules) return;
    const updated = { ...rules, [key]: value, status: 'draft' as const };
    setRules(updated);
    setDirty(true);
    setShowBanner(false);
    try {
      await updateAutomationRules({ [key]: value });
    } catch (err) {
      console.error('Failed to update', err);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const approved = await approveAutomationPlan();
      setRules(approved);
      setDirty(false);
      setShowBanner(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    setSaving(true);
    try {
      const reverted = await discardAutomationChanges();
      setRules(reverted);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !rules) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading automation settings…</span>
        </div>
      </div>
    );
  }

  const pct = rules.confidence_threshold;

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="page-content">
        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="page-title">Automation Engine</h1>
              <span
                className="plan-approved-badge"
                style={rules.status === 'draft' ? { background: '#FEF3C7', color: '#92400E' } : {}}
              >
                {rules.status === 'draft' ? '⚠ Draft' : '● Plan Approved'}
              </span>
            </div>
            <p className="page-subtitle">Configure how Omni handles your communications across platforms.</p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={handleDiscard} disabled={saving || !dirty}>
              Discard Changes
            </button>
            <button className="btn btn-primary" onClick={handleApprove} disabled={saving}>
              {saving ? <span className="spinner" /> : (
                <><Zap size={14} /> Approve Automation Plan</>
              )}
            </button>
          </div>
        </div>

        {/* ── Success banner ────────────────────────────────────────── */}
        {showBanner && (
          <div className="success-banner">
            <div className="success-banner-icon"><CheckCircle2 size={18} /></div>
            <div>
              <div className="success-banner-title">Plan Successfully Approved</div>
              <div className="success-banner-body">
                Omni will now begin monitoring your connected platforms using the
                <strong> {STRATEGIES.find((s) => s.value === rules.response_strategy)?.name}</strong> strategy.
                {rules.response_strategy === 'human_in_the_loop' && (
                  <> Every draft will be queued in your Command Center for final review before sending.
                  No messages will leave your accounts without your explicit 'Approve & Send' action.</>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Master switch ─────────────────────────────────────────── */}
        <div className="card">
          <div className="master-switch-card">
            <div className="master-switch-icon"><Zap size={20} /></div>
            <div className="master-switch-text">
              <div className="master-switch-label">Master Automation Switch</div>
              <div className="master-switch-desc">
                When enabled, Omni will actively monitor all connected platforms and draft responses for your approval.
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={rules.master_switch_enabled}
                onChange={(e) => updateField('master_switch_enabled', e.target.checked)}
              />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </label>
          </div>
        </div>

        {/* ── Strategy + Reliability ────────────────────────────────── */}
        <div className="two-col">
          {/* Left: Response Strategy */}
          <div>
            <h2 className="section-label">Response Strategy</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {STRATEGIES.map((s) => (
                <div
                  key={s.value}
                  className={`strategy-card ${rules.response_strategy === s.value ? 'active' : ''}`}
                  onClick={() => updateField('response_strategy', s.value)}
                >
                  {rules.response_strategy === s.value && (
                    <span className="strategy-active-badge">Active</span>
                  )}
                  <div className="strategy-name">{s.name}</div>
                  <div className="strategy-desc">{s.desc}</div>
                  {s.rec && (
                    <div className="strategy-rec">
                      <AlertCircle size={12} /> {s.rec}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Reliability Filters */}
          <div>
            <h2 className="section-label">Reliability Filters</h2>

            {/* Confidence threshold */}
            <div className="confidence-section">
              <div className="confidence-header">AI Confidence Threshold</div>
              <input
                type="range"
                className="confidence-slider"
                min={0}
                max={100}
                step={1}
                value={pct}
                onChange={(e) => updateField('confidence_threshold', Number(e.target.value))}
                style={{ '--pct': `${pct}%` } as React.CSSProperties}
              />
              <div className="slider-labels">
                <span>Aggressive (0%)</span>
                <span className={pct >= 80 && pct <= 90 ? 'active-label' : ''}>
                  Strict ({pct}%)
                </span>
                <span>Precise (100%)</span>
              </div>
            </div>

            {/* Urgency triggers */}
            <div style={{ marginTop: 16 }}>
              <div className="confidence-header">Urgency Triggers</div>

              <div className="trigger-item">
                <input
                  type="checkbox"
                  className="trigger-checkbox"
                  checked={rules.notify_on_negative_sentiment}
                  onChange={(e) => updateField('notify_on_negative_sentiment', e.target.checked)}
                />
                <span className="trigger-label">
                  <Bell size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Notify me immediately if sentiment is "Negative"
                </span>
              </div>

              <div className="trigger-item">
                <input
                  type="checkbox"
                  className="trigger-checkbox"
                  checked={rules.bypass_automation_for_vip}
                  onChange={(e) => updateField('bypass_automation_for_vip', e.target.checked)}
                />
                <span className="trigger-label">
                  <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Bypass automation for "VIP" contacts
                </span>
              </div>

              <div className="trigger-item">
                <input
                  type="checkbox"
                  className="trigger-checkbox"
                  checked={rules.forward_financial_queries}
                  onChange={(e) => updateField('forward_financial_queries', e.target.checked)}
                />
                <span className="trigger-label">
                  <Landmark size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Forward financial queries to review queue
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Platform Integration ──────────────────────────────────── */}
        <h2 className="section-label" style={{ marginTop: 32 }}>Platform Integration</h2>
        <div className="platform-grid">
          {platforms.map((p) => {
            const icon = PLATFORM_ICONS[p.platform];
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
                    className={`platform-status ${p.status === 'connected' ? 'connected' : p.status === 'reauth_required' ? 'reauth' : 'offline'}`}
                  >
                    {p.status === 'connected' ? 'Connected' : p.status === 'reauth_required' ? 'Re-auth required' : 'Offline'}
                  </span>
                </div>
                <div className="platform-name">
                  {p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}
                </div>
                <div className="platform-meta">
                  {p.status === 'connected' && `${p.external_account_id ?? ''}`}
                  {p.status === 'reauth_required' && 'Re-auth required'}
                  {p.status === 'offline' && 'Not connected'}
                </div>
                {p.status === 'reauth_required' ? (
                  <button
                    className="platform-card-btn reconnect-btn"
                    onClick={() => handleReconnect(p)}
                  >
                    Reconnect
                  </button>
                ) : (
                  <button
                    className="platform-card-btn"
                    onClick={() => setSelectedPlatform(p)}
                  >
                    Platform Rules
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Platform */}
          <div className="platform-add-card" onClick={() => setAddModalOpen(true)}>
            <Plus size={24} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Add Platform</span>
          </div>
        </div>
      </div>

      {/* Platform Modals */}
      <AddPlatformModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={loadPlatforms}
      />

      <PlatformRulesModal
        platform={selectedPlatform}
        onClose={() => setSelectedPlatform(null)}
        onUpdated={loadPlatforms}
      />
    </div>
  );
}
