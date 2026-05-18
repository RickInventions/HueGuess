import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { toast } from 'sonner'
import axios from 'axios'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({})

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}
    
    if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    } else if (username.length > 30) {
      newErrors.username = 'Username must be less than 30 characters'
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores'
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setLoading(true)
    setErrors({})
    
    try {
      await register(username, email, password)
      toast.success('Account created! Check your email to verify.')
      navigate('/verify')
    } catch (err: unknown) {
      let message = 'Registration failed'
      
      // Extract error message from axios error response
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          message = err.response.data.error
        } else if (err.response?.data?.message) {
          message = err.response.data.message
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      
      // Parse specific error messages
      if (message.toLowerCase().includes('username already taken')) {
        setErrors({ username: 'Username is already taken' })
      } else if (message.toLowerCase().includes('email already taken') || message.toLowerCase().includes('email already registered')) {
        setErrors({ email: 'Email is already registered' })
      } else {
        setErrors({ general: message })
      }
      
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <h2 className="font-heading text-section text-center mb-8">Create account</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm text-center">
              {errors.general}
            </div>
          )}

          <div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (errors.username) setErrors(prev => ({ ...prev, username: undefined }))
                }}
                required
                minLength={3}
                maxLength={30}
                className={`w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border ${
                  errors.username ? 'border-accent' : 'border-border'
                } text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow`}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-accent mt-1 ml-1">{errors.username}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                }}
                required
                className={`w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border ${
                  errors.email ? 'border-accent' : 'border-border'
                } text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow`}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-accent mt-1 ml-1">{errors.email}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
                }}
                required
                minLength={6}
                className={`w-full pl-11 pr-12 py-3 rounded-button bg-surface-alt border ${
                  errors.password ? 'border-accent' : 'border-border'
                } text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-deep transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-accent mt-1 ml-1">{errors.password}</p>
            )}
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Sign up
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}