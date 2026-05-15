import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { setupSocketHandlers } from './handlers.js';

export function initializeSocketIO(server: HttpServer) {
  const io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io', 
    transports: ['websocket', 'polling'], 
  });
  
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    setupSocketHandlers(io, socket);
  });
  
  return io;
}