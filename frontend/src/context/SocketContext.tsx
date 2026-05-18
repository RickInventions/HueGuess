import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSocket } from '../lib/socket'
import { useAuth } from './AuthContext'
import type { Socket } from 'socket.io-client'

interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false })

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const s = getSocket()

    s.on('connect', () => setIsConnected(true))
    s.on('disconnect', () => setIsConnected(false))

    return () => {
      s.off('connect')
      s.off('disconnect')
    }
  }, [])

  // Reconnect with auth when user changes
  useEffect(() => {
    const s = getSocket()
    if (user) {
      s.auth = { token: localStorage.getItem('hueguess_token') }
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket: getSocket(), isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}