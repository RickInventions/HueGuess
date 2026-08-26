import { motion } from 'framer-motion'
import { Medal, Clock } from 'lucide-react'
import type { RoundResult } from '../../types/multiplayer'
import type { HSLColor } from '../../types'

interface RoundResultsProps {
  results: RoundResult[]
  /** The colour everyone was aiming at — shown so players can compare. */
  targetColor?: HSLColor | null
  currentUserId?: string
  round?: number
}

function hslString(c: HSLColor): string {
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`
}

function accuracyTone(accuracy: number): string {
  if (accuracy >= 90) return 'text-success'
  if (accuracy >= 70) return 'text-primary'
  return 'text-muted'
}

export function RoundResults({ results, targetColor, currentUserId, round }: RoundResultsProps) {
  const sorted = [...results].sort((a, b) => b.accuracy - a.accuracy)

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="font-heading text-lg font-semibold">Round Results</h3>
        {round ? <p className="text-xs text-muted">Round {round}</p> : null}
      </div>

      {targetColor && (
        <div className="flex items-center justify-center gap-3 p-3 rounded-card bg-surface-alt border border-border">
          <div
            className="w-10 h-10 rounded-lg border border-border shrink-0"
            style={{ backgroundColor: hslString(targetColor) }}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium">The colour was</p>
            <p className="text-xs text-muted font-mono">
              H {Math.round(targetColor.h)} · S {Math.round(targetColor.s)} · L {Math.round(targetColor.l)}
            </p>
          </div>
        </div>
      )}

      {sorted.length === 0 && <p className="text-center text-sm text-muted py-4">No guesses this round</p>}

      {sorted.map((result, i) => {
        const isYou = !!currentUserId && result.userId === currentUserId

        return (
          <motion.div
            key={result.socketId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.08, 0.4) }}
            className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 rounded-card border ${
              isYou ? 'bg-primary/5 border-primary/40' : 'bg-surface border-border'
            }`}
          >
            <div className="w-7 sm:w-8 text-center shrink-0">
              {i === 0 && <Medal className="w-5 h-5 text-yellow-500 mx-auto" />}
              {i === 1 && <Medal className="w-5 h-5 text-gray-400 mx-auto" />}
              {i === 2 && <Medal className="w-5 h-5 text-amber-700 mx-auto" />}
              {i > 2 && <span className="text-sm font-medium text-muted">#{i + 1}</span>}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {result.username}
                {isYou && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary">You</span>}
              </p>
              {result.cumulativeAverage !== undefined && (
                <p className="text-xs text-muted font-mono">{result.cumulativeAverage.toFixed(1)}% avg</p>
              )}
            </div>

            {result.isTimeout ? (
              <span className="inline-flex items-center gap-1 text-xs text-accent shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">No guess</span>
              </span>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {targetColor && (
                  <div
                    className="w-5 h-5 rounded-md border border-border"
                    style={{ backgroundColor: hslString(targetColor) }}
                    aria-hidden
                  />
                )}
                <div
                  className="w-5 h-5 rounded-md border border-border"
                  style={{ backgroundColor: hslString(result.userColor) }}
                  aria-label={`${result.username}'s guess`}
                />
              </div>
            )}

            <span className={`font-heading font-semibold text-sm shrink-0 w-14 text-right ${accuracyTone(result.accuracy)}`}>
              {result.accuracy.toFixed(1)}%
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
