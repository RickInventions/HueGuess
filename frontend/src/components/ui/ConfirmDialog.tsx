import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for destructive actions. */
  destructive?: boolean
  confirmIcon?: ReactNode
}

/**
 * Yes/no gate in front of an action that cannot be undone.
 *
 * Cancel comes first in the DOM so it takes initial focus and sits on the left on
 * desktop — the safe answer should be the easy one to hit.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  confirmIcon,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-muted leading-relaxed">{message}</p>

      <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="secondary" onClick={onClose} className="sm:w-auto">
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
          icon={confirmIcon}
          className="sm:w-auto"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
