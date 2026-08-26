import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Check, User, WifiOff, RefreshCw } from 'lucide-react'
import type { Player } from '../../types/multiplayer'

interface PlayerListProps {
  players: Player[]
  hostSocketId: string | null
  maxPlayers?: number
  /** Highlights which card is you. */
  currentUserId?: string
  /** Show each player's running average — used mid-game. */
  showScores?: boolean
}

export function PlayerList({
  players,
  hostSocketId,
  maxPlayers = 4,
  currentUserId,
  showScores = false,
}: PlayerListProps) {
  const slotCount = Math.max(maxPlayers, players.length)
  const slots: (Player | null)[] = Array.from({ length: slotCount }, (_, i) => players[i] ?? null)

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <AnimatePresence initial={false}>
        {slots.map((player, i) => {
          const isYou = !!player && !!currentUserId && player.userId === currentUserId
          const average =
            player && player.roundsPlayed > 0 ? player.totalAccuracy / player.roundsPlayed : null

          return (
            <motion.div
              key={player?.socketId ?? `empty-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-card border-2 p-3 sm:p-4 text-center transition-colors ${
                player
                  ? player.status === 'ready'
                    ? 'border-success bg-success/5'
                    : player.status === 'disconnected'
                      ? 'border-accent/50 bg-accent/5 opacity-70'
                      : isYou
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border bg-surface'
                  : 'border-dashed border-muted/20 bg-transparent'
              }`}
            >
              {player ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 min-w-0">
                    {player.socketId === hostSocketId && (
                      <Crown className="w-3.5 h-3.5 shrink-0 text-yellow-500" aria-label="Host" />
                    )}
                    <span className="font-medium text-xs sm:text-sm truncate">{player.username}</span>
                    {player.status === 'disconnected' && (
                      <WifiOff className="w-3 h-3 shrink-0 text-accent" aria-label="Disconnected" />
                    )}
                  </div>

                  {isYou && <span className="block text-[10px] uppercase tracking-wide text-primary">You</span>}

                  {player.status === 'ready' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                      <Check className="w-3 h-3" />
                      Ready
                    </span>
                  ) : player.status === 'disconnected' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-accent">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Reconnecting…
                    </span>
                  ) : player.status === 'playing' ? (
                    <span className="text-xs text-muted">Playing</span>
                  ) : (
                    <span className="text-xs text-muted">Not ready</span>
                  )}

                  {showScores && average !== null && (
                    <span className="block text-xs font-mono text-muted">{average.toFixed(1)}% avg</span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-3 text-muted/30">
                  <User className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-xs">Empty slot</span>
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
