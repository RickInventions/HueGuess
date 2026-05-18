import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { toast } from 'sonner'
import axios from 'axios'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const from = (location.state as any)?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err: unknown) {
      // Extract error message from axios error response
      let message = 'Login failed'
      
      if (axios.isAxiosError(err)) {
        // Server responded with error
        if (err.response?.data?.error) {
          message = err.response.data.error
        } else if (err.response?.data?.message) {
          message = err.response.data.message
        } else if (err.message) {
          message = err.message
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError(null)
    
    try {
      const { auth } = await import('../lib/api')
      const response = await auth.forgotPassword(resetEmail)
      
      if (response.data.success) {
        setResetSent(true)
        toast.success('Reset link sent! Check your email.')
      } else {
        throw new Error(response.data.message || 'Failed to send reset link')
      }
    } catch (err: unknown) {
      let message = 'Failed to send reset link'
      
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          message = err.response.data.error
        } else if (err.response?.data?.message) {
          message = err.response.data.message
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      
      setResetError(message)
      toast.error(message)
    } finally {
      setResetLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <h2 className="font-heading text-section text-center mb-8">
            {resetSent ? 'Check your email' : 'Reset password'}
          </h2>

          {resetSent ? (
            <>
              <p className="text-center text-muted text-sm mb-6">
                We've sent a password reset link to <strong>{resetEmail}</strong>.
                The link will expire in 1 hour.
              </p>
              <Button onClick={() => setShowForgotPassword(false)} fullWidth>
                Back to login
              </Button>
            </>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {resetError && (
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm text-center">
                  {resetError}
                </div>
              )}
              
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
                />
              </div>

              <Button type="submit" fullWidth loading={resetLoading}>
                Send reset link
              </Button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-sm text-muted hover:text-deep transition-colors"
              >
                Back to login
              </button>
            </form>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <h2 className="font-heading text-section text-center mb-8">Welcome back</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm text-center">
              {error}
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-11 pr-12 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-deep transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-primary hover:underline text-right block ml-auto"
          >
            Forgot password?
          </button>

          <Button type="submit" fullWidth loading={loading}>
            Log in
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}