import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Eye, Play, Hash, Users, Save } from 'lucide-react'
import { Button } from '../ui/Button'
import type { RoomConfig } from '../../types/multiplayer'
import type { Difficulty } from '../../types'

interface RoomSetupProps {
  /** Emits the exact config the server expects — no lossy mapping in between. */
  onCreate: (config: RoomConfig) => void
  loading?: boolean
  disabled?: boolean
  /**
   * Seed the controls with an existing room's settings — this is what turns the
   * form into an editor for the host. Read once on mount, which is safe because
   * the modal that hosts it unmounts on close.
   */
  initialConfig?: RoomConfig
  /**
   * Players already in the room. Capacity can't be set below this, so the
   * choices underneath it are disabled rather than rejected by the server.
   */
  minPlayers?: number
  title?: string | null
  submitLabel?: string
  /** Adds a Cancel button beside submit. */
  onCancel?: () => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']

/** Room capacity choices. Must stay inside the server's MIN/MAX_PLAYERS bounds. */
const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8]

export function RoomSetup({
  onCreate,
  loading,
  disabled,
  initialConfig,
  minPlayers = 2,
  title = 'Create Room',
  submitLabel = 'Create Room',
  onCancel,
}: RoomSetupProps) {
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(initialConfig?.roundTimeSeconds ?? 20)
  const [colorTimeSeconds, setColorTimeSeconds] = useState(initialConfig?.colorTimeSeconds ?? 3)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialConfig?.difficulty ?? 'medium')
  const [maxPlayers, setMaxPlayers] = useState(
    Math.max(initialConfig?.maxPlayers ?? 4, minPlayers)
  )
  const [roundsEnabled, setRoundsEnabled] = useState(initialConfig?.specificRounds != null)
  const [roundsValue, setRoundsValue] = useState(initialConfig?.specificRounds ?? 5)

  const handleSubmit = () => {
    onCreate({
      roundTimeSeconds,
      colorTimeSeconds,
      difficulty,
      maxPlayers,
      specificRounds: roundsEnabled ? roundsValue : null,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* null when the surrounding dialog already supplies a heading. */}
      {title && <h3 className="font-heading text-xl font-semibold text-center">{title}</h3>}

      {/* Difficulty */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden>🎮</span>
          <span>Difficulty</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIFFICULTIES.map((diff) => (
            <button
              key={diff}
              type="button"
              aria-pressed={difficulty === diff}
              onClick={() => setDifficulty(diff)}
              className={`px-2 py-2 text-xs rounded-button capitalize transition-all ${
                difficulty === diff
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'bg-surface-alt text-muted hover:text-deep'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Max players */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users className="w-4 h-4" />
          <span>Max Players</span>
          <span className="ml-auto text-sm font-mono font-medium text-deep">{maxPlayers}</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {PLAYER_COUNTS.map((count) => {
            const tooFew = count < minPlayers
            return (
              <button
                key={count}
                type="button"
                aria-pressed={maxPlayers === count}
                aria-label={`${count} players`}
                title={tooFew ? `${minPlayers} players are already in the room` : undefined}
                disabled={tooFew}
                onClick={() => setMaxPlayers(count)}
                className={`px-2 py-2 text-xs font-mono rounded-button transition-all ${
                  maxPlayers === count
                    ? 'bg-primary text-white shadow-glow-primary'
                    : tooFew
                      ? 'bg-surface-alt text-muted cursor-not-allowed line-through'
                      : 'bg-surface-alt text-muted hover:text-deep'
                }`}
              >
                {count}
              </button>
            )
          })}
        </div>
      </div>

      {/* Round duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock className="w-4 h-4" />
            <span>Round Duration</span>
          </div>
          <span className="text-sm font-mono font-medium">{roundTimeSeconds}s</span>
        </div>
        <input
          title="Round Duration"
          type="range"
          min={10}
          max={40}
          value={roundTimeSeconds}
          onChange={(e) => setRoundTimeSeconds(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>10s</span>
          <span>40s</span>
        </div>
      </div>

      {/* Color visibility */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Eye className="w-4 h-4" />
            <span>Color Visibility</span>
          </div>
          <span className="text-sm font-mono font-medium">{colorTimeSeconds}s</span>
        </div>
        <input
          title="Color Visibility Duration"
          type="range"
          min={0.5}
          max={7}
          step={0.5}
          value={colorTimeSeconds}
          onChange={(e) => setColorTimeSeconds(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>0.5s</span>
          <span>7s</span>
        </div>
      </div>

      {/* Specific rounds */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Hash className="w-4 h-4" />
            <span>Specific Rounds</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={roundsEnabled}
            aria-label="Limit the game to a set number of rounds"
            onClick={() => setRoundsEnabled((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              roundsEnabled ? 'bg-primary' : 'bg-surface-alt border border-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                roundsEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {roundsEnabled ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Rounds</span>
              <span className="text-sm font-mono font-medium">{roundsValue}</span>
            </div>
            <input
              title="Number of Rounds"
              type="range"
              min={1}
              max={50}
              value={roundsValue}
              onChange={(e) => setRoundsValue(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>1</span>
              <span>50</span>
            </div>
          </motion.div>
        ) : (
          <p className="text-xs text-muted">Unlimited rounds — play until the host ends the session</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onCancel && (
          <Button variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button
          fullWidth
          onClick={handleSubmit}
          loading={loading}
          disabled={disabled}
          icon={initialConfig ? <Save className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        >
          {submitLabel}
        </Button>
      </div>
    </motion.div>
  )
}
