import { Slider } from '../ui/Slider'
import type { ColorHSL } from '../../types'

interface ColorSlidersProps {
  color: ColorHSL
  onChange: (channel: 'h' | 's' | 'l', value: number) => void
  disabled?: boolean
}

export function ColorSliders({ color, onChange, disabled = false }: ColorSlidersProps) {
  return (
    <div className="space-y-5 w-full">
      {/* Preview block — the color the user is building */}
      <div
        className="w-full h-24 rounded-xl border border-border shadow-sm transition-colors duration-100"
        style={{ backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)` }}
      />

      {/* Hue slider — rainbow track */}
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

      {/* Saturation slider — dynamic track based on current hue + lightness */}
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

      {/* Lightness slider — dynamic track based on current hue + saturation */}
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
    </div>
  )
}