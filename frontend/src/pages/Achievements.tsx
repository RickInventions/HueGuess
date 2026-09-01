import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Lock, Pin, Search, Sparkles, X } from 'lucide-react'
import { achievements as achievementsApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'

/**
 * The achievements page.
 *
 * At 100 achievements a single flat list is unusable — most of it is locked cards
 * you have to scroll past to reach anything. So: category tabs, a search box, and
 * an all/unlocked/locked filter, all applied to one list rather than the previous
 * two separate unlocked/locked sections. Cards keep their unlocked state visible
 * through colour and a tier badge instead of position on the page.
 */

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'

interface Achievement {
  key: string
  name: string
  description: string
  category: string
  icon: string
  tier: Tier
  points: number
  requirement_value: number
  progress_current?: number
  progress_target?: number
  unlocked_at?: string
}

interface Stats {
  total: number
  totalPossible: number
  points: number
  totalPoints: number
  byCategory: Record<string, number>
}

/**
 * Tier styling.
 *
 * Solid hex rather than theme tokens because these four are a distinct scale that
 * has to read as bronze → platinum; mapping them onto the palette would collapse
 * gold and the accent into the same orange.
 */
const TIERS: Record<Tier, { label: string; text: string; bg: string; border: string; bar: string }> =
  {
    bronze: {
      label: 'Bronze',
      text: 'text-[#8A5A2B]',
      bg: 'bg-[#8A5A2B]/10',
      border: 'border-l-[#8A5A2B]',
      bar: '#8A5A2B',
    },
    silver: {
      label: 'Silver',
      text: 'text-[#6B7280]',
      bg: 'bg-[#6B7280]/10',
      border: 'border-l-[#6B7280]',
      bar: '#6B7280',
    },
    gold: {
      label: 'Gold',
      text: 'text-[#A16207]',
      bg: 'bg-[#A16207]/10',
      border: 'border-l-[#D4A017]',
      bar: '#D4A017',
    },
    platinum: {
      label: 'Platinum',
      text: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-l-primary',
      bar: '#5E60FF',
    },
  }

/** Display names for the seed's category slugs, in tab order. */
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'games', label: 'Volume' },
  { key: 'streak', label: 'Streaks' },
  { key: 'elo', label: 'Rank' },
  { key: 'modes', label: 'Difficulty' },
  { key: 'speed', label: 'Speed' },
  { key: 'daily', label: 'Daily' },
  { key: 'social', label: 'Social' },
  { key: 'meta', label: 'Meta' },
]

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'unlocked', label: 'Unlocked' },
  { key: 'locked', label: 'Locked' },
] as const

const MAX_SHOWCASE = 3

function AchievementCard({
  ach,
  isUnlocked,
  isNew,
  pinned,
  onTogglePin,
}: {
  ach: Achievement
  isUnlocked: boolean
  /** Unlocked since the last visit to this page — gets its own colour and a badge. */
  isNew?: boolean
  pinned: boolean
  onTogglePin?: () => void
}) {
  const tier = TIERS[ach.tier] ?? TIERS.bronze
  const target = ach.progress_target ?? ach.requirement_value
  const current = ach.progress_current ?? 0

  return (
    <Card
      className={`p-4 border-l-4 ${
        isNew
          ? // Accent, not the tier colour: "new" has to be spottable while scanning
            // a grid where every card is already tinted by its tier.
            'border-l-accent bg-accent/10 ring-2 ring-accent/50'
          : isUnlocked
            ? `${tier.border} ${tier.bg}`
            : 'border-l-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative text-3xl leading-none">
          <span className={isUnlocked ? '' : 'grayscale opacity-60'}>{ach.icon}</span>
          {/* A lock badge rather than fading the whole card. Reduced opacity on
              this palette lands around 2.3:1, which is unreadable. */}
          {!isUnlocked && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-surface-muted p-0.5">
              <Lock className="h-2.5 w-2.5 text-muted" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-sm font-semibold leading-snug">{ach.name}</h3>
            {isUnlocked && onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                aria-label={pinned ? `Unpin ${ach.name}` : `Pin ${ach.name} to your profile`}
                title={pinned ? 'Unpin from profile' : 'Pin to profile'}
                className={`shrink-0 rounded-button p-1 transition-colors cursor-pointer ${
                  pinned
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-surface-muted hover:text-deep'
                }`}
              >
                <Pin className="h-3 w-3" />
              </button>
            )}
          </div>

          <p className="mt-0.5 text-xs text-muted">{ach.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isNew && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                New
              </span>
            )}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tier.bg} ${tier.text}`}
            >
              {tier.label}
            </span>
            <span className="font-mono text-[10px] text-muted">{ach.points} pts</span>
            {isUnlocked && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-success">
                <Check className="h-3 w-3" />
                Unlocked
              </span>
            )}
          </div>

          {!isUnlocked && target > 0 && (
            <div className="mt-2">
              <ProgressBar value={(current / target) * 100} height={4} color={tier.bar} />
              <p className="mt-1 font-mono text-[10px] text-muted">
                {current.toLocaleString()} / {target.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function Achievements() {
  const { user } = useAuth()
  const [unlocked, setUnlocked] = useState<Achievement[]>([])
  const [locked, setLocked] = useState<Achievement[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showcase, setShowcase] = useState<string[]>([])
  const [showcaseError, setShowcaseError] = useState<string | null>(null)
  /**
   * Unlocked but never looked at, snapshotted on load.
   *
   * Held in local state on purpose: the load also marks everything seen, so this
   * is the only copy of that list for the rest of the visit. Come back later and
   * the highlight is gone, which is what "new" should mean.
   */
  const [unseen, setUnseen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<(typeof STATUSES)[number]['key']>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) {
        // Signed out: the catalogue is still worth browsing, just with nothing
        // unlocked and no progress to show.
        try {
          const res = await achievementsApi.getAll()
          const all: Achievement[] = res.data.achievements
          setLocked(all.map(a => ({ ...a, progress_current: 0, progress_target: a.requirement_value })))
          setUnlocked([])
          setStats(null)
        } catch (error) {
          console.error(error)
        } finally {
          setLoading(false)
        }
        return
      }

      try {
        const res = await achievementsApi.getMine()
        setUnlocked(res.data.unlocked ?? [])
        setLocked(res.data.locked ?? [])
        setStats(res.data.stats ?? null)
        setShowcase((res.data.showcase ?? []).map((a: Achievement) => a.key))
        setUnseen(new Set<string>(res.data.unseenKeys ?? []))
        // Opening this page is the acknowledgement — clears the "new" panel on Home.
        // Fire and forget: a failure here must not break the list that just loaded.
        achievementsApi.markAllSeen().catch(() => {})
      } catch (error) {
        console.error('Failed to load achievements:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const unlockedKeys = useMemo(() => new Set(unlocked.map(a => a.key)), [unlocked])

  /**
   * One list: new unlocks first, then unlocked, then locked.
   *
   * The server already returns each group in catalogue order and `sort` is
   * stable, so floating the unseen ones to the front leaves every other card
   * exactly where it was.
   */
  const visible = useMemo(() => {
    const all = [...unlocked, ...locked]
    const needle = query.trim().toLowerCase()

    const filtered = all.filter(a => {
      if (category !== 'all' && a.category !== category) return false
      if (status === 'unlocked' && !unlockedKeys.has(a.key)) return false
      if (status === 'locked' && unlockedKeys.has(a.key)) return false
      if (needle && !`${a.name} ${a.description}`.toLowerCase().includes(needle)) return false
      return true
    })

    return filtered.sort((a, b) => Number(unseen.has(b.key)) - Number(unseen.has(a.key)))
  }, [unlocked, locked, category, status, query, unlockedKeys, unseen])

  /** Counts per tab, so a tab that would be empty says so before you tap it. */
  const counts = useMemo(() => {
    const all = [...unlocked, ...locked]
    const map: Record<string, number> = { all: all.length }
    for (const a of all) map[a.category] = (map[a.category] ?? 0) + 1
    return map
  }, [unlocked, locked])

  const togglePin = async (key: string) => {
    const next = showcase.includes(key)
      ? showcase.filter(k => k !== key)
      : [...showcase, key].slice(0, MAX_SHOWCASE)

    if (!showcase.includes(key) && showcase.length >= MAX_SHOWCASE) {
      setShowcaseError(`You can pin ${MAX_SHOWCASE} — unpin one first.`)
      return
    }

    // Optimistic, with a rollback: pinning is a one-tap action and waiting for a
    // round trip before the pin fills in makes it feel broken.
    const previous = showcase
    setShowcase(next)
    setShowcaseError(null)
    try {
      await achievementsApi.setShowcase(next)
    } catch {
      setShowcase(previous)
      setShowcaseError('Could not save your showcase.')
    }
  }

  const pointsPercent = stats?.totalPoints ? (stats.points / stats.totalPoints) * 100 : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text font-heading text-4xl font-bold text-transparent">
          Achievements
        </h1>
        {stats ? (
          <div className="mx-auto mt-3 max-w-sm">
            <p className="text-sm text-muted">
              <span className="font-mono font-semibold text-deep">{stats.total}</span> of{' '}
              {stats.totalPossible} unlocked ·{' '}
              <span className="font-mono font-semibold text-deep">
                {stats.points.toLocaleString()}
              </span>{' '}
              / {stats.totalPoints.toLocaleString()} pts
            </p>
            <ProgressBar value={pointsPercent} height={6} className="mt-2" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Sign in to track your progress.</p>
        )}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {unseen.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2 rounded-card border-l-4 border-l-accent bg-accent/10 p-3"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <p className="text-xs text-deep">
                <span className="font-semibold">
                  {unseen.size} new {unseen.size === 1 ? 'achievement' : 'achievements'}
                </span>{' '}
                since you last looked — listed first
              </p>
            </motion.div>
          )}

          {user && (
            <div className="mb-4 flex flex-col gap-2 rounded-card border border-border bg-surface-alt p-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Pin up to {MAX_SHOWCASE} to show on your profile
                <span className="font-mono">
                  ({showcase.length}/{MAX_SHOWCASE})
                </span>
              </p>
              {showcaseError && (
                <p className="flex items-center gap-1 text-xs text-accent sm:ml-auto">
                  {showcaseError}
                  <button
                    type="button"
                    onClick={() => setShowcaseError(null)}
                    aria-label="Dismiss"
                    className="rounded-button p-0.5 hover:bg-surface-muted cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Controls. The search field is 16px on a phone so iOS Safari does not
              zoom the page when it gets focus. */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search achievements…"
                  aria-label="Search achievements"
                  className="w-full rounded-button border border-border bg-surface py-2 pl-9 pr-3 text-[16px] focus:outline-none focus:shadow-glow-primary sm:text-sm"
                />
              </label>

              {user && (
                <div className="flex shrink-0 gap-1 rounded-button bg-surface-alt p-1">
                  {STATUSES.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStatus(s.key)}
                      className={`flex-1 rounded-button px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        status === s.key
                          ? 'bg-surface text-deep shadow-card'
                          : 'text-muted hover:text-deep'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Horizontal scroll rather than wrapping: ten tabs wrapped to three
                rows on a phone pushes the list itself below the fold. */}
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {CATEGORIES.filter(c => counts[c.key] > 0 || c.key === 'all').map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`shrink-0 rounded-button px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    category === c.key
                      ? 'bg-primary text-white'
                      : 'bg-surface-alt text-muted hover:bg-surface-muted hover:text-deep'
                  }`}
                >
                  {c.label}
                  <span className="ml-1.5 font-mono opacity-70">{counts[c.key] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="text-sm text-muted">Nothing matches that.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map(ach => {
                const isUnlocked = unlockedKeys.has(ach.key)
                return (
                  <AchievementCard
                    key={ach.key}
                    ach={ach}
                    isUnlocked={isUnlocked}
                    isNew={unseen.has(ach.key)}
                    pinned={showcase.includes(ach.key)}
                    onTogglePin={user && isUnlocked ? () => togglePin(ach.key) : undefined}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
