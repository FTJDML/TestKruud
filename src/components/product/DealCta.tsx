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
 * Externe CTA. Loopt altijd via /go/[offerId], zodat affiliate-links later
 * centraal kunnen worden toegevoegd zonder de frontend aan te passen.
 * Is de aanbieding stale of uitverkocht, dan verdwijnt de knop.
 *
 * Een DEAL krijgt de koraalrode knop "Bekijk deal", een DISCOVERY de rustige
 * outline-knop "Bekijk product".
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

  const isDeal = pricing.kind === 'DEAL'

  return (
    <a
      href={`/go/${offerId}?source=${encodeURIComponent(source)}`}
      target="_blank"
      rel="sponsored nofollow noopener"
      data-cta={isDeal ? 'deal' : 'discovery'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors',
        isDeal
          ? 'bg-accent text-white hover:bg-accent-hover'
          : 'border border-ink/15 bg-card text-ink hover:border-ink hover:bg-canvas',
        size === 'large' ? 'min-h-12 px-6 text-base' : 'min-h-11 px-5 text-sm',
        className,
      )}
    >
      {isDeal ? 'Bekijk deal' : 'Bekijk product'}
      <ArrowUpRight aria-hidden className="size-4" />
      <span className="sr-only">bij {merchantName}, opent in een nieuw tabblad</span>
    </a>
  )
}
