import { motion } from 'framer-motion'
import { Palette, Wrench, Sparkles } from 'lucide-react'
import { BackgroundAmbience } from './components/layout/BackgroundAmbience'

export default function Maintenance() {
  return (
    <>
      <BackgroundAmbience />
      <div className="min-h-dvh flex items-center justify-center px-6 bg-base">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-md w-full text-center space-y-8"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface shadow-card border border-border"
          >
            <Palette className="w-8 h-8 text-primary" />
          </motion.div>

          {/* Heading */}
          <div className="space-y-3">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="font-heading text-hero text-deep"
            >
              We'll be
              <br />
              <span className="text-primary">right back.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-muted text-lg leading-relaxed"
            >
              HueGuess is temporarily offline while we squash bugs and cook up something special.
            </motion.p>
          </div>

          {/* Status cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <Wrench className="w-5 h-5 text-accent mx-auto mb-2" />
              <p className="text-xs text-muted">Fixing bugs</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <Sparkles className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted">New features</p>
            </div>
          </motion.div>

          {/* Beta note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="pt-4"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-alt border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-muted">
                Thanks for testing the beta{' '}
                <span className="text-primary font-medium">💜</span>
              </span>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="text-xs text-muted/50 pt-8"
          >
            Something big is coming. Stay tuned.
          </motion.p>
        </motion.div>
      </div>
    </>
  )
}