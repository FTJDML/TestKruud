import type { Merchant, Prisma, PrismaClient, ProductStatus } from '@prisma/client'
import { adapterFor } from '@/merchants/adapters'
import type { AdapterContext, NormalizedItem } from '@/merchants/types'
import { findDuplicate, normalizeTitle, type DedupeCandidate } from '@/lib/deals/dedupe'
import { STALE_AFTER_MS } from '@/lib/pricing/deal'
import { centsToDecimalString } from '@/lib/pricing/money'
import { errorMessage, logger } from '@/lib/logger'
import { uniqueSlug } from '@/lib/utils'

export type IngestSummary = {
  merchantSlug: string
  productsFound: number
  productsCreated: number
  offersUpdated: number
  warnings: string[]
  error?: string
}

function merchantContext(merchant: Merchant, limit?: number): AdapterContext {
  return {
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      name: merchant.name,
      domain: merchant.domain,
      sourceType: merchant.sourceType,
      feedUrl: merchant.feedUrl,
      scrapingAllowed: merchant.scrapingAllowed,
      configuration: (merchant.configuration ?? {}) as Record<string, unknown>,
    },
    limit,
  }
}

function initialStatus(merchant: Merchant, item: NormalizedItem): ProductStatus {
  const configuration = (merchant.configuration ?? {}) as Record<string, unknown>
  // Demo-producten en merchants met autoPublish worden direct gepubliceerd;
  // nieuwe echte producten vragen standaard handmatige goedkeuring.
  if (item.product.isDemo) return 'PUBLISHED'
  return configuration.autoPublish === true ? 'PUBLISHED' : 'CANDIDATE'
}

/**
 * Leest één merchantbron uit en werkt producten, aanbiedingen en snapshots bij.
 * Idempotent: dezelfde feed twee keer inlezen levert dezelfde database op.
 * Een mislukte run verwijdert nooit bestaande data.
 */
export async function ingestMerchant(
  prisma: PrismaClient,
  merchant: Merchant,
  options: { limit?: number; now?: Date } = {},
): Promise<IngestSummary> {
  const now = options.now ?? new Date()
  const summary: IngestSummary = {
    merchantSlug: merchant.slug,
    productsFound: 0,
    productsCreated: 0,
    offersUpdated: 0,
    warnings: [],
  }

  const run = await prisma.scrapeRun.create({
    data: { merchantId: merchant.id, status: 'RUNNING', startedAt: now },
  })

  const adapter = adapterFor(merchant.sourceType)
  if (!adapter) {
    summary.error = `geen adapter voor sourceType ${merchant.sourceType}`
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: summary.error },
    })
    return summary
  }

  const context = merchantContext(merchant, options.limit)
  const configurationErrors = adapter.validate(context)
  if (configurationErrors.length > 0) {
    summary.error = `configuratie onvolledig: ${configurationErrors.join('; ')}`
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: summary.error },
    })
    logger.error('Merchantbron overgeslagen', { merchant: merchant.slug, reason: summary.error })
    return summary
  }

  try {
    const result = await adapter.fetchItems(context)
    summary.productsFound = result.items.length
    summary.warnings.push(...result.warnings)

    // Bestaande producten als deduplicatiekandidaten inlezen.
    const existing = await prisma.product.findMany({
      select: { id: true, externalId: true, ean: true, brand: true, model: true, title: true, slug: true },
    })
    const takenSlugs = new Set(existing.map((product) => product.slug))
    const candidates: DedupeCandidate[] = existing.map((product) => ({
      id: product.id,
      merchantSlug: merchant.slug,
      externalId: product.externalId,
      ean: product.ean,
      brand: product.brand,
      model: product.model,
      title: product.title,
    }))

    for (const item of result.items) {
      const candidate: DedupeCandidate = {
        id: item.product.externalId,
        merchantSlug: merchant.slug,
        externalId: item.product.externalId,
        ean: item.product.ean,
        brand: item.product.brand,
        model: item.product.model,
        title: item.product.title,
      }
      const duplicate = findDuplicate(candidate, candidates)

      let productId: string
      if (duplicate) {
        productId = duplicate.match.id
        await prisma.product.update({
          where: { id: productId },
          data: {
            title: item.product.title,
            normalizedTitle: normalizeTitle(item.product.title),
            brand: item.product.brand ?? undefined,
            model: item.product.model ?? undefined,
            ean: item.product.ean ?? undefined,
            shortSourceDescription: item.product.shortSourceDescription ?? undefined,
            specifications: (item.product.specifications ?? {}) as Prisma.InputJsonValue,
            imageUrl: item.product.imageUrl,
            imageAlt: item.product.imageAlt,
            primaryCategory: item.product.primaryCategory,
            collections: item.product.collections ?? [],
          },
        })
      } else {
        const slug = uniqueSlug(item.product.title, takenSlugs)
        takenSlugs.add(slug)
        const status = initialStatus(merchant, item)
        const created = await prisma.product.create({
          data: {
            slug,
            externalId: item.product.externalId,
            ean: item.product.ean,
            brand: item.product.brand,
            model: item.product.model,
            title: item.product.title,
            normalizedTitle: normalizeTitle(item.product.title),
            primaryCategory: item.product.primaryCategory,
            shortSourceDescription: item.product.shortSourceDescription,
            specifications: (item.product.specifications ?? {}) as Prisma.InputJsonValue,
            imageUrl: item.product.imageUrl,
            imageAlt: item.product.imageAlt,
            status,
            isDemo: item.product.isDemo ?? false,
            collections: item.product.collections ?? [],
            publishedAt: status === 'PUBLISHED' ? now : null,
          },
        })
        productId = created.id
        summary.productsCreated += 1
        candidates.push({ ...candidate, id: created.id })
      }

      const staleAt = new Date(now.getTime() + STALE_AFTER_MS)
      const offerData = {
        currentPrice: centsToDecimalString(item.offer.currentPriceCents),
        referencePrice:
          item.offer.referencePriceCents === null || item.offer.referencePriceCents === undefined
            ? null
            : centsToDecimalString(item.offer.referencePriceCents),
        referencePriceType: item.offer.referencePriceType ?? null,
        currency: item.offer.currency,
        inStock: item.offer.inStock,
        destinationUrl: item.offer.destinationUrl,
        affiliateUrl: item.offer.affiliateUrl ?? null,
        promotionEndsAt: item.offer.promotionEndsAt ?? null,
        checkedAt: now,
        staleAt,
      }

      const offer = await prisma.offer.upsert({
        where: {
          merchantId_externalOfferId: {
            merchantId: merchant.id,
            externalOfferId: item.offer.externalOfferId,
          },
        },
        create: {
          productId,
          merchantId: merchant.id,
          externalOfferId: item.offer.externalOfferId,
          ...offerData,
        },
        update: offerData,
        select: { id: true },
      })
      summary.offersUpdated += 1

      // Snapshot alleen wanneer prijs of voorraad wijzigt, of bij de eerste meting.
      const previous = await prisma.priceSnapshot.findFirst({
        where: { offerId: offer.id },
        orderBy: { capturedAt: 'desc' },
        select: { price: true, inStock: true },
      })
      const priceChanged =
        !previous ||
        previous.price.toString() !== offerData.currentPrice ||
        previous.inStock !== offerData.inStock
      if (priceChanged) {
        await prisma.priceSnapshot.create({
          data: {
            offerId: offer.id,
            price: offerData.currentPrice,
            referencePrice: offerData.referencePrice,
            inStock: offerData.inStock,
            capturedAt: now,
          },
        })
      }
    }

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: summary.warnings.length > 0 ? 'PARTIAL' : 'SUCCESS',
        finishedAt: new Date(),
        productsFound: summary.productsFound,
        productsCreated: summary.productsCreated,
        offersUpdated: summary.offersUpdated,
        errorMessage: summary.warnings.length > 0 ? summary.warnings.slice(0, 5).join(' | ') : null,
      },
    })
  } catch (error) {
    summary.error = errorMessage(error)
    // Belangrijk: een mislukte run laat bestaande producten en aanbiedingen staan.
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        productsFound: summary.productsFound,
        productsCreated: summary.productsCreated,
        offersUpdated: summary.offersUpdated,
        errorMessage: summary.error,
      },
    })
    logger.error('Ingest mislukt', { merchant: merchant.slug, reason: summary.error })
  }

  return summary
}

/** Zet staleAt op aanbiedingen die langer dan 24 uur niet zijn gecontroleerd. */
export async function markStaleOffers(prisma: PrismaClient, now: Date = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() - STALE_AFTER_MS)
  const result = await prisma.offer.updateMany({
    where: { checkedAt: { lt: threshold } },
    data: { staleAt: threshold },
  })
  return result.count
}
