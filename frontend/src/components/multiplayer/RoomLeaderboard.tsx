import { motion } from 'framer-motion'
import { Crown, Check } from 'lucide-react'
import type { LeaderboardEntry } from '../../types/multiplayer'

interface RoomLeaderboardProps {
  entries: LeaderboardEntry[]
  rounds: number
  currentUserId?: string
  /** Show the play-again vote ticks (post-game view only). */
  showVotes?: boolean
}

export function RoomLeaderboard({ entries, rounds, currentUserId, showVotes = false }: RoomLeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.averageAccuracy - a.averageAccuracy)

  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="font-heading text-lg font-semibold">Leaderboard</h3>
        <p className="text-xs text-muted">
          After {rounds} round{rounds !== 1 ? 's' : ''}
        </p>
      </div>

      {sorted.map((entry, i) => {
        const isYou = !!currentUserId && entry.userId === currentUserId

        return (
          <motion.div
            key={entry.socketId}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.08, 0.4) }}
            className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 rounded-card border ${
              isYou ? 'bg-primary/5 border-primary/40' : 'bg-surface border-border'
            }`}
          >
            <div className="w-7 sm:w-8 text-center shrink-0">
              {i === 0 ? (
                <Crown className="w-5 h-5 text-yellow-500 mx-auto" />
              ) : (
                <span className="text-sm font-medium text-muted">#{i + 1}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {entry.username}
                {isYou && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary">You</span>}
              </p>
              {showVotes && entry.playedAgain && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <Check className="w-3 h-3" />
                  Ready for a rematch
                </span>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="font-heading font-semibold text-sm">{entry.averageAccuracy.toFixed(2)}%</span>
              <p className="text-xs text-muted">
                {entry.roundsPlayed} round{entry.roundsPlayed !== 1 ? 's' : ''}
              </p>
            </div>
          </motion.div>
        )
      })}

      {entries.length === 0 && <p className="text-center text-muted text-sm py-4">No rounds played yet</p>}
    </div>
  )
}
