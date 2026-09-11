import { useEffect, useRef, useCallback } from 'react';
import type { WsEvent } from '../types';

export function useWebSocket(
  userId: string | null,
  onEvent: (event: WsEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!userId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/${userId}`);

    ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as WsEvent;
        onEventRef.current(parsed);
      } catch {
        console.warn('[WS] Failed to parse message', e.data);
      }
    };

    ws.onclose = () => {
      // Reconnect after 3s on unexpected close
      setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [userId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const ping = () => wsRef.current?.send('ping');
  return { ping };
}
