import type { PrismaClient } from '@prisma/client'
import { analysePrices, ANALYSIS_VERSION, type MerchantOffer, type PriceObservation } from '@/lib/analysis/price-analysis'
import { centsToDecimalString, toCents } from '@/lib/pricing/money'
import { computeDealPricing } from '@/lib/pricing/deal'
import { errorMessage, logger } from '@/lib/logger'

export type AnalysisSummary = {
  analysed: number
  skipped: number
  failed: number
}

/** Meer dan genoeg voor 90 dagen; voorkomt dat één product de job laat vollopen. */
const MAX_SNAPSHOTS_PER_PRODUCT = 500

function cents(value: { toString(): string } | null | undefined): number | null {
  return value === null || value === undefined ? null : toCents(value.toString())
}

function decimal(value: number | null): string | null {
  return value === null ? null : centsToDecimalString(value)
}

/**
 * Berekent voor elk product met aanbiedingen een `DealAnalysis` uit de
 * prijssnapshots. Draait na de import en vóór de editieselectie, zodat de
 * selectie met verse cijfers werkt.
 */
export async function analyseAllPrices(
  prisma: PrismaClient,
  options: { now?: Date; limit?: number } = {},
): Promise<AnalysisSummary> {
  const now = options.now ?? new Date()
  const summary: AnalysisSummary = { analysed: 0, skipped: 0, failed: 0 }

  const products = await prisma.product.findMany({
    where: { status: { notIn: ['REJECTED', 'ARCHIVED'] }, offers: { some: {} } },
    select: {
      id: true,
      slug: true,
      offers: {
        select: {
          id: true,
          merchantId: true,
          currentPrice: true,
          shippingCost: true,
          referencePrice: true,
          referencePriceType: true,
          currency: true,
          inStock: true,
          checkedAt: true,
          staleAt: true,
          promotionEndsAt: true,
          merchant: { select: { enabled: true } },
        },
      },
    },
    take: options.limit,
  })

  for (const product of products) {
    try {
      const usable = product.offers.filter((offer) => offer.merchant.enabled)
      if (usable.length === 0) {
        summary.skipped += 1
        continue
      }

      const priced = usable
        .map((offer) => ({ offer, pricing: computeDealPricing(offer, now) }))
        .sort((left, right) => left.pricing.currentPriceCents - right.pricing.currentPriceCents)
      const best = priced[0]
      if (!best || best.pricing.currentPriceCents <= 0) {
        summary.skipped += 1
        continue
      }

      const snapshots = await prisma.priceSnapshot.findMany({
        where: { offerId: { in: usable.map((offer) => offer.id) } },
        orderBy: { capturedAt: 'asc' },
        take: MAX_SNAPSHOTS_PER_PRODUCT,
        select: { price: true, capturedAt: true, inStock: true },
      })

      const observations: PriceObservation[] = snapshots
        .map((snapshot) => ({
          priceCents: cents(snapshot.price) ?? 0,
          capturedAt: snapshot.capturedAt,
          inStock: snapshot.inStock,
        }))
        .filter((observation) => observation.priceCents > 0)

      const offers: MerchantOffer[] = priced.map((entry) => ({
        merchantId: entry.offer.merchantId,
        priceCents: entry.pricing.currentPriceCents,
        shippingCents: cents(entry.offer.shippingCost),
        isActive: entry.pricing.isActive,
      }))

      const analysis = analysePrices({
        currentPriceCents: best.pricing.currentPriceCents,
        observations,
        offers,
        now,
      })

      const data = {
        currency: best.pricing.currency,
        currentPrice: centsToDecimalString(analysis.currentPriceCents),
        previousObservedPrice: decimal(analysis.previousObservedPriceCents),
        lowestPrice30Days: decimal(analysis.lowestPrice30DaysCents),
        medianPrice90Days: decimal(analysis.medianPrice90DaysCents),
        lowestPriceAllTime: decimal(analysis.lowestPriceAllTimeCents),
        highestPrice90Days: decimal(analysis.highestPrice90DaysCents),
        priceChangeAmount: decimal(analysis.priceChangeAmountCents),
        priceChangePercentage: analysis.priceChangePercentage,
        numberOfObservedPrices: analysis.numberOfObservedPrices,
        numberOfComparedMerchants: analysis.numberOfComparedMerchants,
        cheapestMerchantId: analysis.cheapestMerchantId,
        nextCheapestPrice: decimal(analysis.nextCheapestPriceCents),
        differenceToNextMerchant: decimal(analysis.differenceToNextMerchantCents),
        firstSeenAt: analysis.firstSeenAt,
        lastSeenAt: analysis.lastSeenAt,
        lastPriceChangeAt: analysis.lastPriceChangeAt,
        dealDetectedAt: analysis.dealDetectedAt,
        calculatedAt: analysis.calculatedAt,
        confidenceLevel: analysis.confidenceLevel,
        analysisVersion: ANALYSIS_VERSION,
        historyDays: analysis.historyDays,
      }

      await prisma.dealAnalysis.upsert({
        where: { productId: product.id },
        create: { productId: product.id, ...data },
        update: data,
      })
      summary.analysed += 1
    } catch (error) {
      summary.failed += 1
      logger.error('Prijsanalyse mislukt', { product: product.slug, reason: errorMessage(error) })
    }
  }

  logger.info('Prijsanalyse afgerond', { ...summary, version: ANALYSIS_VERSION })
  return summary
}
