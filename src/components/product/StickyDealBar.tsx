import { DealCta } from '@/components/product/DealCta'
import type { DealPricing } from '@/lib/pricing/deal'

/**
 * Compacte sticky CTA op mobiel. Staat alleen in de DOM wanneer de aanbieding
 * actief is, en bedekt nooit een advertentie of andere CTA.
 */
export function StickyDealBar({
  offerId,
  pricing,
  merchantName,
}: {
  offerId: string | null
  pricing: DealPricing | null
  merchantName: string
}) {
  if (!offerId || !pricing?.isActive) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 p-3 backdrop-blur lg:hidden">
      <div className="container-page flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-lg font-extrabold leading-none text-ink">{pricing.currentPrice}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {pricing.kind === 'DEAL' && pricing.referencePrice ? `van ${pricing.referencePrice} · ` : ''}
            bij {merchantName}
          </p>
        </div>
        <DealCta
          offerId={offerId}
          pricing={pricing}
          source="product-sticky"
          merchantName={merchantName}
          className="shrink-0"
        />
      </div>
    </div>
  )
}
