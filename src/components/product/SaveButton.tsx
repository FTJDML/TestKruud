'use client'

import { Heart } from 'lucide-react'
import { useSaves } from '@/components/product/SavesProvider'
import { cn } from '@/lib/utils'
import { MIN_VISIBLE_SAVE_COUNT } from '@/lib/database/queries.shared'

type Props = {
  productId: string
  /** Wordt gebruikt in het aria-label, zodat de knop op zichzelf begrijpelijk is. */
  productTitle: string
  /** Echt aantal saves uit de database; geen verzonnen getallen. */
  saveCount: number
  variant?: 'card' | 'detail'
  className?: string
}

/**
 * Bewaarknop. Optimistic UI, toegankelijk label, echte aantallen pas vanaf tien
 * saves. Een save is geen review en geen rating.
 */
export function SaveButton({ productId, productTitle, saveCount, variant = 'card', className }: Props) {
  const { isSaved, toggle, ready } = useSaves()
  const saved = isSaved(productId)
  const showCount = saveCount >= MIN_VISIBLE_SAVE_COUNT
  // data-ready meldt dat de status met de database is gesynchroniseerd; de
  // smoketest wacht hierop en het is zichtbaar in devtools bij twijfel.
  const state = { 'data-ready': ready ? 'true' : 'false', 'data-saved': saved ? 'true' : 'false' }

  if (variant === 'detail') {
    return (
      <button
        type="button"
        onClick={() => void toggle(productId)}
        aria-pressed={saved}
        aria-label={saved ? `${productTitle} uit bewaard verwijderen` : `${productTitle} bewaren`}
        {...state}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors',
          saved ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-card text-ink hover:border-ink',
          className,
        )}
      >
        <Heart aria-hidden className={cn('size-4', saved && 'fill-current')} />
        {saved ? 'Bewaard' : 'Bewaren'}
        {showCount ? <span className="text-xs font-medium text-muted">{saveCount}</span> : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void toggle(productId)}
      aria-pressed={saved}
      aria-label={saved ? `${productTitle} uit bewaard verwijderen` : `${productTitle} bewaren`}
      {...state}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-pill border bg-card/95 transition-colors',
        saved ? 'border-accent text-accent' : 'border-line text-muted hover:border-ink hover:text-ink',
        className,
      )}
    >
      <Heart aria-hidden className={cn('size-5', saved && 'fill-current')} />
      {showCount ? <span className="sr-only">{saveCount} keer bewaard</span> : null}
    </button>
  )
}
