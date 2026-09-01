import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { soundService } from '../../services/soundService'
import type { Achievement } from '../../types'

/**
 * Tiers, mirrored from the achievements page.
 *
 * Solid hex rather than theme tokens for the same reason as there: bronze →
 * platinum is a scale of its own, and folding it into the palette would collapse
 * gold and the accent into one orange.
 */
const TIERS: Record<string, { label: string; text: string; bg: string }> = {
  bronze: { label: 'Bronze', text: 'text-[#8A5A2B]', bg: 'bg-[#8A5A2B]/10' },
  silver: { label: 'Silver', text: 'text-[#6B7280]', bg: 'bg-[#6B7280]/10' },
  gold: { label: 'Gold', text: 'text-[#A16207]', bg: 'bg-[#A16207]/10' },
  platinum: { label: 'Platinum', text: 'text-primary', bg: 'bg-primary/10' },
}

/** Server rows carry tier and points; the shared type predates both. */
type UnlockedAchievement = Achievement & { tier?: string; points?: number }

interface AchievementUnlockModalProps {
  /** Whatever the last submission unlocked. Empty or undefined shows nothing. */
  achievements?: UnlockedAchievement[]
}

/**
 * Celebrates achievements the moment they are earned, over the result screen.
 *
 * Owns its own open state, keyed on the set of achievements it was handed, so a
 * caller only has to pass the array it already has from the submission response.
 * Dismissing it is final for that batch — the next unlock opens it again.
 *
 * Deliberately does *not* mark anything as seen: the achievements page still
 * needs to know these are new so it can float them to the top.
 */
export function AchievementUnlockModal({ achievements }: AchievementUnlockModalProps) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<UnlockedAchievement[]>([])

  // The identity of a batch, so re-renders don't reopen a dismissed modal but a
  // genuinely new unlock does.
  const batch = (achievements ?? []).map(a => a.key).join(',')

  useEffect(() => {
    if (!batch) return
    setShown(achievements ?? [])
    setOpen(true)
    soundService.playAchievementUnlock()
  }, [batch]) // eslint-disable-line react-hooks/exhaustive-deps

  if (shown.length === 0) return null

  const plural = shown.length === 1 ? 'Achievement' : `${shown.length} achievements`

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={`${plural} unlocked!`}
      subtitle="Nice — here is what you just earned."
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" fullWidth onClick={() => setOpen(false)}>
            Keep playing
          </Button>
          <Link to="/achievements" className="flex-1">
            <Button fullWidth onClick={() => setOpen(false)}>
              View all
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-2">
        {shown.map((ach, i) => {
          const tier = TIERS[ach.tier ?? 'bronze'] ?? TIERS.bronze
          return (
            <motion.div
              key={ach.key}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              // Staggered so a batch of five reads as five things, not one block.
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
              className="flex items-start gap-3 rounded-card border border-border bg-surface-alt p-3"
            >
              <span className="text-3xl leading-none" aria-hidden>
                {ach.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-sm font-semibold leading-snug text-deep">
                  {ach.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{ach.description}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tier.bg} ${tier.text}`}
                  >
                    {tier.label}
                  </span>
                  {ach.points != null && (
                    <span className="font-mono text-[10px] text-muted">+{ach.points} pts</span>
                  )}
                </div>
              </div>
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            </motion.div>
          )
        })}
      </div>
    </Modal>
  )
}
