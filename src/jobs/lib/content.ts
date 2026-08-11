import type { Prisma, PrismaClient } from '@prisma/client'
import { providerForProduct } from '@/lib/ai'
import { factsFingerprint, type ProductFacts } from '@/lib/ai/provider'
import { toCents } from '@/lib/pricing/money'
import { errorMessage, logger } from '@/lib/logger'

export type ContentSummary = {
  generated: number
  skipped: number
  needsReview: number
  failed: number
}

function toSpecifications(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const output: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') output[key] = entry
    else if (typeof entry === 'number' || typeof entry === 'boolean') output[key] = String(entry)
  }
  return output
}

/**
 * Genereert redactionele content voor producten die er nog geen hebben of
 * waarvan belangrijke productfeiten zijn gewijzigd. Nooit iedere dag opnieuw
 * zonder reden, en nooit tijdens een paginaweergave.
 */
export async function generateMissingContent(
  prisma: PrismaClient,
  options: { limit?: number; force?: boolean } = {},
): Promise<ContentSummary> {
  const summary: ContentSummary = { generated: 0, skipped: 0, needsReview: 0, failed: 0 }

  const products = await prisma.product.findMany({
    where: { status: { in: ['CANDIDATE', 'DRAFT', 'NEEDS_REVIEW', 'PUBLISHED'] } },
    include: {
      editorial: true,
      offers: {
        orderBy: { currentPrice: 'asc' },
        take: 1,
        include: { merchant: { select: { name: true } } },
      },
    },
    take: options.limit,
  })

  for (const product of products) {
    const offer = product.offers[0]
    const facts: ProductFacts = {
      title: product.title,
      brand: product.brand,
      model: product.model,
      primaryCategory: product.primaryCategory,
      shortSourceDescription: product.shortSourceDescription,
      specifications: toSpecifications(product.specifications),
      merchantName: offer?.merchant.name ?? 'de aanbieder',
      currentPriceCents: offer ? (toCents(offer.currentPrice) ?? 0) : 0,
      isDemo: product.isDemo,
    }
    const fingerprint = factsFingerprint(facts)

    if (
      !options.force &&
      product.editorial &&
      product.editorial.sourceFactsHash === fingerprint
    ) {
      summary.skipped += 1
      continue
    }

    try {
      const provider = providerForProduct(facts)
      const result = await provider.generate(facts)
      const content = result.content

      await prisma.$transaction([
        prisma.editorialContent.upsert({
          where: { productId: product.id },
          create: {
            productId: product.id,
            headline: content.headline,
            teaser: content.teaser,
            longDescription: content.longDescription,
            whyItStandsOut: content.whyItStandsOut,
            bestFor: content.bestFor as Prisma.InputJsonValue,
            caveat: content.caveat,
            seoTitle: content.seoTitle,
            metaDescription: content.metaDescription,
            tags: content.tags as Prisma.InputJsonValue,
            promptVersion: result.promptVersion,
            aiProvider: result.provider,
            sourceFactsHash: fingerprint,
            generatedAt: new Date(),
            reviewedAt: result.needsReview ? null : new Date(),
          },
          update: {
            headline: content.headline,
            teaser: content.teaser,
            longDescription: content.longDescription,
            whyItStandsOut: content.whyItStandsOut,
            bestFor: content.bestFor as Prisma.InputJsonValue,
            caveat: content.caveat,
            seoTitle: content.seoTitle,
            metaDescription: content.metaDescription,
            tags: content.tags as Prisma.InputJsonValue,
            promptVersion: result.promptVersion,
            aiProvider: result.provider,
            sourceFactsHash: fingerprint,
            generatedAt: new Date(),
            reviewedAt: result.needsReview ? null : new Date(),
          },
        }),
        prisma.product.update({
          where: { id: product.id },
          data: {
            uniquenessScore: content.uniquenessScore,
            storyScore: content.storyScore,
            usefulnessScore: content.usefulnessScore,
            giftabilityScore: content.giftabilityScore,
            // Een gepubliceerd product blijft gepubliceerd; nieuwe content die
            // review nodig heeft komt op NEEDS_REVIEW.
            status:
              product.status === 'PUBLISHED'
                ? 'PUBLISHED'
                : result.needsReview
                  ? 'NEEDS_REVIEW'
                  : 'DRAFT',
          },
        }),
      ])

      summary.generated += 1
      if (result.needsReview) summary.needsReview += 1
      if (result.warnings.length > 0) {
        logger.warn('Contentwaarschuwingen', { product: product.slug, warnings: result.warnings })
      }
    } catch (error) {
      summary.failed += 1
      // Een mislukte generatie laat bestaande content ongemoeid.
      logger.error('Contentgeneratie mislukt', { product: product.slug, reason: errorMessage(error) })
    }
  }

  return summary
}
