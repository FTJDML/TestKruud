import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/client'
import { computeDealPricing } from '@/lib/pricing/deal'
import { isSafeDestination, resolveDestination } from '@/lib/deals/outbound'
import { affiliateLinksEnabled, stagingMode } from '@/lib/env'
import { linkBuilderFor } from '@/lib/affiliate/networks'
import { affiliateConfigSchema } from '@/lib/affiliate/types'
import { safeSubId } from '@/lib/affiliate/subid'
import { readVisitorId } from '@/lib/saves/visitor'
import { trackServerEvent } from '@/lib/analytics/events'
import { errorMessage, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Centrale uitgaande route. Zoekt de aanbieding, controleert of zij actief is,
 * registreert de klik en stuurt tijdelijk door.
 *
 * De bestemming komt van de link builder van het netwerk van de merchant. Die
 * voegt het subid toe dat bij de plaatsing hoort (`home_hero`,
 * `home_best_deals_3`, `category_keuken_5`, `product_related_2`), zodat later
 * per positie te zien is wat werkt. Is een netwerk niet geconfigureerd, dan gaat
 * de bezoeker gewoon naar de winkel: een onvolledige affiliateopzet mag nooit een
 * doodlopende link opleveren.
 */
export async function GET(request: Request, context: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await context.params
  const source = new URL(request.url).searchParams.get('source') ?? 'onbekend'
  const subId = safeSubId(source)

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      product: { select: { id: true, slug: true, status: true } },
      merchant: {
        select: { id: true, slug: true, name: true, enabled: true, affiliateNetwork: true, configuration: true },
      },
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

  if (stagingMode()) {
    // In staging bestaat er geen klik naar buiten: wij bouwen geen affiliatelink,
    // registreren geen uitgaande klik en openen geen winkel. De bezoeker krijgt een
    // interne pagina die vertelt welke aanbieder hier in productie zou openen.
    const notice = new URL('/staging/uitgaand', request.url)
    notice.searchParams.set('merchant', offer.merchant.name)
    notice.searchParams.set('product', offer.product.slug)
    return NextResponse.redirect(notice, 307)
  }

  const withAffiliate = affiliateLinksEnabled()
  const network = withAffiliate ? offer.merchant.affiliateNetwork : 'DIRECT'
  const merchantConfig = (offer.merchant.configuration ?? {}) as { affiliate?: unknown }
  const parsedConfig = affiliateConfigSchema.safeParse({
    network,
    ...(typeof merchantConfig.affiliate === 'object' && merchantConfig.affiliate !== null
      ? merchantConfig.affiliate
      : {}),
  })
  const config = parsedConfig.success ? parsedConfig.data : { network }

  const link = linkBuilderFor(network).buildLink(
    {
      destinationUrl: offer.destinationUrl,
      affiliateUrl: withAffiliate ? offer.affiliateUrl : null,
    },
    { subId, productId: offer.product.id, offerId: offer.id },
    config,
  )

  // Zonder werkende netwerkconfiguratie: gewone bestemming, met een duidelijke
  // melding in de log. De bezoeker merkt er niets van.
  const target = link.ok
    ? link.url
    : resolveDestination(offer, { affiliateLinksEnabled: withAffiliate })
  if (!link.ok) {
    logger.warn('Affiliatelink niet gebouwd; gewone bestemming gebruikt', {
      merchant: offer.merchant.slug,
      network,
      reason: link.reason,
    })
  }

  if (!isSafeDestination(target)) {
    logger.error('Onveilige bestemming geweigerd', { offerId, merchant: offer.merchant.slug })
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
        source: subId.slice(0, 60),
      },
    })
    await trackServerEvent(
      { type: 'outbound_click', productId: offer.product.id, offerId: offer.id, source: subId },
      { visitorId },
    )
  } catch (error) {
    // Loggen mag de doorverwijzing nooit blokkeren.
    logger.warn('Klik niet geregistreerd', { offerId, reason: errorMessage(error) })
  }

  return NextResponse.redirect(target, 307)
}
