import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, LogIn, ClipboardPaste } from 'lucide-react'
import { Button } from '../ui/Button'

interface JoinFormProps {
  onJoin: (code: string) => void
  loading?: boolean
  disabled?: boolean
  /** Prefill, e.g. from a shared /room/:code link. */
  initialCode?: string
}

const CODE_LENGTH = 8
/** Matches the server's unambiguous alphabet — no 0/O/1/I to mistype. */
const clean = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, '')
    .slice(0, CODE_LENGTH)

export function JoinForm({ onJoin, loading, disabled, initialCode = '' }: JoinFormProps) {
  const [code, setCode] = useState(() => clean(initialCode))
  const [touched, setTouched] = useState(false)

  const isValid = code.length === CODE_LENGTH

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (isValid) onJoin(code)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setCode(clean(text))
    } catch {
      /* clipboard permission denied — typing still works */
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

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
            aria-invalid={touched && !isValid}
            placeholder="8-CHAR CODE"
            value={code}
            onChange={(e) => setCode(clean(e.target.value))}
            onBlur={() => setTouched(true)}
            maxLength={CODE_LENGTH}
            className="w-full pl-11 pr-12 py-3 rounded-button bg-surface-alt border border-border text-deep text-center text-base sm:text-lg tracking-[0.2em] sm:tracking-[0.25em] font-mono placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
          />
          <button
            type="button"
            onClick={handlePaste}
            aria-label="Paste room code"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-button text-muted hover:text-deep hover:bg-surface transition-colors"
          >
            <ClipboardPaste className="w-4 h-4" />
          </button>
        </div>

        <p className={`text-xs text-center ${touched && !isValid ? 'text-accent' : 'text-muted'}`}>
          {touched && !isValid
            ? `Room codes are ${CODE_LENGTH} characters`
            : `${code.length}/${CODE_LENGTH}`}
        </p>
      </div>

      <Button
        type="submit"
        fullWidth
        disabled={!isValid || disabled}
        loading={loading}
        icon={<LogIn className="w-4 h-4" />}
      >
        Join Room
      </Button>
    </motion.form>
  )
}
