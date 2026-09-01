import { useState, type ReactNode } from 'react'
import { Clock, Eye, Hash, Settings2, Shuffle, Skull, Sliders, Swords, Users } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { RoomSetup } from './RoomSetup'
import type { RoomConfig } from '../../types/multiplayer'

interface RoomSettingsProps {
  config: RoomConfig
  /** True for the host in the lobby — everyone else just reads the values. */
  canEdit?: boolean
  /** Players in the room right now; capacity can't be set below this. */
  playerCount: number
  onSave: (config: RoomConfig) => void
  /** Offline / reconnecting: show the settings, but don't let them be changed. */
  disabled?: boolean
}

/** Short enough to sit in the header banner; the form carries the long version. */
const SCORING_LABEL: Record<RoomConfig['mode'], { name: string; hint: string }> = {
  duel: { name: 'Point mode', hint: 'A point a round to the closest guess' },
  challenge: { name: 'Percentage mode', hint: 'Ranked on average accuracy' },
}

/**
 * The room's rules, shown in the lobby so joiners know what they're in for, and
 * editable in place by the host.
 *
 * Editing exists because the settings are chosen before anyone else has arrived:
 * getting the difficulty or the round count wrong used to mean closing the room
 * and making everybody rejoin a new code.
 *
 * Laid out in three tiers rather than eight equal chips: scoring first, because
 * it decides what winning means; then the numbers everyone wants to check; then
 * the optional rules, and only the ones actually switched on — two chips reading
 * "0 / 0 / 0" and "Off" were taking up a third of the card to say nothing.
 */
export function RoomSettings({
  config,
  canEdit = false,
  playerCount,
  onSave,
  disabled = false,
}: RoomSettingsProps) {
  const [editing, setEditing] = useState(false)

  const scoring = SCORING_LABEL[config.mode] ?? SCORING_LABEL.challenge

  const facts = [
    { icon: <Sliders className="w-3.5 h-3.5" />, label: 'Difficulty', value: config.difficulty },
    { icon: <Users className="w-3.5 h-3.5" />, label: 'Max players', value: `${config.maxPlayers}` },
    {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Round time',
      value: `${config.roundTimeSeconds}s`,
    },
    {
      icon: <Eye className="w-3.5 h-3.5" />,
      label: 'Colour shown',
      value: `${config.colorTimeSeconds}s`,
    },
    {
      icon: <Hash className="w-3.5 h-3.5" />,
      label: 'Rounds',
      // Elimination decides the count from the player count, so there is no
      // number to show until the game starts.
      value: config.elimination
        ? 'Until one left'
        : config.specificRounds === null
          ? 'Unlimited'
          : `${config.specificRounds}`,
    },
  ]

  // Only what is on. Elimination is never on in point mode — the server forces it
  // off — so nothing about it is shown there at all.
  const rules: { icon: ReactNode; label: string }[] = []
  if (config.sliderShuffle) {
    rules.push({ icon: <Shuffle className="w-3.5 h-3.5" />, label: 'Slider shuffle' })
  }
  if (config.elimination) {
    rules.push({
      icon: <Skull className="w-3.5 h-3.5" />,
      label: `Elimination every ${config.elimEveryRounds}`,
    })
  }

  const handleSave = (next: RoomConfig) => {
    onSave(next)
    setEditing(false)
  }

  return (
    <>
      <div className="rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted" />
          <h3 className="font-heading text-sm font-semibold text-deep">Room settings</h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={disabled}
              className="ml-auto rounded-button px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-primary/10 px-3 py-2.5">
          <Swords className="w-4 h-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold text-deep">{scoring.name}</p>
            <p className="text-[11px] text-muted">{scoring.hint}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {facts.map(fact => (
            <div key={fact.label} className="rounded-xl bg-surface-alt px-2.5 py-2">
              <dt className="flex items-center gap-1.5 text-[11px] text-muted">
                {fact.icon}
                {fact.label}
              </dt>
              <dd className="mt-0.5 font-heading text-sm font-semibold capitalize text-deep">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {rules.length > 0 ? (
            rules.map(rule => (
              <span
                key={rule.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {rule.icon}
                {rule.label}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-muted">
              Standard rules — sliders start at 0 / 0 / 0 and nobody is knocked out
            </span>
          )}
        </div>

        {canEdit && (
          <p className="mt-3 text-[11px] text-muted">You can change these until the game starts.</p>
        )}
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Room settings"
        subtitle="Changes apply to everyone in the room straight away."
        size="md"
      >
        {/* Mounted only while open, so the form always seeds from the live config. */}
        <RoomSetup
          initialConfig={config}
          minPlayers={playerCount}
          title={null}
          submitLabel="Save settings"
          onCreate={handleSave}
          onCancel={() => setEditing(false)}
          disabled={disabled}
        />
      </Modal>
    </>
  )
}
