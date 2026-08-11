import { cn } from '@/lib/utils'
import type { ProductBadge } from '@/types'

/** Precies één badge per productkaart; geen knipperende of bewegende varianten. */
export function Badge({ badge, className }: { badge: ProductBadge; className?: string }) {
  const tone =
    badge.tone === 'accent'
      ? 'bg-accent text-white'
      : badge.tone === 'deal'
        ? 'bg-deal-soft text-deal'
        : 'bg-canvas text-ink'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold tracking-tight',
        tone,
        badge.tone === 'neutral' && 'border border-line',
        className,
      )}
    >
      {badge.label}
    </span>
  )
}
