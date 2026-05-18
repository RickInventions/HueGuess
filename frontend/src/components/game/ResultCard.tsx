import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { Check, X } from 'lucide-react'
import type { SubmitResponse, Difficulty } from '../../types'

interface ResultCardProps {
  result: SubmitResponse
  difficulty?: Difficulty
}

function hslString(c: { h: number; s: number; l: number }): string {
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`
}

function CountUpNumber({ value, duration = 0.8 }: { value: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(0)
  const startTime = useRef(Date.now())
  const frameRef = useRef<number>(0)

  useEffect(() => {
    startTime.current = Date.now()

    const animate = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(value * eased)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return <span>{displayed.toFixed(3)}%</span>
}

function getAccuracyMessage(accuracy: number): string {
  if (accuracy >= 99) return 'Your eyes are dangerous.'
  if (accuracy >= 95) return 'Almost identical.'
  if (accuracy >= 88) return 'Incredible precision.'
  if (accuracy >= 75) return 'Really solid memory.'
  if (accuracy >= 60) return 'Not bad at all.'
  if (accuracy >= 40) return 'Room for improvement.'
  return 'Keep practicing.'
}

export function ResultCard({ result, difficulty }: ResultCardProps) {
  const message = getAccuracyMessage(result.accuracy)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-5"
    >
      {/* Accuracy */}
      <div className="text-center">
        <motion.p
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="font-heading text-score text-deep"
        >
          <CountUpNumber value={result.accuracy} />
        </motion.p>
        <p className="text-sm text-muted mt-1">{message}</p>

        {difficulty && (
          <p className="text-xs text-muted mt-2 capitalize">
            {difficulty} mode · Score: {result.score.toFixed(1)}
          </p>
        )}
      </div>

      {/* Color comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Original */}
        <div className="text-center space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Original</p>
          <div
            className="w-full aspect-square rounded-xl border border-border shadow-sm"
            style={{ backgroundColor: hslString(result.originalColor) }}
          />
          <p className="text-xs text-muted font-mono">
            H:{result.originalColor.h}° S:{result.originalColor.s}% L:{result.originalColor.l}%
          </p>
        </div>

        {/* User */}
        <div className="text-center space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Yours</p>
          <div
            className="w-full aspect-square rounded-xl border border-border shadow-sm"
            style={{ backgroundColor: hslString(result.userColor) }}
          />
          <p className="text-xs text-muted font-mono">
            H:{result.userColor.h}° S:{result.userColor.s}% L:{result.userColor.l}%
          </p>
        </div>
      </div>

      {/* Rating change for competitive */}
      {result.ratingChange && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surface-alt"
        >
          {result.ratingChange.ratingChange >= 0 ? (
            <Check className="w-4 h-4 text-success" />
          ) : (
            <X className="w-4 h-4 text-accent" />
          )}
          <span className="text-sm font-medium">
            {result.ratingChange.ratingChange >= 0 ? '+' : ''}
            {result.ratingChange.ratingChange} Huepoints
          </span>
          {result.ratingChange.tierChanged && (
            <span className="text-xs text-primary font-medium">
              → {result.ratingChange.newTier}
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}