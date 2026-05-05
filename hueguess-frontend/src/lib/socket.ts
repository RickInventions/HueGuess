import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('hueguess_token')
    
    // Connect directly to the backend server, not through Vite proxy
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    
    socket = io(backendUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}