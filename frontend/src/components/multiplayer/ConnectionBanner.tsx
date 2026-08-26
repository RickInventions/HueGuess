import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'

interface ConnectionBannerProps {
  isOnline: boolean
  isConnected: boolean
  isReconnecting: boolean
  message?: string | null
  onRetry?: () => void
}

/**
 * One banner for every degraded connection state, so no screen silently
 * pretends the socket is fine.
 */
export function ConnectionBanner({
  isOnline,
  isConnected,
  isReconnecting,
  message,
  onRetry,
}: ConnectionBannerProps) {
  const visible = !isOnline || !isConnected
  if (!visible) return null

  const offline = !isOnline
  const retrying = isReconnecting && isOnline
  const Icon = offline ? WifiOff : retrying ? Loader2 : AlertTriangle
  const tone = offline || !retrying ? 'accent' : 'primary'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        role="status"
        aria-live="polite"
        className={`flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-card border text-xs sm:text-sm ${
          tone === 'accent'
            ? 'bg-accent/10 border-accent/20 text-accent'
            : 'bg-primary/10 border-primary/20 text-primary'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${retrying ? 'animate-spin' : ''}`} />
        <span className="min-w-0 flex-1">
          {message ??
            (offline
              ? 'You are offline — waiting for your connection'
              : retrying
                ? 'Reconnecting to the game server…'
                : 'Not connected to the game server')}
        </span>
        {onRetry && !retrying && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-button bg-white/10 hover:bg-white/20 transition-colors font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
