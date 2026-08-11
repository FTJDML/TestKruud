import type { PrismaClient } from '@prisma/client'
import type { ProductImportRow } from '@/lib/csv/product-import'
import { normalizeTitle } from '@/lib/deals/dedupe'
import { imageUpdateForExisting } from '@/jobs/lib/ingest'
import { logger } from '@/lib/logger'

/**
 * Productimport uit een CSV.
 *
 * Dezelfde regels als bij een feed: nieuwe producten komen binnen als
 * `CANDIDATE` met `imageStatus = PENDING`, een bestaande geldige afbeelding
 * wordt niet vervangen door een ongecontroleerde URL, en de slug van een
 * bestaand product blijft ongewijzigd — een slug is een publieke URL, die
 * verandert niet omdat een importbestand iets anders zegt.
 */
export type ImportSummary = {
  created: number
  updated: number
  skipped: number
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

export async function importCsvRows(
  prisma: PrismaClient,
  rows: readonly ProductImportRow[],
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, problems: [] }

  for (const row of rows) {
    const merchant = await prisma.merchant.findUnique({ where: { slug: row.merchantSlug } })
    if (!merchant) {
      summary.skipped += 1
      summary.problems.push(`merchant "${row.merchantSlug}" bestaat niet`)
      continue
    }

    // Bestaand product zoeken op EAN, dan op externe ID binnen deze merchant.
    const existing =
      (row.ean ? await prisma.product.findUnique({ where: { ean: row.ean } }) : null) ??
      (await prisma.product.findFirst({
        where: { externalId: row.externalId, offers: { some: { merchantId: merchant.id } } },
      }))

    const offerData = {
      currentPrice: (row.currentPriceCents / 100).toFixed(2),
      referencePrice: row.referencePriceCents !== null ? (row.referencePriceCents / 100).toFixed(2) : null,
      referencePriceType: row.referencePriceType,
      currency: row.currency,
      shippingCost: row.shippingCostCents !== null ? (row.shippingCostCents / 100).toFixed(2) : null,
      inStock: row.inStock,
      destinationUrl: row.destinationUrl,
      affiliateUrl: row.affiliateUrl,
      checkedAt: new Date(),
    }

    if (existing) {
      const imageUpdate = imageUpdateForExisting(
        {
          imageUrl: existing.imageUrl,
          imageStatus: existing.imageStatus,
          lastValidImageUrl: existing.lastValidImageUrl,
        },
        row.imageUrl,
      )
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          // Bewust niet de slug: die is een publieke URL.
          title: row.title,
          normalizedTitle: normalizeTitle(row.title),
          brand: row.brand,
          model: row.model,
          primaryCategory: row.categoryName,
          shortSourceDescription: row.description,
          specifications: row.specifications,
          imageAlt: row.imageAlt,
          ...imageUpdate,
        },
      })
      // De feed-unieke sleutel is (merchant, externalOfferId); dezelfde regel als
      // in de gewone import.
      await prisma.offer.upsert({
        where: {
          merchantId_externalOfferId: { merchantId: merchant.id, externalOfferId: row.externalId },
        },
        create: {
          productId: existing.id,
          merchantId: merchant.id,
          externalOfferId: row.externalId,
          ...offerData,
        },
        update: offerData,
      })
      summary.updated += 1
      continue
    }

    const product = await prisma.product.create({
      data: {
        slug: await uniqueSlug(prisma, slugify(row.title)),
        externalId: row.externalId,
        ean: row.ean,
        brand: row.brand,
        model: row.model,
        title: row.title,
        normalizedTitle: normalizeTitle(row.title),
        primaryCategory: row.categoryName,
        shortSourceDescription: row.description,
        specifications: row.specifications,
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        imageSourceUrl: row.imageUrl,
        // Een geïmporteerde afbeelding is nog niet gecontroleerd.
        imageStatus: 'PENDING',
        // Een import publiceert nooit: een mens keurt het product goed.
        status: 'CANDIDATE',
        offers: {
          create: {
            merchantId: merchant.id,
            externalOfferId: row.externalId,
            ...offerData,
          },
        },
      },
    })
    logger.debug('Product geïmporteerd uit CSV', { slug: product.slug })
    summary.created += 1
  }

  return summary
}
