import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Clock, Eye, Play, Hash, Users, Save, Shuffle, Skull, Swords, Sliders } from 'lucide-react'
import { Button } from '../ui/Button'
import type { RoomConfig, RoomMode } from '../../types/multiplayer'
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

/**
 * The two ways a Challenge room can score.
 *
 * Point mode is what briefly had its own lobby entry as "Duel". The wire value
 * is still `duel`, because the server scores off `config.mode` and nothing about
 * moving the choice into this form changes how it scores.
 */
const SCORING: { mode: RoomMode; label: string; hint: string }[] = [
  { mode: 'duel', label: 'Point mode', hint: 'A point a round' },
  { mode: 'challenge', label: 'Percentage mode', hint: 'Average accuracy' },
]

const SCORING_BLURB: Record<RoomMode, string> = {
  duel: 'One point a round to the closest guess — most points takes it, like 3–1',
  challenge: 'Ranked on average accuracy across every round',
}

/** Room capacity choices. Must stay inside the server's MIN/MAX_PLAYERS bounds. */
const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8]

/** Elimination cadence choices. Must match MIN/MAX_ELIM_EVERY on the server. */
const ELIM_CADENCES = [1, 2, 3, 4, 5]

/**
 * A captioned group of settings.
 *
 * Eight controls in one flat column all looked equally important, so the scoring
 * choice — which changes what the rest of them mean — read like just another row.
 * The captions and rules split it into scoring, the match, timing and the
 * optional rules.
 */
function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={first ? 'space-y-3' : 'space-y-3 border-t border-muted/20 pt-4'}>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h4>
      {children}
    </section>
  )
}

/** One control: icon, name, and the value it currently sits at, pinned right. */
function Field({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode
  label: string
  value?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted">{icon}</span>
        <span className="text-sm text-deep">{label}</span>
        {value !== undefined && (
          <span className="ml-auto font-mono text-sm font-semibold capitalize text-deep">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/** Shared look for the segmented choices — difficulty, capacity, cadence. */
function Segment({
  active,
  disabled,
  onClick,
  label,
  ariaLabel,
  title,
  mono,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  ariaLabel?: string
  title?: string
  mono?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-button px-2 py-2 text-xs capitalize transition-all ${
        mono ? 'font-mono' : ''
      } ${
        active
          ? 'bg-primary text-white shadow-glow-primary'
          : disabled
            ? 'cursor-not-allowed bg-surface-muted text-muted line-through'
            : 'cursor-pointer bg-surface-alt text-muted hover:text-deep'
      }`}
    >
      {label}
    </button>
  )
}

/** The switch itself. Not interactive — ToggleRow owns the button around it. */
function Switch({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-5 w-10 shrink-0 rounded-full transition-colors ${
        disabled
          ? 'border border-border bg-surface-muted'
          : checked
            ? 'bg-primary'
            : 'border border-border bg-surface-alt'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </span>
  )
}

/**
 * A rule you switch on or off, as a whole tappable card.
 *
 * The 40×20 switch used to be the only target, with the explanation as loose text
 * underneath it — on a phone that is a hard thing to hit and an easy thing to
 * miss. The card carries the state in its border too, so which rules are on is
 * legible without reading the switches.
 */
function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
  children?: ReactNode
}) {
  const on = checked && !disabled
  return (
    <div
      className={`rounded-card border p-3 transition-colors ${
        on ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface-alt'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`flex w-full items-center gap-3 text-left ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className={on ? 'text-primary' : 'text-muted'}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-deep">{title}</span>
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        </span>
        <Switch checked={checked} disabled={disabled} />
      </button>
      {children}
    </div>
  )
}

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
  const [sliderShuffle, setSliderShuffle] = useState(initialConfig?.sliderShuffle ?? false)
  const [elimination, setElimination] = useState(initialConfig?.elimination ?? false)
  const [elimEveryRounds, setElimEveryRounds] = useState(initialConfig?.elimEveryRounds ?? 2)

  // Percentage is the original Challenge scoring, so it stays the default for a
  // new room. Editable in the lobby too: the server refuses a config change once
  // round one has been played, which is exactly when re-scoring would be unfair.
  const [roomMode, setRoomMode] = useState<RoomMode>(initialConfig?.mode ?? 'challenge')

  /**
   * Elimination only exists in percentage mode.
   *
   * Point mode scores in whole points, so early on most of the room is tied and
   * the player knocked out would come down to the tiebreak rather than the score
   * on screen. Derived rather than reset on mode change so switching to point
   * mode and back doesn't silently lose the cadence you picked; the server
   * applies the same rule to whatever it is sent.
   */
  const elimAvailable = roomMode !== 'duel'
  const elimOn = elimination && elimAvailable

  const handleSubmit = () => {
    onCreate({
      roundTimeSeconds,
      colorTimeSeconds,
      difficulty,
      maxPlayers,
      // Elimination derives the round count from the player count, so the two
      // settings can't coexist. The server enforces this as well.
      specificRounds: elimOn ? null : roundsEnabled ? roundsValue : null,
      mode: roomMode,
      sliderShuffle,
      elimination: elimOn,
      elimEveryRounds,
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* null when the surrounding dialog already supplies a heading. */}
      {title && <h3 className="font-heading text-xl font-semibold text-center">{title}</h3>}

      {/* How this room scores. It changes what every setting below means, which
          is why it sits at the top on its own. */}
      <Section title="Scoring" first>
        <div className="grid grid-cols-2 gap-2">
          {SCORING.map(option => {
            const active = roomMode === option.mode
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={active}
                onClick={() => setRoomMode(option.mode)}
                className={`flex items-start gap-2 rounded-button px-3 py-2.5 text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-primary text-white shadow-glow-primary'
                    : 'bg-surface-alt text-muted hover:text-deep'
                }`}
              >
                <Swords className={`mt-0.5 h-4 w-4 shrink-0 ${active ? '' : 'text-muted'}`} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className={`block text-[11px] ${active ? 'text-white/85' : 'text-muted'}`}>
                    {option.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted">{SCORING_BLURB[roomMode]}</p>
      </Section>

      <Section title="Match">
        <Field icon={<Sliders className="w-4 h-4" />} label="Difficulty" value={difficulty}>
          {/* Two-up on a phone: "extreme" at four across overflows a modal on a
              320px screen. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DIFFICULTIES.map(diff => (
              <Segment
                key={diff}
                active={difficulty === diff}
                onClick={() => setDifficulty(diff)}
                label={diff}
              />
            ))}
          </div>
        </Field>

        <Field icon={<Users className="w-4 h-4" />} label="Max players" value={`${maxPlayers}`}>
          <div className="grid grid-cols-7 gap-1.5">
            {PLAYER_COUNTS.map(count => {
              const tooFew = count < minPlayers
              return (
                <Segment
                  key={count}
                  mono
                  active={maxPlayers === count}
                  disabled={tooFew}
                  onClick={() => setMaxPlayers(count)}
                  label={`${count}`}
                  ariaLabel={`${count} players`}
                  title={tooFew ? `${minPlayers} players are already in the room` : undefined}
                />
              )
            })}
          </div>
        </Field>
      </Section>

      <Section title="Timing">
        <Field icon={<Clock className="w-4 h-4" />} label="Round time" value={`${roundTimeSeconds}s`}>
          <input
            title="Round Duration"
            type="range"
            min={10}
            max={40}
            value={roundTimeSeconds}
            onChange={e => setRoundTimeSeconds(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-muted">
            <span>10s</span>
            <span>40s</span>
          </div>
        </Field>

        <Field
          icon={<Eye className="w-4 h-4" />}
          label="Colour shown for"
          value={`${colorTimeSeconds}s`}
        >
          <input
            title="Color Visibility Duration"
            type="range"
            min={0.5}
            max={7}
            step={0.5}
            value={colorTimeSeconds}
            onChange={e => setColorTimeSeconds(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-muted">
            <span>0.5s</span>
            <span>7s</span>
          </div>
        </Field>
      </Section>

      <Section title="Rules">
        <ToggleRow
          icon={<Shuffle className="w-4 h-4" />}
          title="Slider shuffle"
          description={
            sliderShuffle
              ? 'Sliders start somewhere random — the same place for everyone'
              : 'Sliders start at 0 / 0 / 0 every round'
          }
          checked={sliderShuffle}
          onChange={() => setSliderShuffle(v => !v)}
        />

        {elimAvailable ? (
          <ToggleRow
            icon={<Skull className="w-4 h-4" />}
            title="Elimination"
            description={
              elimOn
                ? 'Last place drops out and watches as a spectator'
                : 'Nobody is knocked out — everyone plays every round'
            }
            checked={elimination}
            onChange={() => setElimination(v => !v)}
          >
            {elimOn && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 space-y-2 overflow-hidden border-t border-primary/20 pt-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Eliminate every</span>
                  <span className="font-mono text-sm font-semibold text-deep">
                    {elimEveryRounds} {elimEveryRounds === 1 ? 'round' : 'rounds'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {ELIM_CADENCES.map(cadence => (
                    <Segment
                      key={cadence}
                      mono
                      active={elimEveryRounds === cadence}
                      onClick={() => setElimEveryRounds(cadence)}
                      label={`${cadence}`}
                      ariaLabel={`Eliminate every ${cadence} rounds`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted">
                  The lowest overall average goes out, not whoever had one bad round. Runs
                  (players − 1) × {elimEveryRounds} rounds, ending on the last elimination.
                </p>
              </motion.div>
            )}
          </ToggleRow>
        ) : (
          <p className="flex items-start gap-2 rounded-card border border-border bg-surface-alt p-3 text-xs text-muted">
            <Skull className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Elimination is a percentage-mode rule — in point mode most of the room is tied on the
              same score early on, so there is no clear last place to knock out.
            </span>
          </p>
        )}

        <ToggleRow
          icon={<Hash className="w-4 h-4" />}
          title="Set number of rounds"
          description={
            elimOn
              ? 'Set by elimination — the game runs until one player is left'
              : roundsEnabled
                ? `The game ends after ${roundsValue} ${roundsValue === 1 ? 'round' : 'rounds'}`
                : 'Unlimited — play until the host ends the session'
          }
          checked={roundsEnabled && !elimOn}
          disabled={elimOn}
          onChange={() => setRoundsEnabled(v => !v)}
        >
          {roundsEnabled && !elimOn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 space-y-2 overflow-hidden border-t border-primary/20 pt-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Rounds</span>
                <span className="font-mono text-sm font-semibold text-deep">{roundsValue}</span>
              </div>
              <input
                title="Number of Rounds"
                type="range"
                min={1}
                max={50}
                value={roundsValue}
                onChange={e => setRoundsValue(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted">
                <span>1</span>
                <span>50</span>
              </div>
            </motion.div>
          )}
        </ToggleRow>
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-muted/20 pt-4 sm:flex-row">
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
