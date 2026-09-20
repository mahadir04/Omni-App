import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone,
  Bot,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Layers,
  Sparkles,
  Send,
  Radio,
  Cpu,
  Activity,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import LandingCanvas3D from './LandingCanvas3D';
import TiltCard3D from './TiltCard3D';

export default function LandingPage() {
  const { token } = useAuthStore();
  const navigate = useNavigate();

  // Simulation state
  const [simPlatform, setSimPlatform] = useState<'whatsapp' | 'messenger' | 'instagram'>('whatsapp');
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(4);

  const simulationData = {
    whatsapp: {
      name: 'Sarah Jenkins',
      sender: '+1 (555) 382-9912',
      badge: 'WhatsApp Native',
      color: '#25D366',
      incoming: 'Roadmap looks phenomenal! Can we ship the beta build today?',
      draft: 'Thanks Sarah! Staging deployment is running now. Sending your invite link in 2 minutes.',
      metric: '< 88ms latency',
    },
    messenger: {
      name: 'Marcus Chen',
      sender: 'Marcus Chen (Product Lead)',
      badge: 'Messenger Bridge',
      color: '#0084FF',
      incoming: 'Hey Mahadir, just verified the Android WebSocket relay on our test device. Flawless.',
      draft: 'Awesome Marcus! The direct reply intent handles background payloads cleanly.',
      metric: '< 98ms latency',
    },
    instagram: {
      name: 'Elena Rostova',
      sender: '@elena.designs',
      badge: 'Instagram DM',
      color: '#E1306C',
      incoming: 'Sent over the new 3D motion assets for the landing hero. Let me know what you think!',
      draft: 'Assets received and integrated! The 3D perspective depth looks stunning.',
      metric: '< 82ms latency',
    },
  };

  const runSimulation = (platform: 'whatsapp' | 'messenger' | 'instagram') => {
    if (isSimulating) return;
    setSimPlatform(platform);
    setIsSimulating(true);
    setActiveStep(1);

    setTimeout(() => setActiveStep(2), 500);
    setTimeout(() => setActiveStep(3), 1100);
    setTimeout(() => {
      setActiveStep(4);
      setIsSimulating(false);
    }, 1800);
  };

  const currentSim = simulationData[simPlatform];

  return (
    <div className="landing-page-root">
      {/* 3D Background Particle Canvas */}
      <LandingCanvas3D />

      {/* Ambient background glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[550px] w-[800px] rounded-full bg-rose-900/15 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[450px] w-[450px] rounded-full bg-indigo-950/20 blur-[150px]" />
        <div className="absolute bottom-20 -left-32 h-[450px] w-[450px] rounded-full bg-red-950/20 blur-[160px]" />
      </div>

      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#07090E]/85 border-b border-white/[0.08]">
        <div className="landing-container">
          <div className="landing-nav-bar">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-3 group text-decoration-none">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 via-red-700 to-red-900 shadow-lg shadow-rose-950/60 group-hover:scale-105 transition-transform">
                <span className="font-extrabold text-white text-xl tracking-wider font-mono">Ω</span>
                <div className="absolute -inset-0.5 rounded-xl bg-rose-500/30 blur-sm group-hover:bg-rose-500/50 transition-colors -z-10" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">Omni</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  v2.4
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
              <a href="#features" className="hover:text-white transition-colors text-decoration-none">Features</a>
              <a href="#simulation" className="hover:text-white transition-colors text-decoration-none">Live Simulation</a>
              <a href="#architecture" className="hover:text-white transition-colors text-decoration-none">Phone Bridge</a>
              <a href="#security" className="hover:text-white transition-colors text-decoration-none">Security</a>
            </nav>

            {/* Auth CTAs */}
            <div className="flex items-center gap-3">
              {token ? (
                <button
                  onClick={() => navigate('/inbox')}
                  className="landing-primary-btn text-xs py-2 px-4 shadow-none"
                >
                  Launch Inbox <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors text-decoration-none"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="landing-primary-btn text-xs py-2 px-4"
                  >
                    Get Started <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative z-10">
        <div className="landing-container">
          <div className="landing-hero-wrap">
            {/* Status Badge */}
            <div className="landing-pill-badge">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span>Native Android Companion Bridge • Zero Meta API Dependency</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Headline */}
            <h1 className="landing-hero-h1">
              One Unified Inbox.{' '}
              <span className="landing-gradient-text">
                Every Conversation.
              </span>
              <br />
              Zero Meta Limits.
            </h1>

            {/* Subtitle */}
            <p className="landing-hero-desc">
              Consolidate WhatsApp, Messenger, Instagram, Slack, and Email into a single autonomous inbox.
              Incoming chats route natively via your Android bridge with instant Gemini AI triage.
            </p>

            {/* Action CTAs */}
            <div className="landing-btn-group">
              <button
                onClick={() => navigate(token ? '/inbox' : '/signup')}
                className="landing-primary-btn"
              >
                <Zap className="w-4 h-4 fill-white" />
                {token ? 'Go to Inbox' : 'Start Free with Omni'}
              </button>
              <a
                href="#simulation"
                className="landing-secondary-btn"
              >
                <Radio className="w-4 h-4 text-rose-400" />
                Interactive Simulation
              </a>
            </div>

            {/* ── 3D Interactive Mockup Showcase (Perspective Tilt) ───────── */}
            <div className="mockup-3d-container">
              <TiltCard3D maxTilt={6} scale={1.01} glare={true} className="rounded-2xl">
                <div className="mockup-frame">
                  {/* Top Bar */}
                  <div className="mockup-top-bar">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      <span className="ml-3 font-mono text-[11px] text-slate-400">
                        omni.workspace.internal • connected
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Galaxy S24 Bridge: &lt;88ms
                      </span>
                    </div>
                  </div>

                  {/* Body Layout */}
                  <div className="mockup-layout">
                    {/* Left Dock */}
                    <div className="mockup-dock">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-rose-950/50">
                        Ω
                      </div>
                      <div className="w-6 h-[1px] bg-white/[0.08] my-1" />
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs">
                        <Send className="w-4 h-4" />
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 text-xs">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Middle Threads List */}
                    <div className="mockup-threads">
                      <div className="flex items-center justify-between pb-2 px-1 border-b border-white/[0.06]">
                        <span className="text-xs font-semibold text-slate-200">Unified Feed</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                          3 New
                        </span>
                      </div>

                      {/* Active Row */}
                      <div className="p-3 rounded-xl bg-white/[0.07] border border-rose-500/40 transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            {currentSim.name}
                          </span>
                          <span className="text-[10px] text-slate-400">Now</span>
                        </div>
                        <p className="text-[11px] text-slate-300 truncate">
                          {currentSim.incoming}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium text-white"
                            style={{ backgroundColor: `${currentSim.color}33`, borderColor: `${currentSim.color}66` }}
                          >
                            {currentSim.badge}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-medium">
                            Urgent
                          </span>
                        </div>
                      </div>

                      {/* Thread 2 */}
                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] opacity-75">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-300">Marcus Chen</span>
                          <span className="text-[10px] text-slate-500">4m</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          Verified Android WebSocket relay...
                        </p>
                      </div>

                      {/* Thread 3 */}
                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] opacity-60">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-300">Elena Rostova</span>
                          <span className="text-[10px] text-slate-500">12m</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          Sent new vector brand glyphs...
                        </p>
                      </div>
                    </div>

                    {/* Right Active Conversation Pane */}
                    <div className="mockup-chat-pane">
                      <div>
                        {/* Thread Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                              {currentSim.name}
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: `${currentSim.color}22`, color: currentSim.color }}
                              >
                                {currentSim.badge}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Routed via Galaxy S24 Android Bridge ({currentSim.metric})
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/40 flex items-center gap-1 font-medium">
                            <Sparkles className="w-3 h-3 text-rose-400" />
                            Sentiment: 97%
                          </span>
                        </div>

                        {/* Messages List */}
                        <div className="py-4 space-y-3">
                          {/* Incoming */}
                          <div className="max-w-md bg-white/[0.06] border border-white/[0.08] p-3 rounded-2xl rounded-tl-sm text-xs text-slate-200">
                            {currentSim.incoming}
                            <div className="text-[9px] text-slate-400 mt-1">10:42 AM • Direct from phone notification</div>
                          </div>

                          {/* AI Copilot Card */}
                          <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/50 via-slate-900/60 to-slate-900/40 border border-rose-500/30 text-xs">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400 mb-1">
                              <Bot className="w-3.5 h-3.5" />
                              Gemini Autonomous AI Draft
                            </div>
                            <p className="text-slate-200 text-xs leading-relaxed">
                              "{currentSim.draft}"
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reply Input Bar */}
                      <div className="pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                          <input
                            type="text"
                            readOnly
                            value={currentSim.draft}
                            className="w-full bg-transparent text-xs text-slate-200 outline-none truncate"
                          />
                          <button className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold flex items-center gap-1 shadow-md hover:bg-rose-500 transition-colors whitespace-nowrap">
                            <Send className="w-3 h-3" /> Send
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3D Layered Depth Floating Badge */}
                <div
                  className="hidden md:flex items-center gap-3 absolute -bottom-5 right-6 bg-[#0E1321]/95 border border-rose-500/40 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-2xl z-20"
                  style={{ transform: 'translateZ(40px)' }}
                >
                  <Smartphone className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <div className="text-left">
                    <div className="text-[11px] font-semibold text-white">Phone Bridge Active</div>
                    <div className="text-[9px] text-slate-400">Direct RemoteInput dispatch ready</div>
                  </div>
                </div>
              </TiltCard3D>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Flow Simulation Section ──────────────────────────────────── */}
      <section id="simulation" className="relative z-10 py-20 px-6 border-t border-white/[0.08] bg-[#0A0D15]/90">
        <div className="landing-container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">
              Live Architecture Walkthrough
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-3 tracking-tight">
              How Incoming Messages Flow
            </h2>
            <p className="text-sm text-slate-400">
              Click any platform to trigger an instant simulation through the 4 core stages of Omni.
            </p>

            {/* Platform Selector Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <button
                onClick={() => runSimulation('whatsapp')}
                disabled={isSimulating}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  simPlatform === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/40'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Simulate WhatsApp
              </button>
              <button
                onClick={() => runSimulation('messenger')}
                disabled={isSimulating}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  simPlatform === 'messenger'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/60 ring-2 ring-blue-400/40'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Simulate Messenger
              </button>
              <button
                onClick={() => runSimulation('instagram')}
                disabled={isSimulating}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  simPlatform === 'instagram'
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-950/60 ring-2 ring-pink-400/40'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/[0.08]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                Simulate Instagram
              </button>
            </div>
          </div>

          {/* 4 Interactive Flow Cards */}
          <div className="sim-grid">
            {/* Stage 1 */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 ${
                activeStep >= 1
                  ? 'bg-[#0F1422] border-rose-500/50 shadow-xl shadow-rose-950/30'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-slate-400 font-bold">STAGE 01</span>
                <Smartphone className={`w-4 h-4 ${activeStep >= 1 ? 'text-rose-400' : 'text-slate-600'}`} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Android Notification</h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Notification listener captures sender, body, and native direct reply intent.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-[11px] font-mono text-slate-200 truncate">
                "{currentSim.incoming}"
              </div>
            </div>

            {/* Stage 2 */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 ${
                activeStep >= 2
                  ? 'bg-[#0F1422] border-indigo-500/50 shadow-xl shadow-indigo-950/30'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-slate-400 font-bold">STAGE 02</span>
                <Radio className={`w-4 h-4 ${activeStep >= 2 ? 'text-indigo-400' : 'text-slate-600'}`} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Encrypted Relay</h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Streamed over secure WebSocket directly to your Omni backend instance.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-[11px] font-mono text-emerald-400 font-medium">
                ● WSS Connected ({currentSim.metric})
              </div>
            </div>

            {/* Stage 3 */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 ${
                activeStep >= 3
                  ? 'bg-[#0F1422] border-amber-500/50 shadow-xl shadow-amber-950/30'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-slate-400 font-bold">STAGE 03</span>
                <Cpu className={`w-4 h-4 ${activeStep >= 3 ? 'text-amber-400' : 'text-slate-600'}`} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Gemini AI Triage</h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Analyzes sentiment, extracts action items, and generates personalized draft.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-[11px] font-mono text-amber-300">
                Action: Review Staging
              </div>
            </div>

            {/* Stage 4 */}
            <div
              className={`p-5 rounded-2xl border transition-all duration-300 ${
                activeStep >= 4
                  ? 'bg-[#0F1422] border-emerald-500/50 shadow-xl shadow-emerald-950/30'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-slate-400 font-bold">STAGE 04</span>
                <CheckCircle2 className={`w-4 h-4 ${activeStep >= 4 ? 'text-emerald-400' : 'text-slate-600'}`} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Native Dispatch</h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Reply executes via RemoteInput on your phone. Delivered natively to recipient.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.08] text-[11px] font-mono text-emerald-400 font-semibold">
                ✓ Delivered via {simPlatform.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bento Grid Features ───────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="landing-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mt-2 mb-4 tracking-tight">
              Engineered for Speed, Autonomy & Control
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Handle hundreds of client conversations across platforms with zero tab switching.
            </p>
          </div>

          <div className="bento-grid">
            {/* Bento 1: Android Phone Bridge */}
            <TiltCard3D maxTilt={6} scale={1.01} className="bento-card-wide">
              <div className="h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/[0.08] hover:border-rose-500/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 text-rose-400 shadow-inner">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Proprietary Architecture
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-1 mb-3">
                    Android Native Notification Bridge
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                    Completely bypass Meta Cloud API verification, developer accounts, per-conversation billing, and template approvals.
                    The companion app captures incoming push notifications and dispatches replies using native RemoteInput intents directly on your phone hardware.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    ✓ No Meta Developer Account
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    ✓ Zero WhatsApp Cloud API Costs
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    ✓ 30-Second QR Deep-Link Pairing
                  </span>
                </div>
              </div>
            </TiltCard3D>

            {/* Bento 2: AI Copilot */}
            <TiltCard3D maxTilt={6} scale={1.01} className="bento-card-single">
              <div className="h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/[0.08] hover:border-indigo-500/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400 shadow-inner">
                    <Bot className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Autonomous Intelligence
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1 mb-3">
                    Gemini AI Copilot
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Automated urgency scoring, emotion gauges, action item extraction, and personalized voice tone replication.
                  </p>
                </div>
                <div className="mt-6 text-xs text-indigo-300 font-semibold flex items-center gap-1">
                  Learns writing style over time <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </TiltCard3D>

            {/* Bento 3: Unified Channels */}
            <TiltCard3D maxTilt={6} scale={1.01} className="bento-card-single">
              <div className="h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/[0.08] hover:border-amber-500/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 text-amber-400 shadow-inner">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Unified Channels
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1 mb-3">
                    Multi-Platform Aggregator
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Aggregate WhatsApp, Messenger, Instagram, Slack, LinkedIn, and Gmail under one unified interface with global search.
                  </p>
                </div>
                <div className="mt-6 text-xs text-amber-300 font-semibold flex items-center gap-1">
                  Keyboard-first navigation <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </TiltCard3D>

            {/* Bento 4: Security & Privacy */}
            <TiltCard3D maxTilt={6} scale={1.01} className="bento-card-wide">
              <div className="h-full p-8 rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/[0.08] hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400 shadow-inner">
                    <Shield className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Security & Sovereignty
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-1 mb-3">
                    Your Data Stays on Your Hardware
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                    All device communications are secured via mutual device-bound cryptographic tokens.
                    Deploy Omni with Docker or Render, connect your PostgreSQL instance with pgvector, and maintain total ownership of your communications.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    ✓ Self-Hostable
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    ✓ PostgreSQL + pgvector
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    ✓ End-to-End WebSocket Sessions
                  </span>
                </div>
              </div>
            </TiltCard3D>
          </div>
        </div>
      </section>

      {/* ── Key Metrics Bar ──────────────────────────────────────────────── */}
      <section className="relative z-10 py-16 border-y border-white/[0.08] bg-[#0A0D15]">
        <div className="landing-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-extrabold text-white mb-1">0</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Meta API Keys Needed</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-emerald-400 mb-1">&lt;95ms</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bridge Latency</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-rose-400 mb-1">100%</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Local Hardware Control</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-indigo-400 mb-1">6+</div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unified Platforms</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom Call To Action ────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-6 text-center">
        <div className="landing-container">
          <div className="p-12 sm:p-16 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.1] shadow-2xl relative overflow-hidden backdrop-blur-2xl max-w-4xl mx-auto">
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-rose-600/20 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none" />

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
              Reclaim Your Time & Communications.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
              Unify all your chats today. Pair your Android phone in 30 seconds and let Omni automate triage, drafting, and platform routing.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => navigate(token ? '/inbox' : '/signup')}
                className="landing-primary-btn"
              >
                {token ? 'Launch Inbox' : 'Get Started Free'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/login"
                className="landing-secondary-btn"
              >
                Sign In to Existing Workspace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.08] py-10 px-6 text-xs text-slate-500">
        <div className="landing-container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300">Omni Unified Platform</span>
              <span>•</span>
              <span>Autonomous Messaging Workspace</span>
            </div>

            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </span>
              <Link to="/login" className="hover:text-slate-300 transition-colors text-decoration-none">Login</Link>
              <Link to="/signup" className="hover:text-slate-300 transition-colors text-decoration-none">Sign Up</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
