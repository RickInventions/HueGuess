import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Search, ChevronDown, Medal, Target, TrendingUp, Zap, ArrowLeft } from 'lucide-react'
import { leaderboard } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Link, useNavigate } from 'react-router-dom'

type Period = 'all-time' | 'weekly' | 'daily'
type SortBy = 'points' | 'gamesPlayed' | 'avgAccuracy' | 'streak'
type SortOrder = 'ASC' | 'DESC'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('all-time')
  const [sortBy, setSortBy] = useState<SortBy>('points')
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC')
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
        leaderboard.getLeaderboard({ period, sortBy, sortOrder, search, limit: 100 }),
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
  }, [period, sortBy, sortOrder, search])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const handleSort = (key: SortBy) => {
    if (sortBy === key) {
      // Toggle order if same column
      setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')
    } else {
      // New column: default to DESC
      setSortBy(key)
      setSortOrder('DESC')
    }
  }

  const getSortIcon = (key: SortBy) => {
    if (sortBy !== key) return null
    return sortOrder === 'DESC' ? 
      <ChevronDown className="w-3 h-3 inline ml-1" /> : 
      <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header with Exit Button */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-muted hover:text-deep transition-colors p-2 -ml-2 active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm">Exit</span>
          </button>
          <div className="text-center flex-1">
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-500 to-primary bg-clip-text text-transparent">
              Leaderboard
            </h1>
            <p className="text-muted text-xs sm:text-sm mt-1">Top 100 players with ≥20 competitive games</p>
          </div>
          <div className="w-16 sm:w-20" /> {/* Spacer for centering */}
        </div>

        {/* Global Stats Cards */}
        {globalStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8"
          >
            <Card className="text-center p-2 sm:p-3">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-lg sm:text-2xl font-bold">{globalStats.totalPlayers}</p>
              <p className="text-[10px] sm:text-xs text-muted">Players</p>
            </Card>
            <Card className="text-center p-2 sm:p-3">
              <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-primary mx-auto mb-1" />
              <p className="text-lg sm:text-2xl font-bold">{globalStats.highestRating}</p>
              <p className="text-[10px] sm:text-xs text-muted">Top Score</p>
            </Card>
            <Card className="text-center p-2 sm:p-3">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent mx-auto mb-1" />
              <p className="text-lg sm:text-2xl font-bold">{Math.round(globalStats.avgRating)}</p>
              <p className="text-[10px] sm:text-xs text-muted">Avg Rating</p>
            </Card>
            <Card className="text-center p-2 sm:p-3">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success mx-auto mb-1" />
              <p className="text-xs sm:text-sm font-semibold truncate">{globalStats.topPlayer}</p>
              <p className="text-[10px] sm:text-xs text-muted">Top Player</p>
            </Card>
          </motion.div>
        )}

        {/* Award Emblems */}
        {awards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 sm:mb-8"
          >
            <h2 className="font-heading font-semibold text-base sm:text-lg mb-2 sm:mb-3 flex items-center gap-2">
              <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
              Award Emblems
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {awards.map((award) => (
                <Card key={award.category} className="p-2 sm:p-3 text-center">
                  <div className="text-2xl sm:text-3xl mb-1">{award.icon}</div>
                  <p className="font-semibold text-xs sm:text-sm">{award.category}</p>
                  <p className="text-[10px] sm:text-xs text-muted truncate">{award.username}</p>
                  <p className="text-[10px] sm:text-xs font-mono text-primary">{award.value}</p>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Filters - Responsive Wrap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6"
        >
          {/* Period Tabs */}
          <div className="flex gap-1 sm:gap-2">
            {(['all-time', 'weekly', 'daily'] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'primary' : 'ghost'}
                onClick={() => setPeriod(p)}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
              >
                {p === 'all-time' ? 'All Time' : p === 'weekly' ? 'This Week' : 'Today'}
              </Button>
            ))}
          </div>

          {/* Sort Buttons (Integrated ASC/DESC) */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 ml-auto">
            {(['points', 'gamesPlayed', 'avgAccuracy', 'streak'] as SortBy[]).map((s) => (
              <Button
                key={s}
                variant={sortBy === s ? 'primary' : 'ghost'}
                onClick={() => handleSort(s)}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
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
          className="relative mb-4 sm:mb-6"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base rounded-button bg-surface-alt border border-border focus:outline-none focus:shadow-glow-primary"
          />
        </motion.div>

        {/* Leaderboard Table - Responsive, No Horizontal Scroll */}
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 0.3 }}
>
  <Card className="overflow-hidden">
    {/* Table layout for md screens and up */}
    <div className="hidden md:block overflow-x-auto">
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
              <td colSpan={6} className="text-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </td>
            </tr>
          ) : entries.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-muted">
                No players found
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={entry.userId} className="border-b border-border hover:bg-surface-alt transition-colors">
                <td className="px-4 py-3 text-sm font-mono">{getRankIcon(entry.rank)}</td>
                <td className="px-4 py-3">
                  <Link to={`/profile/${entry.username}`} className="font-medium hover:text-primary transition-colors">
                    {entry.username}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-heading font-semibold">{entry.rating}</td>
                <td className="px-4 py-3 text-right text-muted text-sm">{entry.gamesPlayed}</td>
                <td className="px-4 py-3 text-right text-muted text-sm">{entry.avgAccuracy}%</td>
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

    {/* Card layout for mobile (below md) */}
    <div className="md:hidden divide-y divide-border">
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-muted">No players found</div>
      ) : (
        entries.map((entry) => (
          <div key={entry.userId} className="p-4 space-y-2 hover:bg-surface-alt transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold">{getRankIcon(entry.rank)}</span>
                <Link to={`/profile/${entry.username}`} className="font-semibold hover:text-primary transition-colors">
                  {entry.username}
                </Link>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-500" />
                <span className="text-sm font-medium">{entry.bestStreak}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[10px] text-muted">Rating</p>
                <p className="font-heading font-semibold">{entry.rating}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Games</p>
                <p className="text-muted">{entry.gamesPlayed}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Avg Acc</p>
                <p className="text-muted">{entry.avgAccuracy}%</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </Card>
  <p className="text-xs text-muted text-center mt-4">
    Showing {entries.length} of {total} qualified players
  </p>
</motion.div>
      </div>
    </div>
  )
}