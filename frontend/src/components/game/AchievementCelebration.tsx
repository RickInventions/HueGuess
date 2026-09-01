import { useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, Trophy } from 'lucide-react'
import { soundService } from '../../services/soundService'
import type { Achievement } from '../../types'

/**
 * Tiers, mirrored from the achievements page.
 *
 * Solid hex rather than theme tokens for the same reason as there: bronze →
 * platinum is a scale of its own, and folding it into the palette would collapse
 * gold and the accent into one orange. `glow` is the lighter partner used for
 * washes and halos — the base hex at low alpha goes muddy rather than bright.
 */
const TIERS: Record<string, { label: string; hex: string; glow: string }> = {
  bronze: { label: 'Bronze', hex: '#8A5A2B', glow: '#D8A46A' },
  silver: { label: 'Silver', hex: '#6B7280', glow: '#B6BCC6' },
  gold: { label: 'Gold', hex: '#A16207', glow: '#F0C24B' },
  platinum: { label: 'Platinum', hex: '#5E60FF', glow: '#A5A6FF' },
}

/**
 * Category slugs → the labels the achievements page puts on its tabs.
 *
 * Shown as a chip because most unlocks are earned *by* something specific — a
 * hard round, a streak, a daily — and the name alone ("Hard Mode Ace") doesn't
 * always say which. Unknown slugs render no chip rather than a raw slug.
 */
const CATEGORY_LABEL: Record<string, string> = {
  accuracy: 'Accuracy',
  games: 'Volume',
  streak: 'Streaks',
  elo: 'Rank',
  modes: 'Difficulty',
  speed: 'Speed',
  daily: 'Daily',
  social: 'Social',
  meta: 'Meta',
}

/** Server rows carry tier and points; the shared type predates both. */
type UnlockedAchievement = Achievement & { tier?: string; points?: number }

const tierOf = (ach: UnlockedAchievement) => TIERS[ach.tier ?? 'bronze'] ?? TIERS.bronze

const CONFETTI_COLORS = ['#5E60FF', '#FF7A59', '#1FC98E', '#F0C24B', '#FF5FA2']
const CONFETTI_COUNT = 24

interface ConfettiPiece {
  /** Percent across the card. */
  left: number
  size: number
  /** Sideways travel, so the fall isn't a set of parallel lines. */
  drift: number
  spin: number
  delay: number
  duration: number
  color: string
  circle: boolean
}

/**
 * A one-off burst of paper.
 *
 * Spread evenly across the width with a jitter rather than picked at random:
 * two dozen purely random positions clump, leaving bald patches that read as a
 * rendering bug. Hand-rolled because it is ~15 lines of framer-motion and the
 * alternative is a canvas library in the bundle for one card.
 */
function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    left: Math.min(97, Math.max(1, (i / count) * 100 + (Math.random() * 9 - 4.5))),
    size: 6 + Math.random() * 6,
    drift: Math.random() * 80 - 40,
    spin: Math.random() * 540 - 270,
    delay: Math.random() * 0.5,
    duration: 1.6 + Math.random() * 1.2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    circle: i % 3 === 0,
  }))
}

interface AchievementCelebrationProps {
  /** Whatever the last submission unlocked. Empty or undefined renders nothing. */
  achievements?: UnlockedAchievement[]
}

/**
 * The unlock celebration, in the result page itself.
 *
 * Deliberately part of the page rather than a dialog over it: a modal has to be
 * dismissed before you can see the score you just earned, and dismissing it is
 * also how you lose the only place the achievement was ever named. Here it
 * arrives with the result, bursts once, and then simply stays there.
 *
 * A single unlock gets the full hero treatment (medallion, name, the lot); a
 * batch gets a headline and a stacked list, because five heroes in a column is
 * just a list with too much padding.
 *
 * Deliberately does *not* mark anything as seen: the achievements page still
 * needs to know these are new so it can float them to the top.
 */
export function AchievementCelebration({ achievements }: AchievementCelebrationProps) {
  const reduceMotion = useReducedMotion()
  const list = achievements ?? []

  // The identity of the batch, so the fanfare fires once per unlock rather than
  // on every re-render of the result page.
  const batch = list.map(a => a.key).join(',')

  useEffect(() => {
    if (!batch) return
    soundService.playAchievementUnlock()
  }, [batch])

  // Keyed on the batch so the paper doesn't re-randomise on every render — a
  // re-render mid-fall (the accuracy count-up ticks every frame) would otherwise
  // restart the whole burst.
  const confetti = useMemo(() => makeConfetti(CONFETTI_COUNT), [batch])

  if (list.length === 0) return null

  const single = list.length === 1 ? list[0] : null
  // The wash takes its colour from the first thing in the batch.
  const lead = tierOf(list[0])
  const totalPoints = list.reduce((sum, a) => sum + (a.points ?? 0), 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      // overflow-hidden keeps the paper inside the card, so a burst can't widen
      // the page or leave stray pixels on the layout.
      className="relative overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          // Ends on the page colour at zero alpha, not `transparent`: Safari
          // interpolates `transparent` through black and greys out the fade.
          background: `radial-gradient(130% 88% at 50% 0%, ${lead.glow}5C 0%, ${lead.glow}22 44%, rgba(255,253,248,0) 80%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: 'linear-gradient(90deg, #5E60FF, #FF7A59, #F0C24B, #1FC98E)' }}
      />

      {!reduceMotion && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {confetti.map((piece, i) => (
            <motion.span
              key={i}
              className="absolute top-0 block"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.circle ? piece.size : piece.size * 0.5,
                backgroundColor: piece.color,
                borderRadius: piece.circle ? 9999 : 2,
              }}
              initial={{ opacity: 0, y: -30, x: 0, rotate: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: 420, x: piece.drift, rotate: piece.spin }}
              transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
            />
          ))}
        </div>
      )}

      <div className="relative px-5 py-6 text-center sm:px-6 sm:py-7">
        {single ? (
          <>
            <p
              className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: lead.hex }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Achievement unlocked
            </p>

            <div className="relative mx-auto mt-4 h-24 w-24">
              {!reduceMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full blur-md"
                  style={{ backgroundColor: lead.glow }}
                  animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.08, 0.5] }}
                  // Three pulses, then it settles — this card sits on screen
                  // until you start the next round.
                  transition={{ duration: 2.4, repeat: 2, ease: 'easeInOut' }}
                />
              )}
              <motion.div
                initial={{ scale: 0.4, rotate: -14 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.1 }}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-surface text-5xl leading-none"
                style={{
                  border: `4px solid ${lead.hex}`,
                  boxShadow: `0 0 0 7px ${lead.glow}33, 0 14px 34px ${lead.hex}40`,
                }}
              >
                <span aria-hidden>{single.icon}</span>
              </motion.div>
            </div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-5 bg-clip-text font-heading text-2xl font-bold leading-tight text-transparent sm:text-3xl"
              style={{ backgroundImage: `linear-gradient(100deg, ${lead.hex}, #FF7A59)` }}
            >
              {single.name}
            </motion.h3>

            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{single.description}</p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: `${lead.hex}1F`, color: lead.hex }}
              >
                {lead.label}
              </span>
              {single.points != null && (
                <span className="rounded-full bg-success/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-success">
                  +{single.points} pts
                </span>
              )}
              {CATEGORY_LABEL[single.category] && (
                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-deep">
                  {CATEGORY_LABEL[single.category]}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.5, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface"
              style={{
                border: `4px solid ${lead.hex}`,
                boxShadow: `0 0 0 7px ${lead.glow}33, 0 14px 34px ${lead.hex}40`,
              }}
            >
              <Trophy className="h-7 w-7" style={{ color: lead.hex }} />
            </motion.div>

            <h3
              className="mt-4 bg-clip-text font-heading text-2xl font-bold leading-tight text-transparent"
              style={{ backgroundImage: `linear-gradient(100deg, ${lead.hex}, #FF7A59)` }}
            >
              {list.length} achievements unlocked!
            </h3>
            <p className="mt-1 text-sm text-muted">
              {totalPoints > 0 ? (
                <>
                  That is <span className="font-mono font-semibold text-success">+{totalPoints}</span>{' '}
                  points in one go
                </>
              ) : (
                'All at once — here is what you earned'
              )}
            </p>

            <ul className="mt-5 space-y-2 text-left">
              {list.map((ach, i) => {
                const tier = tierOf(ach)
                return (
                  <motion.li
                    key={ach.key}
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    // Staggered so a batch of five reads as five things, not one block.
                    transition={{
                      delay: 0.14 + i * 0.09,
                      type: 'spring',
                      stiffness: 300,
                      damping: 24,
                    }}
                    className="flex items-start gap-3 rounded-card bg-surface p-3 shadow-card"
                    style={{ border: `1px solid ${tier.hex}33` }}
                  >
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none"
                      style={{
                        backgroundColor: `${tier.hex}1F`,
                        boxShadow: `inset 0 0 0 1.5px ${tier.hex}59`,
                      }}
                    >
                      {ach.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-heading text-sm font-semibold leading-snug text-deep">
                        {ach.name}
                      </h4>
                      <p className="mt-0.5 text-xs text-muted">{ach.description}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${tier.hex}1F`, color: tier.hex }}
                        >
                          {tier.label}
                        </span>
                        {ach.points != null && (
                          <span className="font-mono text-[10px] font-semibold text-success">
                            +{ach.points} pts
                          </span>
                        )}
                        {CATEGORY_LABEL[ach.category] && (
                          <span className="text-[10px] text-muted">
                            {CATEGORY_LABEL[ach.category]}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </ul>
          </>
        )}

        <Link
          to="/achievements"
          className="mt-5 inline-flex items-center gap-1 rounded-button px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          See all achievements
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.section>
  )
}
