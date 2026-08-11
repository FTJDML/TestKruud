import type { PrismaClient } from '@prisma/client'
import { editionDate } from '@/lib/deals/edition-date'
import { isPublishableSelection, selectEdition, type EditionCandidate } from '@/lib/deals/edition'
import { computeDealPricing } from '@/lib/pricing/deal'
import { logger } from '@/lib/logger'

export type EditionSummary = {
  editionDate: string
  published: boolean
  heroProductId: string | null
  itemCount: number
  candidateCount: number
  reason?: string
}

/** Bouwt de kandidatenlijst uit gepubliceerde producten met een actieve aanbieding. */
export async function collectEditionCandidates(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<EditionCandidate[]> {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', editorial: { isNot: null } },
    include: {
      editorial: { select: { id: true } },
      offers: {
        orderBy: { currentPrice: 'asc' },
        include: { merchant: { select: { id: true, enabled: true, trustScore: true } } },
      },
    },
  })

  const candidates: EditionCandidate[] = []
  for (const product of products) {
    // De beste aanbieding die daadwerkelijk als deal telt.
    let best: { offerId: string; merchantId: string; priceCents: number; discount: number | null; trust: number } | null =
      null
    for (const offer of product.offers) {
      if (!offer.merchant.enabled) continue
      const pricing = computeDealPricing(offer, now)
      if (!pricing.qualifiesAsDeal) continue
      if (best === null || pricing.currentPriceCents < best.priceCents) {
        best = {
          offerId: offer.id,
          merchantId: offer.merchantId,
          priceCents: pricing.currentPriceCents,
          discount: pricing.discountPercentage,
          trust: offer.merchant.trustScore,
        }
      }
    }
    if (!best) continue

    candidates.push({
      productId: product.id,
      offerId: best.offerId,
      merchantId: best.merchantId,
      category: product.primaryCategory,
      title: product.title,
      priceCents: best.priceCents,
      isUnnecessaryButGreat:
        product.primaryCategory === 'Onnodig Maar Geweldig' ||
        product.collections.includes('onnodig-maar-geweldig'),
      qualifiesAsDeal: true,
      score: {
        uniquenessScore: product.uniquenessScore,
        storyScore: product.storyScore,
        usefulnessScore: product.usefulnessScore,
        giftabilityScore: product.giftabilityScore,
        discountPercentage: best.discount,
        hasValidReferencePrice: true,
        discoveredAt: product.createdAt,
        checkedAt: now,
        visualQualityScore: product.visualQualityScore,
        merchantTrustScore: best.trust,
      },
    })
  }
  return candidates
}

/**
 * Stelt de editie van vandaag samen en publiceert haar atomair. Bij te weinig
 * kandidaten blijft de vorige geldige editie staan; de homepage wordt dus nooit
 * leeg door een mislukte run.
 */
export async function publishDailyEdition(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<EditionSummary> {
  const date = editionDate(now)
  const dateKey = date.toISOString().slice(0, 10)
  const candidates = await collectEditionCandidates(prisma, now)
  const selection = selectEdition(candidates, now)

  if (!isPublishableSelection(selection)) {
    const reason = `te weinig geschikte producten (hero: ${selection.hero ? 'ja' : 'nee'}, items: ${selection.items.length})`
    logger.warn('Editie niet gepubliceerd', { date: dateKey, reason })
    return {
      editionDate: dateKey,
      published: false,
      heroProductId: null,
      itemCount: 0,
      candidateCount: candidates.length,
      reason,
    }
  }

  const hero = selection.hero
  if (!hero) {
    return {
      editionDate: dateKey,
      published: false,
      heroProductId: null,
      itemCount: 0,
      candidateCount: candidates.length,
      reason: 'geen hero',
    }
  }

  await prisma.$transaction(async (tx) => {
    const edition = await tx.dailyEdition.upsert({
      where: { editionDate: date },
      create: { editionDate: date, status: 'DRAFT' },
      update: { status: 'DRAFT' },
      select: { id: true },
    })
    // Items in dezelfde transactie vervangen: de editie is nooit half gevuld.
    await tx.dailyEditionItem.deleteMany({ where: { dailyEditionId: edition.id } })
    await tx.dailyEditionItem.createMany({
      data: [hero, ...selection.items].map((item) => ({
        dailyEditionId: edition.id,
        productId: item.productId,
        offerId: item.offerId,
        position: item.position,
        section: item.section,
        score: item.score,
      })),
    })
    await tx.dailyEdition.update({
      where: { id: edition.id },
      data: { status: 'PUBLISHED', publishedAt: now },
    })
    // Oudere edities archiveren zodat er precies één actuele editie is.
    await tx.dailyEdition.updateMany({
      where: { editionDate: { lt: date }, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    })
  })

  logger.info('Editie gepubliceerd', {
    date: dateKey,
    hero: hero.productId,
    items: selection.items.length,
    skipped: selection.skipped.length,
  })

  return {
    editionDate: dateKey,
    published: true,
    heroProductId: hero.productId,
    itemCount: selection.items.length,
    candidateCount: candidates.length,
  }
}
