import { Server as SocketServer, Socket } from 'socket.io';
import { SocketUser } from './types.js';

/**
 * Who is connected right now, and how to reach them.
 *
 * Every socket joins a personal room (`user:<id>`) so anything outside the socket
 * layer — the REST routes, mostly — can push to a user without holding a socket
 * reference. Presence is also mirrored into a plain map because callers want it
 * synchronously, and `io.in(room).fetchSockets()` is async.
 *
 * Single-process, in-memory, exactly like the room registry. Behind more than one
 * node this would need the Redis adapter and a shared presence store.
 */

/** userId → the socket ids that user currently has open (tabs, phone + laptop). */
const online = new Map<string, Set<string>>();

let io: SocketServer | null = null;

export function setPresenceServer(server: SocketServer): void {
  io = server;
}

/**
 * The live Socket.IO server, or null before the socket layer has booted.
 *
 * `notifyUser` covers pushing to one account, but a REST route that needs to
 * broadcast into a game room (the voice-note upload) has no other way to reach
 * it. Nullable on purpose: the routes are mounted before the socket server is
 * attached, so a caller during that window must handle its absence.
 */
export function getSocketServer(): SocketServer | null {
  return io;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Call once per connection. Cleans itself up on disconnect. */
export function registerPresence(socket: Socket): void {
  const user = socket.data.user as SocketUser | undefined;
  if (!user) return;

  socket.join(userRoom(user.userId));

  const sockets = online.get(user.userId) ?? new Set<string>();
  sockets.add(socket.id);
  online.set(user.userId, sockets);

  socket.on('disconnect', () => {
    const current = online.get(user.userId);
    if (!current) return;
    current.delete(socket.id);
    // Drop the key entirely once the last tab closes, so the map does not grow
    // one empty Set per account that has ever connected.
    if (current.size === 0) online.delete(user.userId);
  });
}

export function isUserOnline(userId: string): boolean {
  return (online.get(userId)?.size ?? 0) > 0;
}

/** Snapshot of everyone connected — a copy, so callers cannot mutate the registry. */
export function getOnlineUserIds(): Set<string> {
  return new Set(online.keys());
}

/**
 * Push an event to every socket a user has open.
 * Returns false when they are offline, so the caller can say so.
 */
export function notifyUser(userId: string, event: string, payload: unknown): boolean {
  if (!io) return false;
  if (!isUserOnline(userId)) return false;
  io.to(userRoom(userId)).emit(event, payload);
  return true;
}
