import { motion, AnimatePresence } from 'framer-motion'
import type { HSLColor } from '../../types'

interface ColorDisplayProps {
  color: HSLColor | null
  showControls?: boolean
  size?: 'lg' | 'sm'
}

function hslString(c: HSLColor): string {
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`
}

export function ColorDisplay({ color, showControls = true, size = 'lg' }: ColorDisplayProps) {
  const sizeClass = size === 'lg' ? 'w-full max-w-[280px] mx-auto' : 'w-full'

  if (!color) {
    return (
      <div className={`${sizeClass} aspect-square rounded-2xl bg-surface-alt animate-pulse`} />
    )
  }

  const rgb = (() => {
    const h = color.h / 360
    const s = color.s / 100
    const l = color.l / 100
    
    let r, g, b
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  })()

  return (
    <div className={`${sizeClass} space-y-3`}>
      <div
        className="aspect-square rounded-2xl shadow-card transition-all duration-300"
        style={{ backgroundColor: hslString(color) }}
      />
      
      {showControls && (
        <div className="bg-surface-alt rounded-xl p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted">Hue</div>
              <div className="text-sm font-mono font-semibold text-deep">{color.h}°</div>
            </div>
            <div>
              <div className="text-xs text-muted">Saturation</div>
              <div className="text-sm font-mono font-semibold text-deep">{color.s}%</div>
            </div>
            <div>
              <div className="text-xs text-muted">Lightness</div>
              <div className="text-sm font-mono font-semibold text-deep">{color.l}%</div>
            </div>
          </div>
          <div className="text-center mt-2">
            <div className="text-xs text-muted">RGB</div>
            <div className="text-xs font-mono text-deep">
              {rgb.r}, {rgb.g}, {rgb.b}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}