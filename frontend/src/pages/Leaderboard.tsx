import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  Crown,
  Info,
  Medal,
  Search,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { leaderboard as leaderboardApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { RankBadge } from '../components/ui/RankBadge'
import type {
  AwardEmblem,
  LeaderboardEntry,
  LeaderboardGlobalStats,
  LeaderboardPeriod,
  LeaderboardSortBy,
  LeaderboardSortOrder,
} from '../types'

const PERIODS: { key: LeaderboardPeriod; label: string; short: string }[] = [
  { key: 'all-time', label: 'All time', short: 'All time' },
  { key: 'weekly', label: 'This week', short: 'Week' },
  { key: 'daily', label: 'Today', short: 'Today' },
]

const medalFor = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null)

const percent = (value: number) => `${value.toFixed(1)}%`
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString()}`

function StatTile({
  icon,
  value,
  label,
  tone = 'text-primary',
}: {
  icon: ReactNode
  value: ReactNode
  label: string
  tone?: string
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-3 text-center shadow-card">
      <span className={`mx-auto mb-1.5 block w-fit ${tone}`}>{icon}</span>
      <p className="truncate font-heading text-lg font-semibold text-deep sm:text-xl">{value}</p>
      <p className="text-[10px] text-muted sm:text-xs">{label}</p>
    </div>
  )
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [period, setPeriod] = useState<LeaderboardPeriod>('all-time')
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('points')
  const [sortOrder, setSortOrder] = useState<LeaderboardSortOrder>('DESC')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [awards, setAwards] = useState<AwardEmblem[]>([])
  const [globalStats, setGlobalStats] = useState<LeaderboardGlobalStats | null>(null)
  const [minRankedGames, setMinRankedGames] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  // One request per filter change. The id guard drops a slow response that has
  // been overtaken — otherwise typing fast can leave the board showing the
  // results of a query you already moved on from.
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)

    leaderboardApi
      .getLeaderboard({
        period,
        sortBy,
        sortOrder,
        search: debouncedSearch || undefined,
        limit: 100,
      })
      .then(({ data }) => {
        if (id !== requestId.current) return
        setEntries(data.leaderboard?.entries ?? [])
        setTotal(data.leaderboard?.total ?? 0)
        setAwards(data.awards ?? [])
        setGlobalStats(data.globalStats ?? null)
        setMinRankedGames(data.leaderboard?.minRankedGames ?? data.minRankedGames ?? 20)
        setError(null)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        console.error('Failed to load leaderboard:', err)
        setEntries([])
        setTotal(0)
        setError('Could not load the leaderboard. Check your connection and try again.')
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [period, sortBy, sortOrder, debouncedSearch])

  const isPeriod = period !== 'all-time'
  /** Medals only mean something on the canonical points-descending ranking. */
  const showMedals = sortBy === 'points' && sortOrder === 'DESC'

  /**
   * One definition drives the desktop table, the mobile cards and the sort
   * control, so a column can never sort by something it does not display.
   */
  const columns = useMemo(() => {
    const definitions: {
      key: LeaderboardSortBy
      label: string
      shortLabel: string
      hint?: string
      render: (entry: LeaderboardEntry) => ReactNode
    }[] = [
      {
        key: 'points',
        label: isPeriod ? 'Points gained' : 'Points',
        shortLabel: 'Points',
        hint: isPeriod ? 'HuePoints won or lost inside this window' : undefined,
        render: entry =>
          isPeriod && entry.periodStats ? (
            <span
              className={
                entry.periodStats.pointsGained > 0
                  ? 'text-success'
                  : entry.periodStats.pointsGained < 0
                    ? 'text-accent'
                    : 'text-muted'
              }
            >
              {signed(entry.periodStats.pointsGained)}
            </span>
          ) : (
            <span className="text-deep">{entry.rating.toLocaleString()}</span>
          ),
      },
      {
        key: 'gamesPlayed',
        label: 'Games',
        shortLabel: 'Games',
        render: entry =>
          (isPeriod && entry.periodStats ? entry.periodStats.games : entry.gamesPlayed).toLocaleString(),
      },
      {
        key: 'avgAccuracy',
        label: 'Avg accuracy',
        shortLabel: 'Accuracy',
        render: entry =>
          percent(isPeriod && entry.periodStats ? entry.periodStats.avgAccuracy : entry.avgAccuracy),
      },
      {
        key: 'streak',
        label: isPeriod ? 'Streak' : 'Best streak',
        shortLabel: 'Streak',
        hint: isPeriod ? 'Longest run inside this window' : 'Longest run ever',
        render: entry => (
          <span className="inline-flex items-center justify-end gap-1">
            <Zap className="h-3 w-3 text-accent" aria-hidden="true" />
            {isPeriod && entry.periodStats ? entry.periodStats.bestStreak : entry.bestStreak}
          </span>
        ),
      },
    ]
    return definitions
  }, [isPeriod])

  const toggleSort = (key: LeaderboardSortBy) => {
    if (sortBy === key) {
      setSortOrder(prev => (prev === 'DESC' ? 'ASC' : 'DESC'))
    } else {
      setSortBy(key)
      setSortOrder('DESC')
    }
  }

  const sortIndicator = (key: LeaderboardSortBy) => {
    if (sortBy !== key) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    return (
      <ChevronDown
        className={`ml-1 inline h-3 w-3 text-primary ${sortOrder === 'ASC' ? 'rotate-180' : ''}`}
      />
    )
  }

  const periodNote = isPeriod
    ? period === 'weekly'
      ? 'Ranked on the last 7 days — only players who played in that window appear.'
      : 'Ranked on the last 24 hours — only players who played in that window appear.'
    : `Ranked on current HuePoints. Accounts qualify after ${minRankedGames} competitive games.`

  const emptyMessage = debouncedSearch
    ? `No ranked player matched “${debouncedSearch}”.`
    : isPeriod
      ? 'Nobody on the board has played in this window yet.'
      : `No qualified players yet — ${minRankedGames} competitive games gets you on the board.`

  const youAreListed = !!user && entries.some(entry => entry.username === user.username)
  /**
   * When the board is longer than the page, an absent player might simply be
   * ranked below the cut rather than unqualified — so the two cases get
   * different copy.
   */
  const boardTruncated = total > entries.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-base via-surface to-primary/[0.05]">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-5 flex items-center gap-2 sm:mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex shrink-0 items-center gap-1 rounded-button p-2 text-muted transition-colors hover:bg-surface-alt hover:text-deep cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Exit</span>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="font-heading text-2xl font-bold text-deep sm:text-3xl md:text-4xl">
              Leaderboard
            </h1>
            <p className="mt-1 text-xs text-muted sm:text-sm">{periodNote}</p>
          </div>
          {/* Balances the exit button so the title stays optically centred. */}
          <div className="w-[68px] shrink-0 sm:w-[76px]" aria-hidden="true" />
        </div>

        {/* ── Global stats ────────────────────────────────────────────────── */}
        {globalStats && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 grid grid-cols-2 gap-2 sm:mb-7 sm:grid-cols-4 sm:gap-3"
          >
            <StatTile
              icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
              value={globalStats.rankedPlayers.toLocaleString()}
              label="Ranked players"
            />
            <StatTile
              icon={<Medal className="h-4 w-4 sm:h-5 sm:w-5" />}
              value={globalStats.highestRating.toLocaleString()}
              label="Highest points"
              tone="text-accent"
            />
            <StatTile
              icon={<Target className="h-4 w-4 sm:h-5 sm:w-5" />}
              value={globalStats.avgRating.toLocaleString()}
              label="Average points"
              tone="text-success"
            />
            <StatTile
              icon={<Crown className="h-4 w-4 sm:h-5 sm:w-5" />}
              value={globalStats.topPlayer ?? '—'}
              label="Points leader"
              tone="text-primary"
            />
          </motion.div>
        )}

        {/* ── Awards ──────────────────────────────────────────────────────── */}
        {awards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-5 sm:mb-7"
          >
            <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted sm:mb-3">
              <Medal className="h-4 w-4" />
              Award emblems
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {awards.map(award => (
                <Link
                  key={award.key}
                  to={`/profile/${award.username}`}
                  className="rounded-card border border-border bg-surface p-3 text-center shadow-card transition-colors hover:border-primary/30 hover:bg-surface-alt"
                >
                  <div className="text-2xl sm:text-3xl">{award.icon}</div>
                  <p className="mt-1 text-xs font-semibold text-deep sm:text-sm">{award.category}</p>
                  <p className="truncate text-[11px] text-muted">{award.username}</p>
                  <p className="font-mono text-[11px] text-primary">
                    {award.value.toLocaleString()}
                    {award.suffix}
                  </p>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-3 space-y-2.5 sm:mb-4"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div
              role="tablist"
              aria-label="Leaderboard period"
              className="flex gap-1 rounded-button bg-surface-alt p-1"
            >
              {PERIODS.map(item => (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={period === item.key}
                  onClick={() => setPeriod(item.key)}
                  className={`flex-1 whitespace-nowrap rounded-button px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer sm:text-sm ${
                    period === item.key
                      ? 'bg-surface text-deep shadow-card'
                      : 'text-muted hover:text-deep'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search by username"
                autoComplete="off"
                aria-label="Search the leaderboard by username"
                // 16px on phones: anything smaller makes iOS Safari zoom on focus.
                className="w-full rounded-button border border-border bg-surface-alt py-2.5 pl-9 pr-9 text-base text-deep placeholder:text-muted focus:border-primary/40 focus:outline-none sm:text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-button p-1 text-muted transition-colors hover:bg-surface hover:text-deep cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop sorts live on the table headers; phones get pills. */}
          <div className="flex flex-wrap items-center gap-1.5 md:hidden">
            <span className="text-[11px] uppercase tracking-wider text-muted">Sort</span>
            {columns.map(column => (
              <button
                key={column.key}
                onClick={() => toggleSort(column.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  sortBy === column.key
                    ? 'border-primary/40 bg-primary/10 text-deep'
                    : 'border-border bg-surface text-muted'
                }`}
              >
                {column.shortLabel}
                {sortIndicator(column.key)}
              </button>
            ))}
          </div>
        </motion.div>

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-card border border-accent/20 bg-accent/10 p-3 text-sm text-accent">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Board ───────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
            {/* Table on md and up */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="border-b border-border bg-surface-alt">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted">
                      #
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted">
                      Player
                    </th>
                    {columns.map(column => (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          sortBy === column.key
                            ? sortOrder === 'DESC'
                              ? 'descending'
                              : 'ascending'
                            : 'none'
                        }
                        className="px-4 py-3 text-right text-xs font-medium"
                      >
                        <button
                          onClick={() => toggleSort(column.key)}
                          title={column.hint}
                          className={`inline-flex items-center transition-colors cursor-pointer ${
                            sortBy === column.key ? 'text-deep' : 'text-muted hover:text-deep'
                          }`}
                        >
                          {column.label}
                          {sortIndicator(column.key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={2 + columns.length} className="py-14 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2 + columns.length}
                        className="px-4 py-14 text-center text-sm text-muted"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    entries.map(entry => {
                      const isYou = !!user && entry.username === user.username
                      const medal = showMedals ? medalFor(entry.rank) : null
                      return (
                        <tr
                          key={entry.userId}
                          className={`border-b border-border last:border-0 transition-colors ${
                            isYou ? 'bg-primary/[0.06]' : 'hover:bg-surface-alt'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-sm text-deep">
                            {medal ?? `#${entry.rank}`}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/profile/${entry.username}`}
                                className="font-medium text-deep transition-colors hover:text-primary"
                              >
                                {entry.username}
                              </Link>
                              {isYou && (
                                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                  You
                                </span>
                              )}
                              <RankBadge label={entry.rankTier} size="xs" />
                              {isPeriod && (
                                <span className="font-mono text-[11px] text-muted">
                                  {entry.rating.toLocaleString()} pts
                                </span>
                              )}
                            </div>
                          </td>
                          {columns.map(column => (
                            <td
                              key={column.key}
                              className={`px-4 py-3 text-right text-sm ${
                                sortBy === column.key
                                  ? 'font-heading font-semibold text-deep'
                                  : 'text-muted'
                              }`}
                            >
                              {column.render(entry)}
                            </td>
                          ))}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Cards below md */}
            <div className="divide-y divide-border md:hidden">
              {loading ? (
                <div className="py-14 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : entries.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm text-muted">{emptyMessage}</div>
              ) : (
                entries.map(entry => {
                  const isYou = !!user && entry.username === user.username
                  const medal = showMedals ? medalFor(entry.rank) : null
                  return (
                    <div
                      key={entry.userId}
                      className={`p-3.5 ${isYou ? 'bg-primary/[0.06]' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 w-9 shrink-0 font-mono text-base font-bold text-deep">
                          {medal ?? `#${entry.rank}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              to={`/profile/${entry.username}`}
                              className="truncate font-semibold text-deep"
                            >
                              {entry.username}
                            </Link>
                            {isYou && (
                              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                You
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <RankBadge label={entry.rankTier} size="xs" />
                            {isPeriod && (
                              <span className="font-mono text-[11px] text-muted">
                                {entry.rating.toLocaleString()} pts
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                        {columns.map(column => (
                          <div
                            key={column.key}
                            className={`rounded-xl px-1 py-1.5 ${
                              sortBy === column.key ? 'bg-primary/10' : 'bg-surface-alt'
                            }`}
                          >
                            <p className="truncate text-[10px] text-muted">{column.shortLabel}</p>
                            <p className="text-xs font-semibold text-deep">{column.render(entry)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {!loading && entries.length > 0 && (
            <p className="mt-3 text-center text-xs text-muted">
              Showing {entries.length.toLocaleString()} of {total.toLocaleString()}
              {debouncedSearch ? ' matching' : ' qualified'} player{total === 1 ? '' : 's'}
              {total > entries.length && ' — refine your search to find someone further down'}
            </p>
          )}
        </motion.div>

        {/* Without this, an unqualified player just sees a board they are missing
            from and no reason why. Suppressed while searching, where their own
            absence from the results means nothing. */}
        {!loading && !!user && !debouncedSearch && !youAreListed && (
          <div className="mt-4 flex items-start gap-2 rounded-card border border-border bg-surface p-3.5 text-xs text-muted shadow-card sm:text-sm">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              {boardTruncated ? (
                <>
                  You are not in the top {entries.length.toLocaleString()} here — search your
                  username to see your exact position on the board.
                </>
              ) : isPeriod ? (
                'You are not on this board. Play a competitive game inside this window to appear here.'
              ) : (
                <>
                  You are not on this board. Accounts qualify after {minRankedGames} competitive
                  games — check your total on your{' '}
                  <Link to="/profile" className="font-medium text-primary hover:underline">
                    profile
                  </Link>
                  .
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
