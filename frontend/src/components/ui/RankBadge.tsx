import { rankColor, rankIcon } from '../../lib/ranks'

interface RankBadgeProps {
  /** Stored rank label, e.g. "Gold II". Falls back to Bronze styling when absent. */
  label?: string | null
  size?: 'xs' | 'sm' | 'md'
  /** Hide the tier emoji — for tight rows where the label alone is enough. */
  hideIcon?: boolean
  className?: string
}

const sizes = {
  xs: 'gap-1 px-1.5 py-0.5 text-[10px]',
  sm: 'gap-1.5 px-2 py-0.5 text-xs',
  md: 'gap-2 px-3 py-1 text-sm',
}

const iconSizes = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-base',
}

/**
 * Tier-coloured pill for a rank label.
 *
 * The tier palette is deliberately used as a *tint* and a border rather than as
 * the text colour — Silver (#A8A9AD) and Gold (#D4A017) sit at roughly 2:1
 * against a white card, so coloured label text would be unreadable. A pale wash
 * of the tier colour behind `text-deep` keeps the tier legible at a glance and
 * the words legible full stop.
 */
export function RankBadge({ label, size = 'sm', hideIcon = false, className = '' }: RankBadgeProps) {
  const color = rankColor(label)

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-heading font-semibold text-deep ${sizes[size]} ${className}`}
      style={{ backgroundColor: `${color}24`, borderColor: `${color}59` }}
    >
      {!hideIcon && (
        <span className={iconSizes[size]} aria-hidden="true">
          {rankIcon(label)}
        </span>
      )}
      {label ?? 'Unranked'}
    </span>
  )
}
