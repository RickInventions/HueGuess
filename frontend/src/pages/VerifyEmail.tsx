import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Mail, RefreshCw } from 'lucide-react'
import { auth } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { toast } from 'sonner'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, resendVerification, checkAuth } = useAuth()
  
  const tokenFromUrl = searchParams.get('token')
  const emailFromUrl = searchParams.get('email') || user?.email || ''
  const codeFromUrl = searchParams.get('code') || ''
  const errorFromUrl = searchParams.get('error')

  const [email, setEmail] = useState(emailFromUrl)
  const [code, setCode] = useState(codeFromUrl)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(errorFromUrl || null)
  const [resendSuccess, setResendSuccess] = useState(false)
  
  const hasVerifiedRef = useRef(false)

  // Handle magic link verification (GET request from email click)
  useEffect(() => {
    const verifyWithToken = async () => {
      // Prevent double verification
      if (hasVerifiedRef.current) return
      if (!tokenFromUrl || !emailFromUrl) return
      
      hasVerifiedRef.current = true
      setLoading(true)
      setError(null)
      
      try {
        // The backend now returns JSON
        const response = await auth.verifyEmail(tokenFromUrl, emailFromUrl)
        
        if (response.data.success) {
          setVerified(true)
          toast.success('Email verified successfully!')
          
          // Refresh auth context to update isVerified status
          await checkAuth()
          
          // Redirect after 2 seconds
          setTimeout(() => navigate('/profile'), 2000)
        } else {
          throw new Error(response.data.message || 'Verification failed')
        }
      } catch (err: any) {
        console.error('Verification error:', err)
        // Handle different error formats
        let message = 'Verification failed. The link may have expired.'
        
        if (err.response?.data?.error) {
          message = err.response.data.error
        } else if (err.message) {
          message = err.message
        }
        
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    
    verifyWithToken()
  }, [tokenFromUrl, emailFromUrl, navigate, checkAuth])

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !code) {
      setError('Please enter both email and verification code')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await auth.verifyWithCode(email, code)
      
      if (response.data.success) {
        setVerified(true)
        toast.success('Email verified successfully!')
        
        // Refresh auth context
        await checkAuth()
        
        setTimeout(() => navigate('/profile'), 2000)
      } else {
        throw new Error(response.data.message || 'Verification failed')
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Verification failed'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address')
      return
    }
    
    setResendLoading(true)
    setError(null)
    setResendSuccess(false)
    
    try {
      const response = await auth.resendVerification(email)
      
      if (response.data.success) {
        setResendSuccess(true)
        toast.success('Verification email resent! Check your inbox.')
      } else {
        throw new Error(response.data.message || 'Failed to resend')
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to resend verification'
      setError(message)
      toast.error(message)
    } finally {
      setResendLoading(false)
    }
  }

  if (verified) {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-semibold mb-2">Email verified!</h2>
          <p className="text-muted mb-6">You can now play Competitive mode and access all features.</p>
          <Link to="/profile">
            <Button>Go to profile</Button>
          </Link>
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
        <h2 className="font-heading text-section text-center mb-2">Verify your email</h2>
        <p className="text-muted text-sm text-center mb-8">
          {tokenFromUrl 
            ? 'Verifying your email...' 
            : 'Enter the 6-digit code sent to your email.'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm text-center">
            {error}
          </div>
        )}

        {resendSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm text-center">
            Verification email sent! Check your inbox (and spam folder).
          </div>
        )}

        {loading && tokenFromUrl && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!tokenFromUrl && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
            />

            <input
              type="text"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep text-center text-2xl tracking-[0.5em] font-mono placeholder:text-muted/40 focus:outline-none focus:shadow-glow-primary transition-shadow"
            />

            <Button type="submit" fullWidth loading={loading}>
              Verify
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={handleResendVerification}
            disabled={resendLoading}
            className="text-sm text-muted hover:text-primary transition-colors inline-flex items-center gap-2"
          >
            {resendLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Mail className="w-3 h-3" />
            )}
            Didn't receive a code? Resend
          </button>
        </div>
      </motion.div>
    </div>
  )
}