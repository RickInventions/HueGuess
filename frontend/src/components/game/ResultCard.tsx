import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { Check, X, Trophy, TrendingUp, Zap } from 'lucide-react'
import type { RoundResult, Difficulty, Achievement } from '../../types'

interface ResultCardProps {
  result: RoundResult
  difficulty?: Difficulty
  huePoints?: {
    oldRating: number
    newRating: number
    change: number
    streak: number
    rankTier: string
  }
  newlyUnlocked?: Achievement[],
  mode?: 'casual' | 'competitive' 
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
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(value * eased)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return <span>{displayed.toFixed(1)}%</span>
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

export function ResultCard({ result, difficulty, mode, huePoints, newlyUnlocked }: ResultCardProps) {
  const message = getAccuracyMessage(result.accuracy)
  const isNegative = result.isNegative

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

      {difficulty && mode === 'competitive' && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-xs font-medium text-muted bg-surface-alt px-3 py-1 rounded-full capitalize">
            {difficulty}
          </span>
          <span className="text-xs font-medium text-muted bg-surface-alt px-3 py-1 rounded-full">
            {result.multiplier}x multiplier
          </span>
        </div>
      )}

      {difficulty && mode === 'casual' && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-xs font-medium text-muted bg-surface-alt px-3 py-1 rounded-full capitalize">
            {difficulty}
          </span>
        </div>
      )}
      </div>

      {/* Color comparison */}
      <div className="grid grid-cols-2 gap-3">
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

        <div className="text-center space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Your Guess</p>
          <div
            className="w-full aspect-square rounded-xl border border-border shadow-sm"
            style={{ backgroundColor: hslString(result.userColor) }}
          />
          <p className="text-xs text-muted font-mono">
            H:{result.userColor.h}° S:{result.userColor.s}% L:{result.userColor.l}%
          </p>
        </div>
      </div>

      {/* HuePoints change (competitive mode only) */}
      {huePoints && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl ${
            huePoints.change >= 0 ? 'bg-success/10' : 'bg-accent/10'
          }`}>
            {huePoints.change >= 0 ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingUp className="w-4 h-4 text-accent rotate-180" />
            )}
            <span className="text-sm font-medium">
              {huePoints.change >= 0 ? '+' : ''}{huePoints.change} HuePoints
            </span>
            <span className="text-xs text-muted">
              {huePoints.oldRating} → {huePoints.newRating}
            </span>
          </div>

          {/* Streak display */}
          {huePoints && huePoints.streak > 0 && (difficulty === 'hard' || difficulty === 'extreme') && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">{huePoints.streak}</span>
              <span className="text-muted">game streak</span>
            </div>
          )}

          {/* Rank tier */}
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{huePoints.rankTier}</span>
          </div>
        </motion.div>
      )}

      {/* Newly unlocked achievements */}
      {newlyUnlocked && newlyUnlocked.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-2 pt-2"
        >
          <p className="text-center text-xs font-medium text-primary uppercase tracking-wider">
            Achievements Unlocked!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {newlyUnlocked.map((ach) => (
              <div
                key={ach.key}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm"
              >
                <span>{ach.icon}</span>
                <span>{ach.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}