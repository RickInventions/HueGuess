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

/** Compact HSL readout — the same shape used for the target, so they compare at a glance. */
function hslLabel(c: HSLColor): string {
  return `H ${Math.round(c.h)} · S ${Math.round(c.s)} · L ${Math.round(c.l)}`
}

/** Signed per-channel drift from the target, e.g. "+4 / −2 / +11". */
function hslDelta(guess: HSLColor, target: HSLColor): string {
  const fmt = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`
  // Hue is a circle: 350° vs 10° is 20° apart, not 340°.
  let dh = ((guess.h - target.h + 540) % 360) - 180
  if (Object.is(dh, -0)) dh = 0
  return `${fmt(dh)} / ${fmt(guess.s - target.s)} / ${fmt(guess.l - target.l)}`
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
            <p className="text-xs text-muted font-mono">{hslLabel(targetColor)}</p>
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
              {result.isTimeout ? (
                <span className="inline-flex items-center gap-1 text-xs text-accent">
                  <Clock className="w-3 h-3" />
                  No guess
                </span>
              ) : (
                <p className="text-[11px] text-muted font-mono truncate">
                  {hslLabel(result.userColor)}
                  {targetColor && (
                    <span className="hidden sm:inline text-muted">
                      {' · Δ '}
                      {hslDelta(result.userColor, targetColor)}
                    </span>
                  )}
                </p>
              )}
            </div>

            {!result.isTimeout && (
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
                  aria-label={`${result.username}'s guess — ${hslLabel(result.userColor)}`}
                />
              </div>
            )}

            <div className="shrink-0 w-14 text-right">
              <span className={`font-heading font-semibold text-sm ${accuracyTone(result.accuracy)}`}>
                {result.accuracy.toFixed(1)}%
              </span>
              {result.cumulativeAverage !== undefined && (
                <p className="text-[10px] text-muted font-mono leading-tight">
                  {result.cumulativeAverage.toFixed(1)} avg
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
