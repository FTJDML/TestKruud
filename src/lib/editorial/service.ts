import type { PrismaClient } from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { checkOverlap, type OverlapCandidate, type OverlapVerdict } from '@/lib/editorial/overlap'
import {
  evaluateEditorialIndexability,
  offerIsFresh,
  type EditorialGateInput,
  type IndexabilityVerdict,
} from '@/lib/editorial/quality-gate'
import { computeDealPricing } from '@/lib/pricing/deal'
import { toCents } from '@/lib/pricing/money'
import { logger } from '@/lib/logger'

/**
 * Redactionele service: alles wat de admin en de jobs nodig hebben om een pagina
 * te beoordelen. Eén plek waar de quality gate en de overlapcontrole worden
 * gevuld met echte gegevens uit de database, zodat de admin, de publicatieactie
 * en het launchdashboard exact dezelfde uitkomst zien.
 */
export type PageEvaluation = {
  verdict: IndexabilityVerdict
  overlap: OverlapVerdict
  /** Wat de redactie nog moet doen; leeg betekent indexeerbaar. */
  reasons: string[]
}

/** Alle pagina's als overlapkandidaat; alleen de velden die de service nodig heeft. */
export async function overlapCandidates(prisma: PrismaClient): Promise<OverlapCandidate[]> {
  const pages = await prisma.editorialPage.findMany({
    where: { status: { in: ['PUBLISHED', 'SCHEDULED', 'NEEDS_REVIEW', 'DRAFT'] } },
    select: {
      id: true,
      slug: true,
      title: true,
      primaryQuery: true,
      introduction: true,
      indexable: true,
      products: { where: { role: 'SELECTED' }, select: { productId: true } },
    },
  })
  return pages.map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    primaryQuery: page.primaryQuery,
    introduction: page.introduction,
    productIds: page.products.map((entry) => entry.productId),
    indexable: page.indexable,
  }))
}

/**
 * Beoordeelt één pagina volledig: de quality gate plus de overlapcontrole.
 * `now` is injecteerbaar zodat een test niet van de klok afhangt.
 */
export async function evaluatePage(
  prisma: PrismaClient,
  pageId: string,
  now: Date = new Date(),
): Promise<PageEvaluation | null> {
  const page = await prisma.editorialPage.findUnique({
    where: { id: pageId },
    include: {
      criteria: { include: { criterion: true } },
      criterionValues: true,
      sources: { include: { source: true } },
      products: {
        include: {
          product: {
            include: {
              offers: { include: { merchant: { select: { enabled: true } } } },
            },
          },
        },
      },
    },
  })
  if (!page) return null

  const products: EditorialGateInput['products'] = page.products.map((entry) => {
    const offers = entry.product.offers.filter((offer) => offer.merchant.enabled)
    const active = offers.filter((offer) => computeDealPricing(offer, now).isActive)
    const cheapest = [...active].sort(
      (left, right) => (toCents(left.currentPrice) ?? 0) - (toCents(right.currentPrice) ?? 0),
    )[0]
    const latestCheck = offers.reduce<Date | null>(
      (latest, offer) => (latest === null || offer.checkedAt > latest ? offer.checkedAt : latest),
      null,
    )
    return {
      productId: entry.productId,
      status: entry.product.status,
      imageStatus: entry.product.imageStatus,
      hasActiveOffer: active.length > 0 && offerIsFresh(latestCheck, now),
      priceCheckedAt: latestCheck,
      currentPriceCents: cheapest ? (toCents(cheapest.currentPrice) ?? null) : null,
      role: entry.role,
      caveat: entry.caveat,
      exceedsBudget: entry.exceedsBudget,
      budgetNote: entry.budgetNote,
    }
  })

  const criterionByName = new Map(page.criteria.map((entry) => [entry.criterionName, entry.criterion]))
  const criterionValues: EditorialGateInput['criterionValues'] = page.criterionValues.map((value) => ({
    productId: value.productId,
    criterionName: value.criterionName,
    value: value.value,
    verificationStatus: value.verificationStatus,
    hasSource: value.sourceId !== null,
    sourceRequired: criterionByName.get(value.criterionName)?.sourceRequired ?? true,
  }))

  const [titleDuplicates, descriptionDuplicates, inboundLinks] = await Promise.all([
    prisma.editorialPage.count({ where: { seoTitle: page.seoTitle, id: { not: page.id } } }),
    prisma.editorialPage.count({ where: { metaDescription: page.metaDescription, id: { not: page.id } } }),
    prisma.internalLinkSuggestion.count({
      where: { status: 'APPROVED', toType: 'EDITORIAL_PAGE', toRef: page.slug },
    }),
  ])

  const candidates = await overlapCandidates(prisma)
  const overlap = checkOverlap(
    {
      id: page.id,
      slug: page.slug,
      title: page.title,
      primaryQuery: page.primaryQuery,
      introduction: page.introduction,
      productIds: page.products.filter((entry) => entry.role === 'SELECTED').map((entry) => entry.productId),
    },
    candidates,
  )

  const verdict = evaluateEditorialIndexability({
    type: page.type,
    status: page.status,
    primaryQuery: page.primaryQuery,
    searchIntent: page.searchIntent,
    introduction: page.introduction,
    methodology: page.methodology,
    selectionCriteria: page.selectionCriteria,
    seoTitle: page.seoTitle,
    metaDescription: page.metaDescription,
    seoTitleUnique: titleDuplicates === 0,
    metaDescriptionUnique: descriptionDuplicates === 0,
    reviewedAt: page.reviewedAt,
    humanReviewedAt: page.humanReviewedAt,
    generationProvider: page.generationProvider,
    lastFactCheckedAt: page.lastFactCheckedAt,
    budgetMinCents: page.budgetMinCents,
    budgetMaxCents: page.budgetMaxCents,
    // Een eigen hero-afbeelding is optioneel; ontbreekt zij, dan gebruikt de
    // pagina de productafbeeldingen, die al gevalideerd zijn.
    heroImageValid: true,
    products,
    criterionNames: page.criteria.map((entry) => entry.criterionName),
    criterionValues,
    sourceCount: page.sources.length,
    disallowedSourceCount: page.sources.filter((entry) => !entry.source.usageAllowed).length,
    featured: {
      productId: page.featuredProductId,
      label: page.featuredLabel,
      reason: page.featuredReason,
      caveat: page.featuredCaveat,
      alternativeNote: page.featuredAlternativeNote,
    },
    overlap,
    // Een cluster geeft een pagina altijd een inkomende link; anders moet er een
    // goedgekeurde interne link zijn.
    hasInboundLink: page.clusterId !== null || inboundLinks > 0,
    now,
  })

  return { verdict, overlap, reasons: verdict.indexable ? [] : verdict.reasons }
}

/**
 * Slaat het resultaat van de poort op. `indexable` wordt nooit met de hand
 * gezet: het is altijd de uitkomst van deze berekening.
 */
export async function refreshIndexability(
  prisma: PrismaClient,
  pageId: string,
  now: Date = new Date(),
): Promise<PageEvaluation | null> {
  const evaluation = await evaluatePage(prisma, pageId, now)
  if (!evaluation) return null
  await prisma.editorialPage.update({
    where: { id: pageId },
    data: {
      indexable: evaluation.verdict.indexable,
      indexabilityReasons: evaluation.reasons,
    },
  })
  return evaluation
}

/** Herberekent alle pagina's; onderdeel van de dagelijkse pipeline. */
export async function refreshAllIndexability(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<{ checked: number; indexable: number; blocked: number }> {
  const pages = await prisma.editorialPage.findMany({ select: { id: true } })
  let indexable = 0
  for (const page of pages) {
    const evaluation = await refreshIndexability(prisma, page.id, now)
    if (evaluation?.verdict.indexable) indexable += 1
  }
  const summary = { checked: pages.length, indexable, blocked: pages.length - indexable }
  logger.info('Indexeerbaarheid van redactionele pagina\'s herberekend', { ...summary })
  return summary
}

/**
 * Publiceert geplande pagina's waarvan het moment is aangebroken. Een pagina die
 * de poort niet haalt gaat wél live (zij is browsebaar) maar blijft `noindex`;
 * een pagina met sterke overlap wordt niet gepubliceerd.
 */
export async function publishScheduledPages(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<{ published: number; blocked: number }> {
  const due = await prisma.editorialPage.findMany({
    where: { status: 'SCHEDULED', scheduledPublishAt: { lte: now }, reviewedAt: { not: null } },
    select: { id: true, slug: true },
  })

  let published = 0
  let blocked = 0
  for (const page of due) {
    const evaluation = await evaluatePage(prisma, page.id, now)
    if (evaluation && evaluation.overlap.level === 'block') {
      blocked += 1
      logger.warn('Geplande pagina niet gepubliceerd wegens overlap', {
        slug: page.slug,
        reasons: evaluation.overlap.reasons,
      })
      continue
    }
    await prisma.editorialPage.update({
      where: { id: page.id },
      data: { status: 'PUBLISHED', publishedAt: now },
    })
    await refreshIndexability(prisma, page.id, now)
    published += 1
  }
  return { published, blocked }
}

/** Minimaal aantal producten dat dit archetype vraagt; voor de editor. */
export function minimumProductsFor(type: Parameters<typeof archetypeFor>[0]): number {
  return archetypeFor(type).minProducts
}
