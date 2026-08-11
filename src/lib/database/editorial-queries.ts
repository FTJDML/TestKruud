import type { EvidenceSourceType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/database/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { checkClusterProminence } from '@/lib/editorial/clusters'
import { numericFromValue, rankProducts } from '@/lib/editorial/ranking'
import { publicProductFilter } from '@/lib/products/visibility'
import { categories } from '@/lib/categories'
import { formatMoney } from '@/lib/pricing/money'
import { productCardsByIds } from '@/lib/database/queries'
import type {
  ClusterView,
  ComparisonCellView,
  EditorialFaq,
  EditorialPageCardView,
  EditorialPageView,
  EditorialProductView,
} from '@/types'

/**
 * Queries voor de Editorial SEO Engine. Publiek zichtbaar is één definitie:
 * alleen `PUBLISHED` pagina's, en producten die door dezelfde publieke filter
 * komen als de rest van de site.
 */
const pageInclude = {
  cluster: { select: { slug: true, title: true } },
  criteria: { include: { criterion: true }, orderBy: { displayOrder: 'asc' } },
  products: { orderBy: { position: 'asc' } },
  criterionValues: { include: { source: true } },
  sources: { include: { source: true } },
} satisfies Prisma.EditorialPageInclude

type PageWithRelations = Prisma.EditorialPageGetPayload<{ include: typeof pageInclude }>

const sourceTypeLabels: Record<EvidenceSourceType, string> = {
  MANUFACTURER_DOCUMENTATION: 'documentatie van de fabrikant',
  MERCHANT_FEED: 'feed van de aanbieder',
  AFFILIATE_API: 'API van het affiliatenetwerk',
  MANUAL_PRICE_CHECK: 'handmatige prijscontrole',
  OWN_PRICE_HISTORY: 'onze eigen prijshistorie',
  OWN_HANDS_ON_TEST: 'eigen test door de redactie',
  LICENSED_SOURCE: 'gelicentieerde bron',
  OTHER_VERIFIED_SOURCE: 'andere gecontroleerde bron',
}

export function evidenceSourceTypeLabel(type: EvidenceSourceType): string {
  return sourceTypeLabels[type]
}

function faqsFrom(value: Prisma.JsonValue): EditorialFaq[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const record = entry as Record<string, unknown>
    const question = typeof record.question === 'string' ? record.question : null
    const answer = typeof record.answer === 'string' ? record.answer : null
    return question && answer ? [{ question, answer }] : []
  })
}

export function budgetLabelFor(minCents: number | null, maxCents: number | null): string | null {
  if (maxCents !== null && minCents !== null) {
    return `${formatMoney(minCents)} tot ${formatMoney(maxCents)}`
  }
  if (maxCents !== null) return `onder ${formatMoney(maxCents)}`
  if (minCents !== null) return `vanaf ${formatMoney(minCents)}`
  return null
}

/** Bouwt de view voor één pagina; producten komen door de publieke filter. */
async function toPageView(page: PageWithRelations): Promise<EditorialPageView | null> {
  const productIds = page.products.map((entry) => entry.productId)
  const cards = await productCardsByIds(productIds)
  const cardById = new Map(cards.map((card) => [card.id, card]))

  const criteria = page.criteria.map((entry) => ({
    name: entry.criterion.name,
    label: entry.criterion.label,
    unit: entry.criterion.unit,
    explanation: entry.criterion.explanation,
    higherIsBetter: entry.criterion.higherIsBetter,
  }))

  const valuesByProduct = new Map<string, typeof page.criterionValues>()
  for (const value of page.criterionValues) {
    const list = valuesByProduct.get(value.productId) ?? []
    list.push(value)
    valuesByProduct.set(value.productId, list)
  }

  // Eigen startvolgorde: uitsluitend gecontroleerde criteria en onze eigen
  // prijsmeting. Commissie komt hier niet in voor.
  const ranking = rankProducts(
    page.products
      .filter((entry) => entry.role === 'SELECTED')
      .map((entry) => {
        const card = cardById.get(entry.productId)
        return {
          productId: entry.productId,
          currentPriceCents: card?.pricing?.currentPriceCents ?? null,
          priceConfidence: null,
          values: (valuesByProduct.get(entry.productId) ?? []).map((value) => {
            const criterion = page.criteria.find(
              (item) => item.criterionName === value.criterionName,
            )?.criterion
            return {
              criterionName: value.criterionName,
              numericValue: numericFromValue(value.value),
              higherIsBetter: criterion?.higherIsBetter ?? null,
              verified: value.verificationStatus === 'VERIFIED',
            }
          }),
        }
      }),
  )
  const scoreById = new Map(ranking.map((entry) => [entry.productId, entry.score]))

  const toProductView = (entry: PageWithRelations['products'][number]): EditorialProductView | null => {
    const card = cardById.get(entry.productId)
    if (!card) return null
    const values = valuesByProduct.get(entry.productId) ?? []
    const cells: ComparisonCellView[] = criteria.map((criterion) => {
      const value = values.find((item) => item.criterionName === criterion.name)
      return {
        criterionName: criterion.name,
        // Een ongecontroleerde waarde tonen wij niet: dan is "niet opgegeven"
        // het eerlijke antwoord.
        value: value && value.verificationStatus === 'VERIFIED' ? value.value : null,
        verificationStatus: value?.verificationStatus ?? 'NOT_PROVIDED',
        sourceLabel: value?.source ? sourceTypeLabels[value.source.sourceType] : null,
      }
    })
    return {
      product: card,
      role: entry.role,
      position: entry.position,
      bestForAudience: entry.bestForAudience,
      recommendation: entry.recommendation,
      caveat: entry.caveat,
      label: entry.label,
      exceedsBudget: entry.exceedsBudget,
      budgetNote: entry.budgetNote,
      cells,
      rankingScore: scoreById.get(entry.productId) ?? null,
    }
  }

  const selected = page.products
    .filter((entry) => entry.role === 'SELECTED')
    .map(toProductView)
    .filter((entry): entry is EditorialProductView => entry !== null)
  const alternatives = page.products
    .filter((entry) => entry.role === 'ALTERNATIVE')
    .map(toProductView)
    .filter((entry): entry is EditorialProductView => entry !== null)

  // Een pagina zonder publiek zichtbare producten heeft geen inhoud meer.
  if (selected.length === 0) return null

  const featuredCard = page.featuredProductId ? cardById.get(page.featuredProductId) : undefined

  const approvedLinks = await prisma.internalLinkSuggestion.findMany({
    where: { status: 'APPROVED', fromType: 'EDITORIAL_PAGE', fromRef: page.slug },
    orderBy: { createdAt: 'asc' },
    take: 12,
  })

  return {
    id: page.id,
    type: page.type,
    title: page.title,
    slug: page.slug,
    primaryQuery: page.primaryQuery,
    searchIntent: page.searchIntent,
    audience: page.audience,
    useCase: page.useCase,
    budgetMinCents: page.budgetMinCents,
    budgetMaxCents: page.budgetMaxCents,
    budgetLabel: budgetLabelFor(page.budgetMinCents, page.budgetMaxCents),
    introduction: page.introduction,
    methodology: page.methodology,
    conclusion: page.conclusion,
    faqs: faqsFrom(page.frequentlyAskedQuestions),
    seoTitle: page.seoTitle,
    metaDescription: page.metaDescription,
    canonicalUrl: page.canonicalUrl,
    heroImage: page.heroImage,
    indexable: page.indexable,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
    cluster: page.cluster ? { slug: page.cluster.slug, title: page.cluster.title } : null,
    criteria,
    selected,
    alternatives,
    featured: featuredCard
      ? {
          product: featuredCard,
          label: page.featuredLabel,
          reason: page.featuredReason,
          caveat: page.featuredCaveat,
          alternativeNote: page.featuredAlternativeNote,
        }
      : null,
    sources: {
      selectionCriteria: page.selectionCriteria,
      comparedProductCount: selected.length + alternatives.length,
      lastFactCheckedAt: page.lastFactCheckedAt,
      sourceTypeLabels: [
        ...new Set(page.sources.map((entry) => sourceTypeLabels[entry.source.sourceType])),
      ],
      // Alleen waar wanneer er een echte bewijsregistratie van een eigen test is.
      handsOnTested: page.sources.some((entry) => entry.source.sourceType === 'OWN_HANDS_ON_TEST'),
      sources: page.sources.map((entry) => ({
        title: entry.source.title,
        publisher: entry.source.publisher,
        url: entry.source.url,
        accessedAt: entry.source.accessedAt,
      })),
    },
    internalLinks: approvedLinks.map((link) => ({
      href:
        link.toType === 'PRODUCT'
          ? `/product/${link.toRef}`
          : link.toType === 'EDITORIAL_PAGE'
            ? `/gids/${link.toRef}`
            : link.toType === 'CLUSTER'
              ? `/thema/${link.toRef}`
              : link.toType === 'COLLECTION'
                ? `/collectie/${link.toRef}`
                : `/categorie/${link.toRef}`,
      anchorText: link.anchorText,
    })),
  }
}

/** Publieke redactionele pagina op slug; alleen PUBLISHED. */
export async function getEditorialPageBySlug(slug: string): Promise<EditorialPageView | null> {
  const page = await prisma.editorialPage.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: pageInclude,
  })
  if (!page) return null
  return toPageView(page)
}

/** Voor de admin: elke status, inclusief concepten. */
export async function getEditorialPageForAdmin(id: string) {
  return prisma.editorialPage.findUnique({
    where: { id },
    include: {
      ...pageInclude,
      products: { orderBy: { position: 'asc' }, include: { product: true } },
      planEntries: true,
    },
  })
}

function toCardMinimal(page: {
  id: string
  slug: string
  title: string
  type: PageWithRelations['type']
  primaryQuery: string
  introduction: string
  heroImage: string | null
  budgetMinCents: number | null
  budgetMaxCents: number | null
  publishedAt: Date | null
  indexable: boolean
  _count: { products: number }
}): EditorialPageCardView {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    type: page.type,
    typeLabel: archetypeFor(page.type).label,
    primaryQuery: page.primaryQuery,
    introduction: page.introduction,
    heroImage: page.heroImage,
    productCount: page._count.products,
    budgetLabel: budgetLabelFor(page.budgetMinCents, page.budgetMaxCents),
    publishedAt: page.publishedAt,
    indexable: page.indexable,
  }
}

/** Gepubliceerde pagina's, nieuwste eerst. Voor de homepage en overzichten. */
export async function getPublishedEditorialPages(options: {
  limit?: number
  clusterSlug?: string
  type?: PageWithRelations['type']
} = {}): Promise<EditorialPageCardView[]> {
  const pages = await prisma.editorialPage.findMany({
    where: {
      status: 'PUBLISHED',
      ...(options.clusterSlug ? { cluster: { slug: options.clusterSlug } } : {}),
      ...(options.type ? { type: options.type } : {}),
    },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    take: options.limit ?? 12,
    include: { _count: { select: { products: true } } },
  })
  return pages.map(toCardMinimal)
}

/** Alle indexeerbare pagina's voor de sitemap. */
export async function getIndexableEditorialPages(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.editorialPage.findMany({
    where: { status: 'PUBLISHED', indexable: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * Clusters met hun echte aantallen. Een cluster is pas prominent wanneer het de
 * eigen drempels haalt; het aantal producten wordt geteld met dezelfde publieke
 * filter als de rest van de site.
 */
export async function getClusters(options: { onlyProminent?: boolean } = {}): Promise<ClusterView[]> {
  const clusters = await prisma.contentCluster.findMany({
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    include: {
      editorialPages: { where: { status: 'PUBLISHED' }, select: { id: true } },
    },
  })

  const views: ClusterView[] = []
  for (const cluster of clusters) {
    const productCount = await prisma.product.count({
      where: publicProductFilter({
        primaryCategory: { in: categoryNamesFor(cluster.categorySlugs) },
      }),
    })
    const verdict = checkClusterProminence({
      status: cluster.status,
      visible: cluster.visible,
      minProducts: cluster.minProducts,
      minEditorialPages: cluster.minEditorialPages,
      publishedProductCount: productCount,
      publishedEditorialPageCount: cluster.editorialPages.length,
    })
    if (options.onlyProminent && !verdict.prominent) continue
    views.push({
      slug: cluster.slug,
      title: cluster.title,
      introduction: cluster.introduction,
      heroImage: cluster.heroImage,
      seoTitle: cluster.seoTitle,
      metaDescription: cluster.metaDescription,
      primaryTopics: cluster.primaryTopics,
      categorySlugs: cluster.categorySlugs,
      prominent: verdict.prominent,
      productCount,
      editorialPageCount: cluster.editorialPages.length,
    })
  }
  return views
}

export async function getClusterBySlug(slug: string): Promise<ClusterView | null> {
  const clusters = await getClusters()
  return clusters.find((cluster) => cluster.slug === slug) ?? null
}

/** Categorienamen bij een lijst met slugs; de database bewaart de naam. */
export function categoryNamesFor(slugs: readonly string[]): string[] {
  return categories.filter((category) => slugs.includes(category.slug)).map((category) => category.name)
}

/**
 * Gepubliceerde redactionele pagina's waarin dit product voorkomt. Wordt op de
 * productpagina getoond als "In onze vergelijkingen", zodat een productpagina
 * nooit een doodlopend eind is.
 */
export async function getEditorialPagesForProduct(
  productId: string,
  limit = 4,
): Promise<EditorialPageCardView[]> {
  const pages = await prisma.editorialPage.findMany({
    where: { status: 'PUBLISHED', products: { some: { productId } } },
    orderBy: [{ publishedAt: 'desc' }],
    take: limit,
    include: { _count: { select: { products: true } } },
  })
  return pages.map(toCardMinimal)
}

/** Clusters waar een categorie bij hoort; voor kruimelpaden en interne links. */
export async function getClustersForCategory(categorySlug: string): Promise<Array<{ slug: string; title: string }>> {
  const clusters = await prisma.contentCluster.findMany({
    where: { status: 'PUBLISHED', visible: true, categorySlugs: { has: categorySlug } },
    select: { slug: true, title: true },
    orderBy: { displayOrder: 'asc' },
  })
  return clusters
}
