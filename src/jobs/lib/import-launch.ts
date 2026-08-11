import type { PrismaClient } from '@prisma/client'
import type { CatalogProduct } from '@/merchants/adapters/open-icecat'
import type { LaunchOfferRow } from '@/lib/csv/launch-offers'
import { normalizeTitle } from '@/lib/deals/dedupe'
import { logger } from '@/lib/logger'

/**
 * De twee importstappen van de launch, tegen de database.
 *
 * 1. `importCatalogProducts` zet catalogusgegevens neer: titel, merk, model,
 *    EAN, categorie, specificaties, afbeelding en de grondslag waarop wij die
 *    afbeelding gebruiken. Nooit een prijs, nooit voorraad.
 * 2. `importLaunchOffers` zet daar een handmatig gecontroleerde aanbieding bij:
 *    winkel, gewone URL, prijs, eventuele van-prijs en het controlemoment.
 *
 * Producten komen binnen als `CANDIDATE` met `imageStatus = PENDING`. De
 * afbeeldingsvalidatie en de contentgeneratie beslissen daarna, precies zoals bij
 * een feed. Een bestaande slug verandert nooit: dat is een publieke URL.
 */
export type CatalogImportSummary = {
  created: number
  updated: number
  skipped: number
  problems: string[]
}

export type OfferImportSummary = {
  created: number
  updated: number
  skipped: number
  deals: number
  problems: string[]
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function uniqueSlug(prisma: PrismaClient, base: string): Promise<string> {
  const root = base.length > 0 ? base : 'product'
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`
    const existing = await prisma.product.findUnique({ where: { slug: candidate } })
    if (!existing) return candidate
  }
  return `${root}-${Date.now()}`
}

/**
 * Zet catalogusproducten neer. Zoekt eerst op EAN en daarna op de bronsleutel,
 * zodat dezelfde export twee keer draaien niets dubbel maakt.
 */
export async function importCatalogProducts(
  prisma: PrismaClient,
  products: readonly CatalogProduct[],
  options: { dataSource: string; now?: Date } = { dataSource: 'open-icecat' },
): Promise<CatalogImportSummary> {
  const now = options.now ?? new Date()
  const summary: CatalogImportSummary = { created: 0, updated: 0, skipped: 0, problems: [] }

  for (const product of products) {
    const existing =
      (product.ean ? await prisma.product.findUnique({ where: { ean: product.ean } }) : null) ??
      (await prisma.product.findFirst({
        where: { dataSource: options.dataSource, dataSourceRef: product.sourceRef },
      }))

    const shared = {
      title: product.title,
      normalizedTitle: normalizeTitle(product.title),
      brand: product.brand,
      model: product.model,
      primaryCategory: product.primaryCategory,
      specifications: product.specifications,
      imageAlt: product.title,
      imageSourceUrl: product.imageUrl,
      imageUsageBasis: product.imageUsageBasis,
      imageAttribution: product.imageAttribution,
      imageWidth: product.imageWidth,
      imageHeight: product.imageHeight,
      manufacturerName: product.manufacturerName,
      manufacturerUrl: product.manufacturerUrl,
      dataSource: options.dataSource,
      dataSourceRef: product.sourceRef,
      // Catalogusdata is geen demo-inhoud: dit zijn echte producten.
      isDemo: false,
      // De omschrijving van de bron nemen wij niet over; de redactionele tekst
      // wordt uit de specificaties geschreven.
      shortSourceDescription: null,
    }

    if (existing) {
      // Een geldige afbeelding wordt niet vervangen door een ongecontroleerde URL.
      const imageChanged = existing.imageUrl !== product.imageUrl
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          ...shared,
          ...(imageChanged && existing.imageStatus !== 'VALID'
            ? { imageUrl: product.imageUrl, imageStatus: 'PENDING', imageCheckedAt: null }
            : {}),
          ...(product.ean && existing.ean === null ? { ean: product.ean } : {}),
        },
      })
      summary.updated += 1
      continue
    }

    try {
      await prisma.product.create({
        data: {
          ...shared,
          slug: await uniqueSlug(prisma, slugify(`${product.brand} ${product.model} ${product.title}`)),
          ean: product.ean,
          externalId: product.sourceRef,
          imageUrl: product.imageUrl,
          imageStatus: 'PENDING',
          status: 'CANDIDATE',
          createdAt: now,
        },
      })
      summary.created += 1
    } catch (error) {
      summary.skipped += 1
      summary.problems.push(`${product.sourceRef}: ${error instanceof Error ? error.message : 'onbekend'}`)
    }
  }

  logger.info('Catalogusproducten geïmporteerd', {
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    source: options.dataSource,
  })
  return summary
}

/**
 * Zet handmatig gecontroleerde aanbiedingen bij bestaande producten. Zonder
 * product wordt de rij overgeslagen: een offer verzint hier geen product.
 */
export async function importLaunchOffers(
  prisma: PrismaClient,
  rows: readonly LaunchOfferRow[],
): Promise<OfferImportSummary> {
  const summary: OfferImportSummary = { created: 0, updated: 0, skipped: 0, deals: 0, problems: [] }

  for (const row of rows) {
    const merchant = await prisma.merchant.findUnique({ where: { slug: row.merchantSlug } })
    if (!merchant) {
      summary.skipped += 1
      summary.problems.push(`merchant "${row.merchantSlug}" bestaat niet`)
      continue
    }

    const product =
      (row.ean ? await prisma.product.findUnique({ where: { ean: row.ean } }) : null) ??
      (row.productSlug ? await prisma.product.findUnique({ where: { slug: row.productSlug } }) : null)
    if (!product) {
      summary.skipped += 1
      summary.problems.push(`geen product voor ${row.ean ?? row.productSlug ?? 'onbekend'}`)
      continue
    }

    const externalOfferId = `manual:${row.ean ?? product.slug}`
    const data = {
      currentPrice: (row.currentPriceCents / 100).toFixed(2),
      referencePrice: row.referencePriceCents !== null ? (row.referencePriceCents / 100).toFixed(2) : null,
      referencePriceType: row.referencePriceType,
      currency: row.currency,
      shippingCost: row.shippingCostCents !== null ? (row.shippingCostCents / 100).toFixed(2) : null,
      inStock: row.inStock,
      availabilityLabel: row.availabilityLabel,
      destinationUrl: row.destinationUrl,
      // Een handmatig bestand levert nooit een affiliatelink; die komt uit een feed.
      affiliateUrl: null,
      promotionEndsAt: row.promotionEndsAt,
      checkedAt: row.priceCheckedAt,
      priceCheckMethod: 'MANUAL' as const,
    }

    const existing = await prisma.offer.findUnique({
      where: { merchantId_externalOfferId: { merchantId: merchant.id, externalOfferId } },
    })

    const offer = existing
      ? await prisma.offer.update({ where: { id: existing.id }, data })
      : await prisma.offer.create({
          data: { ...data, productId: product.id, merchantId: merchant.id, externalOfferId },
        })

    // Elke controle is een meting; die bewaren wij, zodat de prijsanalyse later
    // met echte historie kan rekenen.
    await prisma.priceSnapshot.create({
      data: {
        offerId: offer.id,
        price: data.currentPrice,
        referencePrice: data.referencePrice,
        inStock: row.inStock,
        capturedAt: row.priceCheckedAt,
      },
    })

    if (existing) summary.updated += 1
    else summary.created += 1
    if (row.referencePriceCents !== null) summary.deals += 1
  }

  logger.info('Handmatige aanbiedingen geïmporteerd', {
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    withReferencePrice: summary.deals,
  })
  return summary
}
