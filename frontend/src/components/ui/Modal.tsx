import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Extra line under the title. */
  subtitle?: ReactNode
  children: ReactNode
  /** Pinned to the bottom, outside the scroll area. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Hide the × — for dialogs that must be answered with a button. */
  hideClose?: boolean
  className?: string
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

/**
 * Overlay dialog rendered into a portal on document.body.
 *
 * A portal because the modal is opened from inside game views that sit in
 * transformed, scrolled containers — rendering in place would clip it and trap
 * its z-index below the surrounding cards.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  hideClose = false,
  className = '',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape closes, and while open the page behind must not scroll — on mobile a
  // scrollable body under an overlay makes the dialog feel detached from the page.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  // Move focus into the dialog so keyboard and screen-reader users land inside it
  // rather than continuing from whatever was focused on the page behind.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => panelRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-deep/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            // Bottom sheet on phones, centred card from sm up. max-h keeps a long
            // friends list inside the viewport instead of pushing the footer off.
            className={`
              relative w-full ${sizes[size]}
              bg-surface border border-border shadow-card
              rounded-t-card sm:rounded-card
              max-h-[90vh] sm:max-h-[85vh]
              flex flex-col outline-none
              ${className}
            `}
          >
            {(title || !hideClose) && (
              <div className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="font-heading font-semibold text-lg text-deep">{title}</h2>}
                  {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-muted">{subtitle}</p>}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-1 -mt-1 shrink-0 rounded-button p-2 text-muted transition-colors hover:bg-surface-alt hover:text-deep cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">
              {children}
            </div>

            {footer && (
              <div className="border-t border-border px-5 py-4 sm:px-6">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
