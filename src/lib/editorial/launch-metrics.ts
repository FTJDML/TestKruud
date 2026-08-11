import type { PrismaClient } from '@prisma/client'
import { checkClusterProminence } from '@/lib/editorial/clusters'
import { overlappingGroups, OVERLAP_WARN_THRESHOLD } from '@/lib/editorial/overlap'
import { categoryNamesFor } from '@/lib/database/editorial-queries'
import { categories } from '@/lib/categories'
import { publicProductFilter } from '@/lib/products/visibility'
import { launchTargetsFromEnv } from '@/lib/env'
import { STALE_AFTER_MS } from '@/lib/pricing/deal'

/**
 * Cijfers voor het launchdashboard.
 *
 * Alles hier is een **meting**: elk getal komt uit een `count` of een `findMany`
 * op echte rijen. Er wordt niets aangevuld, geschat of gesimuleerd om een doel
 * te halen — een rood vakje betekent dat er werk ligt, niet dat het getal
 * onbetrouwbaar is.
 */
export type LaunchMetric = {
  key: string
  label: string
  value: number
  /** Doel uit de environment; null wanneer er geen doel is. */
  target: number | null
  /** Groen: doel gehaald. Oranje: bijna. Rood: nog te ver, of iets is fout. */
  tone: 'groen' | 'oranje' | 'rood'
  /** Korte toelichting; bij problemen de eerste voorbeelden. */
  detail?: string
}

export type LaunchDashboard = {
  metrics: LaunchMetric[]
  clusters: Array<{
    slug: string
    title: string
    productCount: number
    editorialPageCount: number
    prominent: boolean
    reasons: string[]
  }>
  emptyCategories: Array<{ slug: string; name: string; count: number }>
  overlaps: Array<{ titles: string[]; score: number }>
  problemPages: {
    withoutSources: Array<{ slug: string; title: string }>
    withoutFactCheck: Array<{ slug: string; title: string }>
    stalePrices: Array<{ slug: string; title: string }>
    orphans: Array<{ slug: string; title: string }>
  }
  invalidImages: Array<{ slug: string; title: string; reason: string | null }>
  /** Aantal dagen vooruit waarvoor er content is gepland. */
  plannedDays: number
  homepage: { placements: number; minimum: number; meetsMinimum: boolean }
}

/** Groen bij het doel, oranje vanaf 70%, rood daaronder. */
function toneFor(value: number, target: number | null): LaunchMetric['tone'] {
  if (target === null) return value > 0 ? 'groen' : 'oranje'
  if (value >= target) return 'groen'
  if (value >= target * 0.7) return 'oranje'
  return 'rood'
}

/** Omgekeerd: hoe lager hoe beter (fouten, verweesde pagina's). */
function inverseTone(value: number): LaunchMetric['tone'] {
  if (value === 0) return 'groen'
  if (value <= 3) return 'oranje'
  return 'rood'
}

export async function collectLaunchDashboard(
  prisma: PrismaClient,
  options: { homepagePlacements: number; homepageMinimum: number; now?: Date },
): Promise<LaunchDashboard> {
  const now = options.now ?? new Date()
  const targets = launchTargetsFromEnv()
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)

  const [
    visibleProducts,
    publishedPages,
    scheduledPages,
    plannedProducts,
    invalidImageProducts,
    pages,
    clusters,
    planEntries,
    indexablePages,
  ] = await Promise.all([
    prisma.product.findMany({
      where: publicProductFilter(),
      select: { id: true, slug: true, title: true, primaryCategory: true },
    }),
    prisma.editorialPage.count({ where: { status: 'PUBLISHED' } }),
    prisma.editorialPage.count({ where: { status: 'SCHEDULED' } }),
    prisma.contentPlanEntry.count({ where: { type: 'PRODUCT', status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
    prisma.product.findMany({
      where: { imageStatus: 'INVALID' },
      select: { slug: true, title: true, imageFailureReason: true },
      take: 20,
    }),
    prisma.editorialPage.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        indexable: true,
        primaryQuery: true,
        introduction: true,
        clusterId: true,
        lastFactCheckedAt: true,
        _count: { select: { sources: true } },
        products: {
          where: { role: 'SELECTED' },
          select: {
            productId: true,
            product: {
              select: {
                offers: { select: { checkedAt: true, merchant: { select: { enabled: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.contentCluster.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { editorialPages: { where: { status: 'PUBLISHED' }, select: { id: true } } },
    }),
    prisma.contentPlanEntry.findMany({
      where: { status: { in: ['PLANNED', 'IN_PROGRESS'] }, scheduledFor: { gte: now } },
      select: { scheduledFor: true },
    }),
    prisma.editorialPage.count({ where: { status: 'PUBLISHED', indexable: true } }),
  ])

  // Indexeerbare productpagina's: dezelfde poort als de sitemap gebruikt.
  const { getIndexableProducts } = await import('@/lib/database/queries')
  const indexableProducts = await getIndexableProducts()

  const clusterRows = []
  for (const cluster of clusters) {
    const productCount = await prisma.product.count({
      where: publicProductFilter({ primaryCategory: { in: categoryNamesFor(cluster.categorySlugs) } }),
    })
    const verdict = checkClusterProminence({
      status: cluster.status,
      visible: cluster.visible,
      minProducts: cluster.minProducts,
      minEditorialPages: cluster.minEditorialPages,
      publishedProductCount: productCount,
      publishedEditorialPageCount: cluster.editorialPages.length,
    })
    clusterRows.push({
      slug: cluster.slug,
      title: cluster.title,
      productCount,
      editorialPageCount: cluster.editorialPages.length,
      prominent: verdict.prominent,
      reasons: verdict.reasons,
    })
  }

  const productsPerCategory = new Map<string, number>()
  for (const product of visibleProducts) {
    productsPerCategory.set(
      product.primaryCategory,
      (productsPerCategory.get(product.primaryCategory) ?? 0) + 1,
    )
  }
  const emptyCategories = categories
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      count: productsPerCategory.get(category.name) ?? 0,
    }))
    .filter((category) => category.count === 0)

  const overlapGroups = overlappingGroups(
    pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      primaryQuery: page.primaryQuery,
      introduction: page.introduction,
      productIds: page.products.map((entry) => entry.productId),
      indexable: page.indexable,
    })),
  )

  const withoutSources = pages
    .filter((page) => page._count.sources === 0)
    .map((page) => ({ slug: page.slug, title: page.title }))
  const withoutFactCheck = pages
    .filter((page) => page.lastFactCheckedAt === null)
    .map((page) => ({ slug: page.slug, title: page.title }))
  const stalePages = pages
    .filter((page) =>
      page.products.some((entry) => {
        const offers = entry.product.offers.filter((offer) => offer.merchant.enabled)
        if (offers.length === 0) return true
        return offers.every((offer) => offer.checkedAt < staleBefore)
      }),
    )
    .map((page) => ({ slug: page.slug, title: page.title }))

  const approvedInbound = await prisma.internalLinkSuggestion.findMany({
    where: { status: 'APPROVED', toType: 'EDITORIAL_PAGE' },
    select: { toRef: true },
  })
  const linkedSlugs = new Set(approvedInbound.map((link) => link.toRef))
  const orphans = pages
    .filter((page) => page.status === 'PUBLISHED' && page.clusterId === null && !linkedSlugs.has(page.slug))
    .map((page) => ({ slug: page.slug, title: page.title }))

  // Hoeveel dagen vooruit is er content gepland? Wij tellen de dagen tot de
  // laatste geplande datum, niet het aantal regels.
  const plannedDays =
    planEntries.length === 0
      ? 0
      : Math.max(
          0,
          Math.ceil(
            (Math.max(...planEntries.map((entry) => entry.scheduledFor.getTime())) - now.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )

  const metrics: LaunchMetric[] = [
    {
      key: 'visibleProducts',
      label: 'Zichtbare producten',
      value: visibleProducts.length,
      target: targets.publishedProducts,
      tone: toneFor(visibleProducts.length, targets.publishedProducts),
      detail: 'gepubliceerd, met geldige afbeelding en redactionele content',
    },
    {
      key: 'indexableProducts',
      label: "Indexeerbare productpagina's",
      value: indexableProducts.length,
      target: null,
      tone: toneFor(indexableProducts.length, Math.round(targets.publishedProducts * 0.6)),
      detail: 'door de indexeringspoort: eigen inhoud, actieve aanbieding, bereikbaar',
    },
    {
      key: 'publishedPages',
      label: "Gepubliceerde redactionele pagina's",
      value: publishedPages,
      target: targets.publishedPages,
      tone: toneFor(publishedPages, targets.publishedPages),
    },
    {
      key: 'indexablePages',
      label: "Indexeerbare redactionele pagina's",
      value: indexablePages,
      target: null,
      tone: toneFor(indexablePages, Math.round(targets.publishedPages * 0.8)),
      detail: `${publishedPages - indexablePages} gepubliceerde pagina('s) staan op noindex`,
    },
    {
      key: 'scheduledPages',
      label: "Geplande redactionele pagina's",
      value: scheduledPages,
      target: targets.plannedPages,
      tone: toneFor(scheduledPages, targets.plannedPages),
    },
    {
      key: 'plannedProducts',
      label: 'Geplande producten',
      value: plannedProducts,
      target: targets.plannedProducts,
      tone: toneFor(plannedProducts, targets.plannedProducts),
    },
    {
      key: 'plannedDays',
      label: 'Dagen content vooruit gepland',
      value: plannedDays,
      target: targets.plannedDays,
      tone: toneFor(plannedDays, targets.plannedDays),
    },
    {
      key: 'homepage',
      label: 'Productplaatsingen op de homepage',
      value: options.homepagePlacements,
      target: options.homepageMinimum,
      tone: toneFor(options.homepagePlacements, options.homepageMinimum),
    },
    {
      key: 'emptyCategories',
      label: 'Lege categorieën',
      value: emptyCategories.length,
      target: 0,
      tone: inverseTone(emptyCategories.length),
      detail: emptyCategories.map((category) => category.name).slice(0, 4).join(', '),
    },
    {
      key: 'emptyClusters',
      label: 'Zichtbare clusters zonder genoeg inhoud',
      value: clusterRows.filter((cluster) => !cluster.prominent).length,
      target: 0,
      tone: inverseTone(clusterRows.filter((cluster) => !cluster.prominent).length),
      detail: 'een cluster komt pas in de navigatie wanneer het de drempels haalt',
    },
    {
      key: 'orphans',
      label: "Verweesde pagina's",
      value: orphans.length,
      target: 0,
      tone: inverseTone(orphans.length),
      detail: orphans.map((page) => page.slug).slice(0, 3).join(', '),
    },
    {
      key: 'overlaps',
      label: 'Overlappende primaryQueries',
      value: overlapGroups.length,
      target: 0,
      tone: inverseTone(overlapGroups.length),
      detail: `drempel ${Math.round(OVERLAP_WARN_THRESHOLD * 100)}%`,
    },
    {
      key: 'withoutSources',
      label: "Pagina's zonder bronnen",
      value: withoutSources.length,
      target: 0,
      tone: inverseTone(withoutSources.length),
      detail: withoutSources.map((page) => page.slug).slice(0, 3).join(', '),
    },
    {
      key: 'withoutFactCheck',
      label: "Pagina's zonder fact-check",
      value: withoutFactCheck.length,
      target: 0,
      tone: inverseTone(withoutFactCheck.length),
      detail: withoutFactCheck.map((page) => page.slug).slice(0, 3).join(', '),
    },
    {
      key: 'stalePrices',
      label: "Pagina's met verouderde prijzen",
      value: stalePages.length,
      target: 0,
      tone: inverseTone(stalePages.length),
      detail: 'minimaal één product waarvan alle prijzen ouder zijn dan 24 uur',
    },
    {
      key: 'invalidImages',
      label: 'Producten met een ongeldige afbeelding',
      value: invalidImageProducts.length,
      target: 0,
      tone: inverseTone(invalidImageProducts.length),
    },
  ]

  return {
    metrics,
    clusters: clusterRows,
    emptyCategories,
    overlaps: overlapGroups.map((group) => ({
      titles: group.pages.map((page) => page.title),
      score: group.score,
    })),
    problemPages: { withoutSources, withoutFactCheck, stalePrices: stalePages, orphans },
    invalidImages: invalidImageProducts.map((product) => ({
      slug: product.slug,
      title: product.title,
      reason: product.imageFailureReason,
    })),
    plannedDays,
    homepage: {
      placements: options.homepagePlacements,
      minimum: options.homepageMinimum,
      meetsMinimum: options.homepagePlacements >= options.homepageMinimum,
    },
  }
}
