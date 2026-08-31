import { useState } from 'react'
import { motion } from 'framer-motion'
import { Medal, Clock, SmilePlus } from 'lucide-react'
import type { ReactionMap, RoundResult } from '../../types/multiplayer'
import { REACTION_EMOJIS } from '../../types/multiplayer'
import type { HSLColor } from '../../types'

interface RoundResultsProps {
  results: RoundResult[]
  /** The colour everyone was aiming at — shown so players can compare. */
  targetColor?: HSLColor | null
  currentUserId?: string
  round?: number
  /** Duel mode: mark whoever took this round's point. */
  showPoints?: boolean
  /** Who reacted to whom: targetUserId → emoji → reactor ids. */
  reactions?: ReactionMap
  /** Omitted while offline, which hides the reaction controls rather than failing. */
  onReact?: (targetUserId: string, emoji: string) => void
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

/**
 * Telegram-style reactions on one player's result: what people already left as
 * count chips, yours outlined, and the six-emoji picker behind the last button.
 * One reaction per person — a different pick replaces it, the same pick clears it.
 */
function ReactionBar({
  targetUserId,
  reactions,
  currentUserId,
  onReact,
}: {
  targetUserId: string
  reactions: Record<string, string[]>
  currentUserId?: string
  onReact?: (targetUserId: string, emoji: string) => void
}) {
  const [picking, setPicking] = useState(false)

  // Held in the canonical emoji order rather than however the map serialised, so
  // a chip doesn't hop to a different slot when somebody else reacts.
  const chips = REACTION_EMOJIS.map(emoji => ({ emoji, userIds: reactions[emoji] ?? [] })).filter(
    chip => chip.userIds.length > 0
  )

  const mine = currentUserId
    ? chips.find(chip => chip.userIds.includes(currentUserId))?.emoji ?? null
    : null

  const react = (emoji: string) => {
    setPicking(false)
    onReact?.(targetUserId, emoji)
  }

  // Nothing to show and nothing to do — don't leave an empty strip behind.
  if (!onReact && chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map(chip => {
        const isMine = chip.emoji === mine
        return (
          <button
            key={chip.emoji}
            type="button"
            onClick={() => react(chip.emoji)}
            disabled={!onReact}
            aria-pressed={isMine}
            aria-label={`${chip.emoji} — ${chip.userIds.length} ${
              chip.userIds.length === 1 ? 'reaction' : 'reactions'
            }`}
            className={`inline-flex h-10 min-w-[44px] items-center justify-center gap-1 rounded-full border px-2 text-sm transition-colors disabled:cursor-default ${
              isMine ? 'border-primary bg-primary/10' : 'border-border bg-surface-alt'
            } ${onReact ? 'cursor-pointer hover:bg-primary/10' : ''}`}
          >
            <span aria-hidden>{chip.emoji}</span>
            <span className="font-mono text-[11px] text-muted">{chip.userIds.length}</span>
          </button>
        )
      })}

      {onReact && (
        <button
          type="button"
          onClick={() => setPicking(v => !v)}
          aria-expanded={picking}
          aria-label="React to this result"
          className={`inline-flex h-10 w-11 items-center justify-center rounded-full border transition-colors cursor-pointer ${
            picking
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-surface-alt text-muted hover:text-deep'
          }`}
        >
          <SmilePlus className="h-4 w-4" />
        </button>
      )}

      {picking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex w-full flex-wrap gap-1 rounded-card border border-border bg-surface p-1.5 shadow-card"
        >
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              aria-label={`React with ${emoji}`}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-lg transition-colors cursor-pointer ${
                emoji === mine ? 'bg-primary/15' : 'hover:bg-surface-alt'
              }`}
            >
              {emoji}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}

export function RoundResults({
  results,
  targetColor,
  currentUserId,
  round,
  showPoints = false,
  reactions,
  onReact,
}: RoundResultsProps) {
  const sorted = [...results].sort((a, b) => b.accuracy - a.accuracy)

  // Mirrors the server's duel award: compare rounded so a float hair's-breadth
  // can't hide a genuine tie, and a round nobody scored in awards nothing.
  const pointKey = (accuracy: number) => Math.round(accuracy * 1000)
  const bestKey = sorted.length ? Math.max(...sorted.map(r => pointKey(r.accuracy))) : 0
  const awardsPoint = showPoints && bestKey > 0

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
        const tookPoint = awardsPoint && pointKey(result.accuracy) === bestKey

        return (
          <motion.div
            key={result.socketId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.08, 0.4) }}
            className={`px-3 sm:px-4 py-3 rounded-card border ${
              isYou ? 'bg-primary/5 border-primary/40' : 'bg-surface border-border'
            }`}
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
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
                {/* In duel the point is the score, so it takes the slot the
                    running average would otherwise use. */}
                {tookPoint ? (
                  <p className="text-[10px] font-semibold leading-tight text-primary">+1 point</p>
                ) : result.cumulativeAverage !== undefined ? (
                  <p className="text-[10px] text-muted font-mono leading-tight">
                    {result.cumulativeAverage.toFixed(1)} avg
                  </p>
                ) : null}
              </div>
            </div>

            <ReactionBar
              targetUserId={result.userId}
              reactions={reactions?.[result.userId] ?? {}}
              currentUserId={currentUserId}
              onReact={onReact}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
