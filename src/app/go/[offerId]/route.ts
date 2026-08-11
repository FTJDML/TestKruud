import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/client'
import { computeDealPricing } from '@/lib/pricing/deal'
import { isSafeDestination, resolveDestination } from '@/lib/deals/outbound'
import { affiliateLinksEnabled } from '@/lib/env'
import { readVisitorId } from '@/lib/saves/visitor'
import { trackServerEvent } from '@/lib/analytics/events'
import { errorMessage, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Centrale uitgaande route. Zoekt de aanbieding, controleert of zij actief is,
 * registreert de klik en stuurt tijdelijk door naar de affiliate-URL wanneer die
 * bestaat, en anders naar de gewone bestemming. De frontend hoeft niet te
 * veranderen zodra affiliate-links worden toegevoegd.
 */
export async function GET(request: Request, context: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await context.params
  const source = new URL(request.url).searchParams.get('source') ?? 'onbekend'

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      product: { select: { id: true, slug: true, status: true } },
      merchant: { select: { id: true, enabled: true } },
    },
  })

  if (!offer || !offer.merchant.enabled || offer.product.status === 'REJECTED') {
    return NextResponse.json({ error: 'Aanbieding niet gevonden.' }, { status: 404 })
  }

  const pricing = computeDealPricing(offer)
  if (!pricing.isActive) {
    // Verlopen of uitverkocht: terug naar de productpagina met de uitleg daar.
    return NextResponse.redirect(new URL(`/product/${offer.product.slug}`, request.url), 307)
  }

  const target = resolveDestination(offer, { affiliateLinksEnabled: affiliateLinksEnabled() })
  if (!isSafeDestination(target)) {
    logger.error('Onveilige bestemming geweigerd', { offerId, target })
    return NextResponse.json({ error: 'Ongeldige bestemming.' }, { status: 400 })
  }

  const visitorId = await readVisitorId()
  try {
    await prisma.outboundClick.create({
      data: {
        productId: offer.product.id,
        offerId: offer.id,
        merchantId: offer.merchant.id,
        anonymousVisitorId: visitorId,
        source: source.slice(0, 60),
      },
    })
    await trackServerEvent(
      { type: 'outbound_click', productId: offer.product.id, offerId: offer.id, source },
      { visitorId },
    )
  } catch (error) {
    // Loggen mag de doorverwijzing nooit blokkeren.
    logger.warn('Klik niet geregistreerd', { offerId, reason: errorMessage(error) })
  }

  return NextResponse.redirect(target, 307)
}
