import { Slider } from '../ui/Slider'
import type { HSLColor } from '../../types'

interface ColorSlidersProps {
  color: HSLColor
  onChange: (channel: 'h' | 's' | 'l', value: number) => void
  onSubmit?: () => void
  disabled?: boolean
}

export function ColorSliders({ color, onChange, onSubmit, disabled }: ColorSlidersProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onSubmit && (e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="space-y-5 w-full" onKeyDown={handleKeyDown}>
      {/* Preview block */}
      <div
        className="w-full h-24 rounded-xl border border-border shadow-sm transition-colors duration-100"
        style={{ backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)` }}
      />

      {/* Hue slider */}
      <Slider
        label="Hue"
        value={color.h}
        onChange={(v) => onChange('h', v)}
        min={0}
        max={360}
        step={1}
        trackStyle={{
          background: `linear-gradient(to right, 
            hsl(0, 100%, 50%), 
            hsl(60, 100%, 50%), 
            hsl(120, 100%, 50%), 
            hsl(180, 100%, 50%), 
            hsl(240, 100%, 50%), 
            hsl(300, 100%, 50%), 
            hsl(360, 100%, 50%)
          )`,
        }}
      />

      {/* Saturation slider */}
      <Slider
        label="Saturation"
        value={color.s}
        onChange={(v) => onChange('s', v)}
        min={0}
        max={100}
        step={1}
        trackStyle={{
          background: `linear-gradient(to right, 
            hsl(${color.h}, 0%, ${color.l}%), 
            hsl(${color.h}, 100%, ${color.l}%)
          )`,
        }}
      />

      {/* Lightness slider */}
      <Slider
        label="Lightness"
        value={color.l}
        onChange={(v) => onChange('l', v)}
        min={0}
        max={100}
        step={1}
        trackStyle={{
          background: `linear-gradient(to right, 
            hsl(${color.h}, ${color.s}%, 0%), 
            hsl(${color.h}, ${color.s}%, 50%), 
            hsl(${color.h}, ${color.s}%, 100%)
          )`,
        }}
      />

      {/* Keyboard hint */}
      {onSubmit && (
        <p className="text-center text-xs text-muted mt-2">
          Press <kbd className="px-1.5 py-0.5 bg-surface-alt rounded text-xs">Enter</kbd> or{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-alt rounded text-xs">Space</kbd> to submit
        </p>
      )}
    </div>
  )
}