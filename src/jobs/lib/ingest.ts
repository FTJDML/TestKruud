import type { ImageStatus, Merchant, Prisma, PrismaClient, ProductStatus } from '@prisma/client'
import { adapterFor } from '@/merchants/adapters'
import type { AdapterContext, NormalizedItem } from '@/merchants/types'
import { findDuplicate, normalizeTitle, type DedupeCandidate } from '@/lib/deals/dedupe'
import { STALE_AFTER_MS } from '@/lib/pricing/deal'
import { centsToDecimalString, toCents } from '@/lib/pricing/money'
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

/**
 * Beginstatus van een nieuw product.
 *
 * `DRAFT` betekent "bedoeld om te publiceren, wacht nog op controles": de
 * afbeelding moet geldig zijn en er moet redactionele content zijn. Die promotie
 * doet `promotePublishableProducts`. `CANDIDATE` betekent dat een mens het
 * product eerst in /admin moet goedkeuren.
 */
function initialStatus(merchant: Merchant, item: NormalizedItem): ProductStatus {
  const configuration = (merchant.configuration ?? {}) as Record<string, unknown>
  if (item.product.isDemo) return 'DRAFT'
  return configuration.autoPublish === true ? 'DRAFT' : 'CANDIDATE'
}

type ExistingImageState = {
  imageUrl: string
  imageStatus: ImageStatus
  lastValidImageUrl: string | null
}

/**
 * Bepaalt welke afbeeldingvelden een bestaand product krijgt wanneer de bron een
 * andere URL levert. De nieuwe URL komt eerst in `imageSourceUrl` te staan; de
 * image-job valideert haar en promoveert haar pas daarna naar `imageUrl`.
 */
export function imageUpdateForExisting(
  current: ExistingImageState | undefined,
  incomingUrl: string,
): Prisma.ProductUpdateInput {
  if (!current) return { imageUrl: incomingUrl, imageSourceUrl: incomingUrl, imageStatus: 'PENDING' }
  if (current.imageUrl === incomingUrl) return { imageSourceUrl: incomingUrl }

  if (current.imageStatus === 'VALID') {
    // Werkende afbeelding blijft staan tot de nieuwe is goedgekeurd.
    return { imageSourceUrl: incomingUrl }
  }
  return {
    imageUrl: incomingUrl,
    imageSourceUrl: incomingUrl,
    imageStatus: 'PENDING',
    imageFailureReason: null,
  }
}

/**
 * Leest één merchantbron uit en werkt producten, aanbiedingen en snapshots bij.
 * Idempotent: dezelfde feed twee keer inlezen levert dezelfde database op.
 * Een mislukte run verwijdert nooit bestaande data.
 */
export async function ingestMerchant(
  prisma: PrismaClient,
  merchant: Merchant,
  options: {
    limit?: number
    now?: Date
    /**
     * Alleen prijs en voorraad bijwerken. Nieuwe producten worden dan niet
     * aangemaakt, bestaande producten niet gewijzigd en afbeeldingen niet
     * aangeraakt. Gebruikt door `pnpm job:refresh-prices`, dat meerdere keren per
     * dag mag draaien.
     */
    pricesOnly?: boolean
  } = {},
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
      select: {
        id: true,
        externalId: true,
        ean: true,
        brand: true,
        model: true,
        title: true,
        slug: true,
        imageUrl: true,
        imageStatus: true,
        lastValidImageUrl: true,
      },
    })
    const existingById = new Map(existing.map((product) => [product.id, product]))
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

      // Een fuzzy match is een vermoeden, geen feit. Die wordt nooit
      // automatisch samengevoegd: het product komt als nieuw binnen en de
      // mogelijke koppeling wacht op een mens in /admin.
      const isFuzzy = duplicate?.strategy === 'fuzzy-title'
      const confirmed = isFuzzy ? null : duplicate

      let productId: string
      if (options.pricesOnly) {
        // Zonder bestaand product is er niets om een prijs bij te werken; dat
        // is werk voor de volledige dagelijkse job.
        if (!confirmed) {
          summary.warnings.push(`nieuw product ${item.product.externalId} overgeslagen (alleen prijzen)`)
          continue
        }
        productId = confirmed.match.id
      } else if (confirmed) {
        productId = confirmed.match.id
        const current = existingById.get(productId)
        // Een nieuwe afbeelding-URL wordt eerst gevalideerd. Zolang dat niet is
        // gebeurd blijft de laatst bekende geldige afbeelding staan; een kapotte
        // nieuwe URL mag een werkende afbeelding nooit overschrijven.
        const image = imageUpdateForExisting(current, item.product.imageUrl)
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
            imageAlt: item.product.imageAlt,
            primaryCategory: item.product.primaryCategory,
            collections: item.product.collections ?? [],
            ...image,
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
            imageSourceUrl: item.product.imageUrl,
            // Nieuwe afbeeldingen zijn ongecontroleerd tot de image-job draait.
            imageStatus: 'PENDING',
            status,
            isDemo: item.product.isDemo ?? false,
            collections: item.product.collections ?? [],
            publishedAt: status === 'PUBLISHED' ? now : null,
          },
        })
        productId = created.id
        summary.productsCreated += 1
        candidates.push({ ...candidate, id: created.id })

        if (isFuzzy && duplicate) {
          // Vastleggen als openstaande koppelingsvraag; niets samenvoegen.
          await prisma.productMatchCandidate.upsert({
            where: {
              productId_candidateProductId: {
                productId: created.id,
                candidateProductId: duplicate.match.id,
              },
            },
            create: {
              productId: created.id,
              candidateProductId: duplicate.match.id,
              method: 'FUZZY',
              similarity: duplicate.confidence,
              reason: `titelovereenkomst ${(duplicate.confidence * 100).toFixed(0)}%`,
            },
            update: { similarity: duplicate.confidence },
          })
          summary.warnings.push(
            `mogelijke dubbel: "${item.product.title}" lijkt op een bestaand product; wacht op handmatige bevestiging`,
          )
        }
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
        // Alleen overnemen wanneer de bron verzendkosten betrouwbaar meelevert.
        shippingCost:
          item.offer.shippingCostCents === null || item.offer.shippingCostCents === undefined
            ? null
            : centsToDecimalString(item.offer.shippingCostCents),
        inStock: item.offer.inStock,
        availabilityLabel: item.offer.availabilityLabel ?? null,
        productGroup: item.offer.productGroup ?? null,
        variantId: item.offer.variantId ?? null,
        destinationUrl: item.offer.destinationUrl,
        affiliateUrl: item.offer.affiliateUrl ?? null,
        promotionEndsAt: item.offer.promotionEndsAt ?? null,
        checkedAt: now,
        staleAt,
      }

      // Bij een prijsverversing blijven links, verzendkosten en promotiedata
      // staan zoals de laatste volledige import ze zag.
      const updateData = options.pricesOnly
        ? {
            currentPrice: offerData.currentPrice,
            referencePrice: offerData.referencePrice,
            referencePriceType: offerData.referencePriceType,
            inStock: offerData.inStock,
            availabilityLabel: offerData.availabilityLabel,
            checkedAt: offerData.checkedAt,
            staleAt: offerData.staleAt,
          }
        : offerData

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
        update: updateData,
        select: { id: true },
      })
      summary.offersUpdated += 1

      // Snapshot alleen wanneer prijs of voorraad wijzigt, of bij de eerste meting.
      const previous = await prisma.priceSnapshot.findFirst({
        where: { offerId: offer.id },
        orderBy: { capturedAt: 'desc' },
        select: { price: true, inStock: true },
      })
      // Numeriek vergelijken: "70" en "70.00" zijn dezelfde prijs. Anders zou
      // elke run een identiek snapshot toevoegen en was de job niet idempotent.
      const priceChanged =
        !previous ||
        toCents(previous.price.toString()) !== item.offer.currentPriceCents ||
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
