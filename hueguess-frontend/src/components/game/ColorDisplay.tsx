import { motion, AnimatePresence } from 'framer-motion'
import type { ColorHSL } from '../../types'

interface ColorDisplayProps {
  color: ColorHSL | null
  visible: boolean
  size?: 'lg' | 'sm'
}

function hslString(c: ColorHSL): string {
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`
}

export function ColorDisplay({ color, visible, size = 'lg' }: ColorDisplayProps) {
  const sizeClass = size === 'lg' ? 'w-full aspect-square max-w-[280px]' : 'w-full h-32'

  return (
    <div className={`mx-auto ${sizeClass}`}>
      <AnimatePresence mode="wait">
        {visible && color ? (
          <motion.div
            key="color-visible"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="w-full h-full rounded-2xl shadow-card"
            style={{ backgroundColor: hslString(color) }}
          />
        ) : color ? (
          <motion.div
            key="color-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full rounded-2xl shadow-card border-2 border-dashed border-border flex items-center justify-center"
            style={{ backgroundColor: '#F1EEE7' }}
          >
            <span className="text-muted text-sm font-medium">Color hidden</span>
          </motion.div>
        ) : (
          <motion.div
            key="color-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full rounded-2xl bg-surface-alt animate-pulse"
          />
        )}
      </AnimatePresence>
    </div>
  )
}