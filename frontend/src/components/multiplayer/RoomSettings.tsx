import { useState } from 'react'
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

/**
 * The room's rules, shown in the lobby so joiners know what they're in for, and
 * editable in place by the host.
 *
 * Editing exists because the settings are chosen before anyone else has arrived:
 * getting the difficulty or the round count wrong used to mean closing the room
 * and making everybody rejoin a new code.
 */
export function RoomSettings({
  config,
  canEdit = false,
  playerCount,
  onSave,
  disabled = false,
}: RoomSettingsProps) {
  const [editing, setEditing] = useState(false)

  const rows = [
    {
      icon: <Swords className="w-3.5 h-3.5" />,
      label: 'Mode',
      value: config.mode === 'duel' ? 'Duel' : 'Challenge',
    },
    { icon: <Sliders className="w-3.5 h-3.5" />, label: 'Difficulty', value: config.difficulty },
    { icon: <Users className="w-3.5 h-3.5" />, label: 'Max players', value: `${config.maxPlayers}` },
    { icon: <Clock className="w-3.5 h-3.5" />, label: 'Round time', value: `${config.roundTimeSeconds}s` },
    { icon: <Eye className="w-3.5 h-3.5" />, label: 'Colour shown', value: `${config.colorTimeSeconds}s` },
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
    {
      icon: <Shuffle className="w-3.5 h-3.5" />,
      label: 'Slider start',
      value: config.sliderShuffle ? 'Shuffled' : '0 / 0 / 0',
    },
    {
      icon: <Skull className="w-3.5 h-3.5" />,
      label: 'Elimination',
      value: config.elimination ? `Every ${config.elimEveryRounds}` : 'Off',
    },
  ]

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
              className="ml-auto rounded-button px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rows.map(row => (
            <div key={row.label} className="rounded-xl bg-surface-alt px-2.5 py-2">
              <dt className="flex items-center gap-1.5 text-[11px] text-muted">
                {row.icon}
                {row.label}
              </dt>
              <dd className="mt-0.5 font-heading text-sm font-semibold capitalize text-deep">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        {canEdit && (
          <p className="mt-3 text-[11px] text-muted">
            You can change these until the game starts.
          </p>
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
