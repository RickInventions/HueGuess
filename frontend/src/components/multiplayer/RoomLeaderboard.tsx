import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import type { LeaderboardEntry } from '../../types'

interface RoomLeaderboardProps {
  entries: LeaderboardEntry[]
  rounds: number
}

export function RoomLeaderboard({ entries, rounds }: RoomLeaderboardProps) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <h3 className="font-heading text-lg font-semibold">Leaderboard</h3>
        <p className="text-xs text-muted">After {rounds} rounds</p>
      </div>

      {entries.map((entry, i) => (
        <motion.div
          key={entry.username}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border"
        >
          <div className="w-8 text-center">
            {i === 0 ? (
              <Trophy className="w-5 h-5 text-yellow-500 mx-auto" />
            ) : (
              <span className="text-sm font-medium text-muted">#{i + 1}</span>
            )}
          </div>
          <span className="font-medium text-sm flex-1">{entry.username}</span>
          <div className="text-right">
            <span className="font-heading font-semibold text-sm">{entry.avgAccuracy}%</span>
            <p className="text-xs text-muted">{entry.roundsPlayed} rounds</p>
          </div>
        </motion.div>
      ))}

      {entries.length === 0 && (
        <p className="text-center text-muted text-sm py-4">No rounds played yet</p>
      )}
    </div>
  )
}