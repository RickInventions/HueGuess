import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Search, ChevronDown, Medal, Target, TrendingUp, Zap } from 'lucide-react'
import { leaderboard } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'

type Period = 'all-time' | 'weekly' | 'daily'
type SortBy = 'points' | 'gamesPlayed' | 'avgAccuracy' | 'streak'

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('all-time')
  const [sortBy, setSortBy] = useState<SortBy>('points')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [awards, setAwards] = useState<any[]>([])
  const [globalStats, setGlobalStats] = useState<any>(null)

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const [leaderboardRes, awardsRes, statsRes] = await Promise.all([
        leaderboard.getLeaderboard({ period, sortBy, sortOrder: 'DESC', search, limit: 100 }),
        leaderboard.getAwards(),
        leaderboard.getGlobalStats(),
      ])
      setEntries(leaderboardRes.data.leaderboard.entries)
      setTotal(leaderboardRes.data.leaderboard.total)
      setAwards(awardsRes.data.awards)
      setGlobalStats(statsRes.data.stats)
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [period, sortBy, search])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getSortIcon = (key: SortBy) => {
    if (sortBy !== key) return null
    return <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-yellow-500 to-primary bg-clip-text text-transparent">
          Leaderboard
        </h1>
        <p className="text-muted mt-2">Top 100 players with at least 20 competitive games</p>
      </motion.div>

      {/* Global Stats Cards */}
      {globalStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          <Card className="text-center p-3">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{globalStats.totalPlayers}</p>
            <p className="text-xs text-muted">Players</p>
          </Card>
          <Card className="text-center p-3">
            <Medal className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{globalStats.highestRating}</p>
            <p className="text-xs text-muted">Top Score</p>
          </Card>
          <Card className="text-center p-3">
            <Target className="w-5 h-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold">{Math.round(globalStats.avgRating)}</p>
            <p className="text-xs text-muted">Avg Rating</p>
          </Card>
          <Card className="text-center p-3">
            <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-sm font-semibold truncate">{globalStats.topPlayer}</p>
            <p className="text-xs text-muted">Top Player</p>
          </Card>
        </motion.div>
      )}

      {/* Award Emblems */}
      {awards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <h2 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <Medal className="w-5 h-5 text-accent" />
            Award Emblems
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {awards.map((award) => (
              <Card key={award.category} className="p-3 text-center">
                <div className="text-3xl mb-1">{award.icon}</div>
                <p className="font-semibold text-sm">{award.category}</p>
                <p className="text-xs text-muted truncate">{award.username}</p>
                <p className="text-xs font-mono text-primary">{award.value}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-3 mb-6"
      >
        <div className="flex gap-2">
          {(['all-time', 'weekly', 'daily'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'primary' : 'ghost'}
              onClick={() => setPeriod(p)}
            >
              {p === 'all-time' ? 'All Time' : p === 'weekly' ? 'This Week' : 'Today'}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {(['points', 'gamesPlayed', 'avgAccuracy', 'streak'] as SortBy[]).map((s) => (
            <Button
              key={s}
              variant={sortBy === s ? 'primary' : 'ghost'}
              onClick={() => setSortBy(s)}
            >
              {s === 'points' ? 'Points' : s === 'gamesPlayed' ? 'Games' : s === 'avgAccuracy' ? 'Accuracy' : 'Streak'}
              {getSortIcon(s)}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="relative mb-6"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-button bg-surface-alt border border-border focus:outline-none focus:shadow-glow-primary"
        />
      </motion.div>

      {/* Leaderboard Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-alt border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">Player</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted">Rating</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted">Games</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted">Avg Acc</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted">Best Streak</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted">
                      No players found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.userId} className="border-b border-border hover:bg-surface-alt transition-colors">
                      <td className="px-4 py-3 text-sm font-mono">
                        {getRankIcon(entry.rank)}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/profile/${entry.username}`} className="font-medium hover:text-primary transition-colors">
                          {entry.username}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-heading font-semibold">
                        {entry.rating}
                      </td>
                      <td className="px-4 py-3 text-right text-muted text-sm">
                        {entry.gamesPlayed}
                      </td>
                      <td className="px-4 py-3 text-right text-muted text-sm">
                        {entry.avgAccuracy}%
                      </td>
                      <td className="px-4 py-3 text-right text-muted text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <Zap className="w-3 h-3 text-yellow-500" />
                          {entry.bestStreak}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted text-center mt-4">
          Showing {entries.length} of {total} qualified players
        </p>
      </motion.div>
    </div>
  )
}