import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Medal, Search, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getLeaderboard(period, page, 25)
      setEntries(data.leaderboard || [])
      setPlayerRank(data.playerRank || null)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      // silent
    } finally {
      setLoading(false)
    }
  }, [period, page])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const periods: { value: Period; label: string }[] = [
    { value: 'all-time', label: 'All Time' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="font-heading text-section">Leaderboard</h2>

        {/* Period Tabs */}
        <div className="inline-flex bg-surface-alt rounded-button p-1 gap-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setPeriod(p.value)
                setPage(1)
              }}
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

        {/* Search */}
        <div className="relative max-w-xs mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-button bg-surface-alt border border-border text-sm text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
          />
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
          <p className="text-xs text-muted">
            Top {playerRank.percentile}% · Next tier:{' '}
            {playerRank.nextTierProgress.nextTier
              ? `${playerRank.nextTierProgress.ratingNeeded} pts to ${playerRank.nextTierProgress.nextTier}`
              : 'Max tier'}
          </p>
        </Card>
      )}

      {/* Leaderboard list */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div key="loading" className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted py-12"
          >
            {search ? 'No players found.' : 'No players yet. Be the first!'}
          </motion.p>
        ) : (
          <motion.div
            key={`${period}-${page}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {entries.map((entry, i) => {
              const tierColor = TIER_COLORS[entry.rankTier as RankTier] || '#CD7F32'
              return (
                <motion.div
                  key={entry.rank}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border"
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
                    <p className="font-heading font-semibold text-sm">{entry.rating}</p>
                    <p className="text-xs text-muted">{entry.avgAccuracy}%</p>
                  </div>
                </motion.div>
              )
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                title='nextPage'
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-button text-muted hover:text-deep hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted font-medium">
                  {page} / {totalPages}
                </span>
                <button
                title='totalPages'
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-button text-muted hover:text-deep hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}