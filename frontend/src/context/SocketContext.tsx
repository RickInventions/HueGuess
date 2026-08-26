import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, connectSocket, closeSocket, disconnectSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

interface ConnectionError {
  message: string;
  /** True when the handshake was rejected for auth reasons — retrying won't help. */
  needsAuth: boolean;
}

interface SocketContextType {
  socket: Socket | null;
  /** Live, usable connection. */
  isConnected: boolean;
  /** Lost the connection and socket.io is retrying. */
  isReconnecting: boolean;
  /** Attempt counter for the current reconnection streak. */
  reconnectAttempt: number;
  /** Browser-level connectivity (navigator.onLine). */
  isOnline: boolean;
  connectionError: ConnectionError | null;
  /** Server clock estimate — timers derive from this, not the local clock. */
  getServerTime: () => number;
  connect: () => void;
  disconnect: () => void;
  /** Manual retry for the "Reconnect" button. */
  retry: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const AUTH_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Please sign in again to play online.',
  AUTH_INVALID: 'Your session is no longer valid. Please sign in again.',
  AUTH_EXPIRED: 'Your session expired. Please sign in again.',
  SERVER_MISCONFIGURED: 'The server is unavailable right now. Try again later.',
};

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState<ConnectionError | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  const offsetRef = useRef(0);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const getServerTime = useCallback(() => Date.now() + offsetRef.current, []);

  /**
   * Round-trip clock probe. `connection_ready.serverTime` alone is off by the
   * one-way network delay; this corrects for it and keeps the best (lowest-RTT)
   * sample, which is the least jitter-polluted one.
   */
  const probeClock = useCallback((s: Socket) => {
    if (!s.connected) return;
    const sent = Date.now();
    s.timeout(4000).emit(
      'time_sync',
      sent,
      (err: Error | null, payload?: { serverTime?: number }) => {
        if (err || typeof payload?.serverTime !== 'number') return;
        const received = Date.now();
        const rtt = received - sent;
        // Discard a wildly slower sample — it says more about a stalled packet
        // than about the clock.
        if (Number.isFinite(bestRttRef.current) && rtt > bestRttRef.current * 2) return;
        bestRttRef.current = Math.min(bestRttRef.current, rtt);
        // Assuming symmetric latency, the server's reading lands at received - rtt/2.
        offsetRef.current = payload.serverTime + rtt / 2 - received;
      }
    );
  }, []);

  // ── Browser connectivity ──────────────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // The OS says we're back; nudge socket.io instead of waiting out its backoff.
      const s = getSocket();
      if (!s.connected) s.connect();
    };
    const goOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Connection lifecycle ──────────────────────────────────────────────────
  // Listeners are attached before connect() so the very first `connect` event
  // is never missed — that race is what used to leave isConnected stuck false.
  useEffect(() => {
    if (!isAuthenticated || !token) {
      closeSocket();
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
      setConnectionError(null);
      return;
    }

    const s = getSocket(token);
    const probeTimers: number[] = [];

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempt(0);
      setConnectionError(null);
      // A reconnect may be over a different network — re-measure from scratch.
      bestRttRef.current = Number.POSITIVE_INFINITY;
      probeClock(s);
      probeTimers.push(window.setTimeout(() => probeClock(s), 400));
      probeTimers.push(window.setTimeout(() => probeClock(s), 1200));
    };

    const onDisconnect = (reason: Socket.DisconnectReason) => {
      setIsConnected(false);
      // 'io client disconnect' means we asked for it — not a fault to report.
      if (reason !== 'io client disconnect') {
        setIsReconnecting(true);
      }
    };

    const onConnectError = (err: Error) => {
      setIsConnected(false);
      const authMessage = AUTH_ERRORS[err.message];
      if (authMessage) {
        // Stop the retry loop: no amount of retrying fixes a bad token.
        setIsReconnecting(false);
        setConnectionError({ message: authMessage, needsAuth: true });
        s.disconnect();
        return;
      }
      setIsReconnecting(true);
      setConnectionError({
        message: navigator.onLine
          ? 'Cannot reach the game server. Retrying…'
          : 'You are offline. Waiting for your connection…',
        needsAuth: false,
      });
    };

    const onReconnectAttempt = (attempt: number) => {
      setIsReconnecting(true);
      setReconnectAttempt(attempt);
    };

    const onReconnectFailed = () => {
      setIsReconnecting(false);
      setConnectionError({ message: 'Could not reconnect to the game server.', needsAuth: false });
    };

    const onConnectionReady = (data: { serverTime?: number }) => {
      if (typeof data?.serverTime === 'number') {
        // First rough estimate; the round-trip probes refine it.
        offsetRef.current = data.serverTime - Date.now();
      }
    };

    // Re-sync periodically: a laptop waking from sleep can have a local clock
    // that jumped, and a long game would otherwise run on a stale offset.
    const resync = window.setInterval(() => {
      if (document.visibilityState === 'visible') probeClock(s);
    }, 60_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') probeClock(s);
    };
    document.addEventListener('visibilitychange', onVisible);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect_failed', onReconnectFailed);
    s.on('connection_ready', onConnectionReady);

    setSocket(s);
    if (!s.connected) s.connect();
    else onConnect();

    return () => {
      probeTimers.forEach(clearTimeout);
      clearInterval(resync);
      document.removeEventListener('visibilitychange', onVisible);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect_failed', onReconnectFailed);
      s.off('connection_ready', onConnectionReady);
    };
  }, [isAuthenticated, token, probeClock]);

  // Tear the instance down only when the app unmounts.
  useEffect(() => () => disconnectSocket(), []);

  const connect = useCallback(() => {
    if (!token) return;
    connectSocket(token);
  }, [token]);

  const disconnect = useCallback(() => {
    closeSocket();
    setIsConnected(false);
    setIsReconnecting(false);
  }, []);

  const retry = useCallback(() => {
    if (!token) return;
    setConnectionError(null);
    setIsReconnecting(true);
    const s = getSocket(token);
    s.auth = { token };
    if (s.connected) s.disconnect();
    s.connect();
  }, [token]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isReconnecting,
        reconnectAttempt,
        isOnline,
        connectionError,
        getServerTime,
        connect,
        disconnect,
        retry,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
