import { Slider } from '../ui/Slider'
import type { HSLColor } from '../../types'

interface ColorSlidersProps {
  color: HSLColor
  onChange: (channel: 'h' | 's' | 'l', value: number) => void
  onSubmit?: () => void
  disabled?: boolean
  /**
   * Strips every trace of colour out of the control: flat grey tracks, flat grey
   * preview. Blind mode's grey-slider variant runs on this — you drag by feel,
   * with no gradient to aim along and no preview to check yourself against.
   */
  plain?: boolean
}

/** Neutral track for `plain`. Flat, not a gradient — a gradient is information. */
const PLAIN_TRACK = { background: '#D8D4CB' }

export function ColorSliders({ color, onChange, onSubmit, disabled, plain }: ColorSlidersProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onSubmit && (e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="space-y-5 w-full" onKeyDown={handleKeyDown}>
      {/* Preview block - also dim when disabled */}
      <div
        className={`w-full h-24 rounded-xl border border-border shadow-sm transition-all duration-100 ${
          disabled ? 'opacity-50' : ''
        } ${plain ? 'flex items-center justify-center' : ''}`}
        style={{
          backgroundColor: plain ? '#D8D4CB' : `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
        }}
      >
        {plain && (
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            No preview
          </span>
        )}
      </div>

      {/* Hue slider - ✅ Pass disabled */}
      <Slider
        label="Hue"
        value={color.h}
        onChange={(v) => onChange('h', v)}
        min={0}
        max={360}
        step={1}
        disabled={disabled}
        trackStyle={
          plain
            ? PLAIN_TRACK
            : {
                background: `linear-gradient(to right,
            hsl(0, 100%, 50%),
            hsl(60, 100%, 50%),
            hsl(120, 100%, 50%),
            hsl(180, 100%, 50%),
            hsl(240, 100%, 50%),
            hsl(300, 100%, 50%),
            hsl(360, 100%, 50%)
          )`,
              }
        }
      />

      {/* Saturation slider - ✅ Pass disabled */}
      <Slider
        label="Saturation"
        value={color.s}
        onChange={(v) => onChange('s', v)}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        trackStyle={
          plain
            ? PLAIN_TRACK
            : {
                background: `linear-gradient(to right,
            hsl(${color.h}, 0%, ${color.l}%),
            hsl(${color.h}, 100%, ${color.l}%)
          )`,
              }
        }
      />

      {/* Lightness slider - ✅ Pass disabled */}
      <Slider
        label="Lightness"
        value={color.l}
        onChange={(v) => onChange('l', v)}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        trackStyle={
          plain
            ? PLAIN_TRACK
            : {
                background: `linear-gradient(to right,
            hsl(${color.h}, ${color.s}%, 0%),
            hsl(${color.h}, ${color.s}%, 50%),
            hsl(${color.h}, ${color.s}%, 100%)
          )`,
              }
        }
      />

      {/* Keyboard hint - hide when disabled */}
      {onSubmit && !disabled && (
        <p className="text-center text-xs text-muted mt-2">
          Press <kbd className="px-1.5 py-0.5 bg-surface-alt rounded text-xs">Enter</kbd> or{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-alt rounded text-xs">Space</kbd> to submit
        </p>
      )}
    </div>
  )
}