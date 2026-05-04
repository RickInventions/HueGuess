import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { toast } from 'sonner'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const emailFromUrl = searchParams.get('email') || ''
  const codeFromUrl = searchParams.get('code') || ''

  const [email, setEmail] = useState(emailFromUrl)
  const [code, setCode] = useState(codeFromUrl)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.verifyEmail({ email, code })
      setVerified(true)
      toast.success('Email verified!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
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
          <p className="text-muted mb-6">You can now play Competitive mode.</p>
          <Link to="/">
            <Button>Go home</Button>
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
          Enter the 6-digit code sent to your email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
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
      </motion.div>
    </div>
  )
}