import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, LogIn } from 'lucide-react'
import { Button } from '../ui/Button'

interface JoinFormProps {
  onJoin: (code: string) => void
  loading?: boolean
}

export function JoinForm({ onJoin, loading }: JoinFormProps) {
  const [code, setCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = code.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8)
    if (cleaned.length === 8) {
      onJoin(cleaned)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <h3 className="font-heading text-xl font-semibold text-center">Join Room</h3>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Enter 8-digit room code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8))}
          maxLength={8}
          className="w-full pl-11 pr-4 py-3 rounded-button bg-surface-alt border border-border text-deep text-center text-lg tracking-[0.25em] font-mono placeholder:text-muted/30 focus:outline-none focus:shadow-glow-primary transition-shadow"
        />
      </div>

      <Button
        type="submit"
        fullWidth
        disabled={code.length !== 8}
        loading={loading}
        icon={<LogIn className="w-4 h-4" />}
      >
        Join Room
      </Button>
    </motion.form>
  )
}