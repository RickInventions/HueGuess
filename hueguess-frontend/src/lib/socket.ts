import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function getSocketUrl(): string {
  if (import.meta.env.PROD) {
    return 'https://hueguess.onrender.com'
  }
  return '' 
}

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('hueguess_token')
    
    socket = io(getSocketUrl(), {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: '/socket.io',
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