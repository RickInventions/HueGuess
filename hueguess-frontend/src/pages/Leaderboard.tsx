import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Medal } from 'lucide-react'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { TIER_COLORS, type RankTier } from '../lib/constants'
import type { LeaderboardEntry, PlayerRank } from '../types'

type Period = 'daily' | 'weekly' | 'all-time'

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('all-time')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [playerRank, setPlayerRank] = useState<PlayerRank | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getLeaderboard(period)
      .then((data) => {
        setEntries(data.leaderboard)
        setPlayerRank(data.playerRank || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const periods: { value: Period; label: string }[] = [
    { value: 'all-time', label: 'All Time' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-heading text-section mb-2">Leaderboard</h2>
        {/* Period Tabs */}
        <div className="inline-flex bg-surface-alt rounded-button p-1 gap-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-button text-sm font-medium transition-all ${
                period === p.value
                  ? 'bg-surface text-deep shadow-sm'
                  : 'text-muted hover:text-deep'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player rank */}
      {playerRank && playerRank.totalPlayers > 0 && (
        <Card className="text-center">
          <p className="text-sm text-muted">Your Rank</p>
          <p className="font-heading text-3xl font-semibold">
            #{playerRank.rank}{' '}
            <span className="text-sm text-muted font-normal">
              of {playerRank.totalPlayers}
            </span>
          </p>
          <p className="text-xs text-muted">Top {playerRank.percentile}%</p>
        </Card>
      )}

      {/* Leaderboard list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted py-12">No players yet. Be the first!</p>
        ) : (
          entries.map((entry, i) => {
            const tierColor = TIER_COLORS[entry.rankTier as RankTier] || '#CD7F32'
            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-surface border border-border"
              >
                {/* Rank */}
                <div className="w-8 text-center">
                  {entry.rank <= 3 ? (
                    <Medal
                      className={`w-5 h-5 mx-auto ${
                        entry.rank === 1
                          ? 'text-yellow-500'
                          : entry.rank === 2
                          ? 'text-gray-400'
                          : 'text-amber-700'
                      }`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-muted">{entry.rank}</span>
                  )}
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-deep truncate">{entry.username}</p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span style={{ color: tierColor }}>{entry.rankTier}</span>
                    <span>·</span>
                    <span>{entry.gamesPlayed} games</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <p className="font-heading font-semibold">{entry.rating}</p>
                  <p className="text-xs text-muted">{entry.avgAccuracy}%</p>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}