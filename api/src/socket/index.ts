import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { setupSocketHandlers } from './handlers.js';
import { registerPresence, setPresenceServer } from './presence.js';
import { SocketUser } from './types.js';
import { JwtPayload } from '../types/index.js';

/** Every origin allowed to open a socket — mirrors the REST CORS list. */
function allowedOrigins(): string[] {
  const configured = [process.env.FRONTEND_URL, process.env.FRONTEND_URL_ALT]
    .filter((value): value is string => !!value)
    .flatMap(value => value.split(',').map(v => v.trim()))
    .filter(Boolean);

  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  return Array.from(new Set([...configured, ...defaults]));
}

function readToken(socket: Socket): string | null {
  const { auth, headers, query } = socket.handshake;

  const candidates = [
    (auth as { token?: unknown })?.token,
    headers.authorization?.startsWith('Bearer ') ? headers.authorization.slice(7) : undefined,
    query.token,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function initializeSocketIO(server: HttpServer) {
  const io = new SocketServer(server, {
    cors: {
      origin: allowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
    // Polling stays enabled as a fallback: some proxies and mobile networks block
    // websocket upgrades outright, and a game that never connects is worse than
    // one that connects slowly.
    transports: ['websocket', 'polling'],
    // Short-lived recovery of missed packets when a client drops for a moment.
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000,
      skipMiddlewares: false,
    },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e5, // 100 KB — no socket payload here is remotely that big
  });

  // ── Handshake auth ────────────────────────────────────────────────────────
  // Identity is established once, here, and read from socket.data everywhere
  // else. Handlers never trust a client-supplied userId.
  io.use((socket, next) => {
    const token = readToken(socket);
    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('❌ JWT_SECRET is not configured — refusing socket connections');
      return next(new Error('SERVER_MISCONFIGURED'));
    }

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      if (!payload?.userId) return next(new Error('AUTH_INVALID'));

      const user: SocketUser = {
        userId: String(payload.userId),
        username: payload.username ?? 'Player',
        isVerified: !!payload.isVerified,
      };
      socket.data.user = user;
      return next();
    } catch (error) {
      const expired = (error as Error).name === 'TokenExpiredError';
      return next(new Error(expired ? 'AUTH_EXPIRED' : 'AUTH_INVALID'));
    }
  });

  // Lets the REST layer reach connected users (friend requests, room invites).
  setPresenceServer(io);

  io.on('connection', socket => {
    const user = socket.data.user as SocketUser;
    registerPresence(socket);
    console.log(
      `🔌 ${user.username} connected (${socket.id}${socket.recovered ? ', recovered' : ''}) via ${socket.conn.transport.name}`
    );

    socket.emit('connection_ready', {
      socketId: socket.id,
      userId: user.userId,
      username: user.username,
      isVerified: user.isVerified,
      recovered: socket.recovered,
      serverTime: Date.now(),
    });

    setupSocketHandlers(io, socket);
  });

  io.engine.on('connection_error', err => {
    console.warn(`⚠️  Socket handshake rejected: ${err.message}`);
  });

  return io;
}
