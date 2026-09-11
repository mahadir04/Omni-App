import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { WsEvent } from '../../types';

interface ToastItem {
  id: string;
  conversationId: string;
  platform: string;
  senderName: string;
  content: string;
  timestamp: Date;
}

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
  slack: '#',
  linkedin: 'in',
  email: '@',
  sms: 'SMS',
};

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // browser audio autoplay catch
  }
}

export default function NotificationManager() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default' && !permissionRequested) {
      setPermissionRequested(true);
      Notification.requestPermission().catch(() => {});
    }
  }, [permissionRequested]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (event.event === 'new_message') {
        const data = event.data as {
          conversation_id?: string;
          platform?: string;
          sender_name?: string;
          content?: string;
          message?: { content?: string; sender?: string; id?: string };
        };

        const conversationId = data.conversation_id || '';
        const platform = (data.platform || 'messenger').toLowerCase();
        const senderName = data.sender_name || (data.message?.sender === 'contact' ? 'Contact' : 'New Inbound');
        const content = data.content || data.message?.content || 'New message received';

        // Play chime
        playChime();

        // Browser native notification if backgrounded
        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          try {
            new Notification(`💬 New ${platform.toUpperCase()} Message from ${senderName}`, {
              body: content.length > 80 ? content.slice(0, 80) + '…' : content,
              icon: '/favicon.ico',
            });
          } catch {
            // notification error catch
          }
        }

        // Add toast
        const toastId = Math.random().toString(36).substring(2, 9);
        const newToast: ToastItem = {
          id: toastId,
          conversationId,
          platform,
          senderName,
          content,
          timestamp: new Date(),
        };

        setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep up to 4 toasts max

        // Auto dismiss after 5.5s
        setTimeout(() => {
          removeToast(toastId);
        }, 5500);
      } else if (event.event === 'notification') {
        const data = event.data as { title?: string; body?: string; conversation_id?: string };
        playChime();

        const toastId = Math.random().toString(36).substring(2, 9);
        const newToast: ToastItem = {
          id: toastId,
          conversationId: data.conversation_id || '',
          platform: 'messenger',
          senderName: data.title || 'System Notification',
          content: data.body || 'New alert from Omni Assistant',
          timestamp: new Date(),
        };

        setToasts((prev) => [newToast, ...prev.slice(0, 3)]);
        setTimeout(() => removeToast(toastId), 5500);
      }
    },
    [removeToast]
  );

  useWebSocket(user?.id ?? null, handleWsEvent);

  const handleOpenConversation = (conversationId: string, toastId: string) => {
    removeToast(toastId);
    if (conversationId) {
      navigate(`/inbox?conv=${conversationId}`);
    } else {
      navigate('/inbox');
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
        maxWidth: 380,
        width: '100%',
      }}
    >
      {toasts.map((toast) => {
        const color = PLATFORM_COLORS[toast.platform] ?? '#0084FF';
        const letter = PLATFORM_LETTERS[toast.platform] ?? '💬';

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(18, 20, 29, 0.94)',
              backdropFilter: 'blur(16px)',
              border: `1px solid rgba(255, 255, 255, 0.12)`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              color: '#F3F4F6',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: color,
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {letter}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                  {toast.senderName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    color: color,
                    fontWeight: 700,
                    background: `${color}22`,
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {toast.platform}
                </span>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Message Snippet */}
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.82)',
                lineHeight: 1.4,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {toast.content}
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)' }}>
                Just now
              </span>
              <button
                onClick={() => handleOpenConversation(toast.conversationId, toast.id)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <MessageSquare size={12} />
                View in Inbox
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
