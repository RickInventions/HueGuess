import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Trophy } from 'lucide-react'
import { modes as modesApi } from '../../lib/api'
import type { BoardDifficulty, ExtraBoardEntry, ExtraMode } from '../../types/modes'
import {
  BOARD_DIFFICULTIES,
  DIFFICULTY_CHIPS,
  DIFFICULTY_LABELS,
  EXTRA_MODE_META,
} from '../../types/modes'

interface ExtraBoardProps {
  mode: ExtraMode
  difficulty: BoardDifficulty
  onDifficultyChange: (difficulty: BoardDifficulty) => void
  /** Already debounced by the page. */
  search: string
  /** Highlights your own row. */
  username?: string
}

const medalFor = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null)

const when = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

/** The chip that says which difficulty a row's best round was played at. */
function DifficultyChip({ level }: { level: ExtraBoardEntry['difficulty'] }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        DIFFICULTY_CHIPS[level] ?? 'bg-surface-muted text-muted'
      }`}
    >
      {DIFFICULTY_LABELS[level] ?? level}
    </span>
  )
}

/**
 * A board for Inverted or Blind: one row per player, ranked on their best single
 * round.
 *
 * Deliberately not the competitive table — there are no HuePoints, no rank tier
 * and no qualification threshold to show. Difficulty defaults to `All`, which is
 * still one row per player rather than one per difficulty; a leaderboard where
 * one person holds four adjacent places is not a ranking. Which difficulty
 * produced that round rides along as a label instead, and picking a single
 * difficulty compares like with like.
 */
export function ExtraBoard({
  mode,
  difficulty,
  onDifficultyChange,
  search,
  username,
}: ExtraBoardProps) {
  const [entries, setEntries] = useState<ExtraBoardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)

    modesApi
      .getLeaderboard({ mode, difficulty, search: search || undefined, limit: 100 })
      .then(({ data }) => {
        if (id !== requestId.current) return
        setEntries(data.board?.entries ?? [])
        setTotal(data.board?.total ?? 0)
        setError(null)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        console.error('Failed to load mode leaderboard:', err)
        setEntries([])
        setTotal(0)
        setError('Could not load this board. Check your connection and try again.')
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [mode, difficulty, search])

  const meta = EXTRA_MODE_META[mode]
  /** The label column only earns its space on the mixed board. */
  const showDifficulty = difficulty === 'all'
  const columnCount = showDifficulty ? 6 : 5
  const emptyMessage = search
    ? `Nobody on this board matched “${search}”.`
    : showDifficulty
      ? `No scores yet on ${meta.name}. Play a round and the board is yours.`
      : `No scores yet on ${meta.name} · ${difficulty}. Play a round and the board is yours.`

  return (
    <div className="space-y-3">
      {/* Difficulty is the board, not a column — so it is a tab row. */}
      <div className="space-y-1.5">
        <div
          role="tablist"
          aria-label="Difficulty"
          className="flex gap-1 overflow-x-auto rounded-button bg-surface-alt p-1"
        >
          {BOARD_DIFFICULTIES.map(level => (
            <button
              key={level}
              role="tab"
              aria-selected={difficulty === level}
              onClick={() => onDifficultyChange(level)}
              className={`flex-1 whitespace-nowrap rounded-button px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer sm:text-sm ${
                difficulty === level
                  ? 'bg-surface text-deep shadow-card'
                  : 'text-muted hover:text-deep'
              }`}
            >
              {DIFFICULTY_LABELS[level]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {showDifficulty
            ? 'Everyone’s best round at any difficulty, labelled with the one it was set on. Pick a difficulty to compare like with like — a 98% on easy is not a 98% on extreme.'
            : 'One board per difficulty — a 98% on easy never competes with a 98% on extreme.'}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-card border border-accent/20 bg-accent/10 p-3 text-sm text-accent">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
                {showDifficulty && (
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted">
                    Difficulty
                  </th>
                )}
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-deep">
                  Best accuracy
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted">
                  Rounds
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted">
                  Set on
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="py-14 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-14 text-center text-sm text-muted"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                entries.map(entry => {
                  const isYou = !!username && entry.username === username
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-b border-border last:border-0 transition-colors ${
                        isYou ? 'bg-primary/[0.06]' : 'hover:bg-surface-alt'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm text-deep">
                        {medalFor(entry.rank) ?? `#${entry.rank}`}
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
                        </div>
                      </td>
                      {showDifficulty && (
                        <td className="px-4 py-3">
                          <DifficultyChip level={entry.difficulty} />
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-heading text-sm font-semibold text-deep">
                        {entry.bestAccuracy.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted">
                        {entry.attempts.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted">
                        {when(entry.achievedAt)}
                      </td>
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
              const isYou = !!username && entry.username === username
              return (
                <div key={entry.userId} className={`p-3.5 ${isYou ? 'bg-primary/[0.06]' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 font-mono text-sm font-bold text-deep">
                      {medalFor(entry.rank) ?? `#${entry.rank}`}
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
                        {showDifficulty && <DifficultyChip level={entry.difficulty} />}
                      </div>
                      <p className="text-[11px] text-muted">
                        {entry.attempts.toLocaleString()} round
                        {entry.attempts === 1 ? '' : 's'} · {when(entry.achievedAt)}
                      </p>
                    </div>
                    <span className="font-heading text-lg font-bold text-deep">
                      {entry.bestAccuracy.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {!loading && entries.length > 0 && (
        <p className="text-center text-xs text-muted">
          Showing {entries.length.toLocaleString()} of {total.toLocaleString()} player
          {total === 1 ? '' : 's'}
          {total > entries.length && ' — refine your search to find someone further down'}
        </p>
      )}

      <div className="flex items-start gap-2 rounded-card border border-border bg-surface p-3.5 text-xs text-muted shadow-card sm:text-sm">
        <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <span>
          Ranked on your single best round, ties going to whoever got there first. Everyone with a
          score appears — there is no minimum number of rounds, and nothing here touches HuePoints
          or your competitive rank.
        </span>
      </div>
    </div>
  )
}
