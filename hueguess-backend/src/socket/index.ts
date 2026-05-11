import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { registerHandlers } from './handlers.js'
import { roomManager } from './roomManager.js'

let io: Server | null = null

export function initSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 10000,
    pingInterval: 5000,
  })

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`)
    
    registerHandlers(io!, socket)

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`)
      roomManager.handleDisconnect(socket.id)
    })
  })

  console.log('🔌 Socket.IO server initialized')
  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}