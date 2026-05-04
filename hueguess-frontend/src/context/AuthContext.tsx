import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../lib/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('hueguess_token'))
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('hueguess_token')
    setToken(null)
    setUser(null)
  }, [])

  // Register the 401 handler
  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // Check auth on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    api.getMe()
      .then((data) => {
        setUser(data.user)
      })
      .catch(() => {
        logout()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login({ email, password })
    localStorage.setItem('hueguess_token', data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await api.register({ username, email, password })
    localStorage.setItem('hueguess_token', data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}