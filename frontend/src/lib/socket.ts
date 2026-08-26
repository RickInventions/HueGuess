import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:3000';

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Single shared socket for the whole app.
 *
 * Reconnection is left to socket.io (exponential backoff, capped) and both
 * transports are allowed: websocket first, with polling as the fallback for
 * networks and proxies that block upgrades outright.
 */
export const getSocket = (token?: string): Socket => {
  if (socket && token && token !== currentToken) {
    // A new token (login, refresh) must not keep using the old handshake.
    socket.auth = { token };
    currentToken = token;
    if (socket.connected) socket.disconnect();
  }

  if (!socket) {
    currentToken = token ?? null;
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
      withCredentials: true,
    });
  }

  return socket;
};

export const connectSocket = (token?: string): Socket => {
  const s = getSocket(token);
  if (token) {
    s.auth = { token };
    currentToken = token;
  }
  if (!s.connected) s.connect();
  return s;
};

/** Drop the connection but keep the instance, so listeners survive a logout/login. */
export const closeSocket = () => {
  socket?.disconnect();
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  currentToken = null;
};

export const getSocketId = () => socket?.id ?? null;

export default getSocket;
