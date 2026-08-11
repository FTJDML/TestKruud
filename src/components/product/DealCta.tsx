import { ArrowUpRight } from 'lucide-react'
import type { DealPricing } from '@/lib/pricing/deal'
import { cn } from '@/lib/utils'

type Props = {
  offerId: string | null
  pricing: DealPricing | null
  source: string
  merchantName: string
  size?: 'card' | 'large'
  className?: string
}

/**
 * Externe deal-CTA. Loopt altijd via /go/[offerId], zodat affiliate-links later
 * centraal kunnen worden toegevoegd zonder de frontend aan te passen.
 * Is de aanbieding stale of uitverkocht, dan verdwijnt de knop.
 */
export function DealCta({ offerId, pricing, source, merchantName, size = 'card', className }: Props) {
  if (!offerId || !pricing) {
    return (
      <p className={cn('text-sm text-muted', className)}>Geen actieve aanbieding bij een aanbieder.</p>
    )
  }

  if (!pricing.isActive) {
    return (
      <div className={cn('rounded-tile border border-line bg-canvas px-3 py-2.5', className)}>
        <p className="text-sm font-medium text-ink">
          {pricing.inStock ? 'Prijs niet recent gecontroleerd' : 'Momenteel uitverkocht'}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {pricing.inStock
            ? 'Wij controleren de prijs opnieuw in de volgende ronde. Daarom staat de dealknop nu uit.'
            : `${merchantName} heeft dit product tijdelijk niet op voorraad.`}
        </p>
      </div>
    )
  }

  return (
    <a
      href={`/go/${offerId}?source=${encodeURIComponent(source)}`}
      target="_blank"
      rel="sponsored nofollow noopener"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill bg-accent font-semibold text-white transition-colors hover:bg-accent-hover',
        size === 'large' ? 'min-h-12 px-6 text-base' : 'min-h-11 px-5 text-sm',
        className,
      )}
    >
      Bekijk deal
      <ArrowUpRight aria-hidden className="size-4" />
      <span className="sr-only">bij {merchantName}, opent in een nieuw tabblad</span>
    </a>
  )
}
