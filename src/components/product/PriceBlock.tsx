import { Clock } from 'lucide-react'
import { formatPromotionEnd, type DealPricing } from '@/lib/pricing/deal'
import { cn } from '@/lib/utils'

type Props = {
  pricing: DealPricing
  merchantName: string
  size?: 'card' | 'hero' | 'detail'
  className?: string
}

/**
 * Prijsblok. Alle bedragen en percentages komen uit de prijsmodule en zijn
 * server-side geformatteerd volgens nl-NL. Alleen een DEAL toont een
 * doorgestreepte van-prijs, een besparing en een percentage; een DISCOVERY
 * toont uitsluitend de actuele prijs.
 */
export function PriceBlock({ pricing, merchantName, size = 'card', className }: Props) {
  const priceSize =
    size === 'hero' ? 'text-4xl sm:text-5xl' : size === 'detail' ? 'text-3xl sm:text-4xl' : 'text-2xl'
  const isDeal = pricing.kind === 'DEAL'

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {pricing.priceLeadLabel}
        </span>
        <span className={cn('font-display font-extrabold tracking-tight text-ink', priceSize)}>
          {pricing.currentPrice}
        </span>
        {isDeal && pricing.referencePrice ? (
          <span className="text-sm text-muted line-through">{pricing.referencePrice}</span>
        ) : null}
      </div>

      {isDeal && pricing.savings && pricing.discountPercentage !== null ? (
        <p className="text-sm font-semibold text-deal">
          Bespaar {pricing.savings} · {pricing.discountPercentage}%
        </p>
      ) : (
        <p className="text-sm text-muted">Huidige aanbiedersprijs</p>
      )}

      {isDeal && pricing.referencePriceLabel ? (
        <p className="text-xs text-muted">{pricing.referencePriceLabel}</p>
      ) : (
        <p className="text-xs text-muted">Geen betrouwbare vergelijkingsprijs bekend</p>
      )}

      {pricing.isTemporary && pricing.promotionEndsAt ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
          <Clock aria-hidden className="size-3.5" />
          Tijdelijke actie tot {formatPromotionEnd(pricing.promotionEndsAt)}
        </p>
      ) : null}

      <p className="text-xs text-muted">
        Bij <span className="font-medium text-ink">{merchantName}</span> ·{' '}
        <span>Laatst {pricing.checkedAtLabel}</span>
      </p>
    </div>
  )
}
