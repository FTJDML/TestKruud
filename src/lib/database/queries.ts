import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/database/client'
import { looksDutch } from '@/lib/ai/language'
import { categorySlugForName } from '@/lib/categories'
import { demoContentEnabled } from '@/lib/env'
import { checkPublicVisibility, publicProductFilter } from '@/lib/products/visibility'
import { computeDealPricing, discountBadgeLabel, type DealPricing } from '@/lib/pricing/deal'
import { analysisFromRecord } from '@/lib/analysis/from-record'
import { priceStatements } from '@/lib/analysis/statements'
import { toCents, formatMoney } from '@/lib/pricing/money'
import { editorialScore } from '@/lib/deals/score'
import { editionDate } from '@/lib/deals/edition-date'
import { MIN_VISIBLE_SAVE_COUNT } from '@/lib/database/queries.shared'
import type {
  CategoryFilters,
  EditionView,
  PriceHistoryPoint,
  ProductBadge,
  ProductCardView,
  ProductDetailView,
} from '@/types'

/**
 * Brondata van een leverancier is vaak Engels. Zulke tekst hoort niet op een
 * Nederlandse pagina, dus zij wordt niet doorgegeven aan de views.
 */
function dutchSourceDescription(value: string | null): string | null {
  if (!value) return null
  return looksDutch(value) ? value : null
}

/** Nieuw ontdekt: producten die we minder dan drie dagen kennen. */
const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

const productInclude = {
  editorial: true,
  analysis: true,
  offers: {
    orderBy: { currentPrice: 'asc' },
    include: {
      merchant: {
        select: { id: true, name: true, domain: true, enabled: true, sourceType: true },
      },
    },
  },
  _count: { select: { saves: true } },
} satisfies Prisma.ProductInclude

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>

/**
 * Basisfilter voor alles wat publiek zichtbaar is: alleen PUBLISHED, alleen met
 * een gevalideerde afbeelding, alleen met redactionele content, en zonder
 * demo-inhoud zolang die uit staat. Zie src/lib/products/visibility.ts.
 */
const publicProductWhere = publicProductFilter

function jsonStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function bestOffer(product: ProductWithRelations, now: Date) {
  const usable = product.offers.filter((offer) => offer.merchant.enabled)
  const active = usable
    .map((offer) => ({ offer, pricing: computeDealPricing(offer, now) }))
    .filter((entry) => entry.pricing.isActive)
  const pool = active.length > 0 ? active : usable.map((offer) => ({ offer, pricing: computeDealPricing(offer, now) }))
  return (
    pool.sort((left, right) => left.pricing.currentPriceCents - right.pricing.currentPriceCents)[0] ?? null
  )
}

function badgeFor(
  product: ProductWithRelations,
  pricing: DealPricing | null,
  options: { isHero?: boolean; now: Date },
): ProductBadge | null {
  // Maximaal één badge per kaart, in vaste volgorde van belang.
  if (options.isHero) return { label: 'Vondst van de dag', tone: 'accent' }
  const discountLabel = discountBadgeLabel(pricing)
  if (discountLabel && (pricing?.discountPercentage ?? 0) >= 20) {
    return { label: discountLabel, tone: 'deal' }
  }
  if (product.collections.includes('redactiefavorieten')) {
    return { label: 'Redactiefavoriet', tone: 'neutral' }
  }
  if (options.now.getTime() - product.createdAt.getTime() < NEW_WINDOW_MS) {
    return { label: 'Nieuw ontdekt', tone: 'neutral' }
  }
  return discountLabel ? { label: discountLabel, tone: 'deal' } : null
}

function toCardView(
  product: ProductWithRelations,
  options: { isHero?: boolean; now?: Date } = {},
): ProductCardView {
  const now = options.now ?? new Date()
  const best = bestOffer(product, now)
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    category: product.primaryCategory,
    categorySlug: categorySlugForName(product.primaryCategory),
    headline: product.editorial?.headline ?? product.title,
    teaser: product.editorial?.teaser ?? dutchSourceDescription(product.shortSourceDescription) ?? '',
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    isDemo: product.isDemo,
    badge: badgeFor(product, best?.pricing ?? null, { isHero: options.isHero, now }),
    merchantName: best?.offer.merchant.name ?? 'onbekende aanbieder',
    offerId: best?.offer.id ?? null,
    pricing: best?.pricing ?? null,
    saveCount: product._count.saves,
    createdAt: product.createdAt,
  }
}

function toDetailView(product: ProductWithRelations, now: Date, history: PriceHistoryPoint[]): ProductDetailView {
  const card = toCardView(product, { now })
  const specifications = Object.entries(
    (product.specifications && typeof product.specifications === 'object' && !Array.isArray(product.specifications)
      ? product.specifications
      : {}) as Record<string, unknown>,
  )
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([label, value]) => ({ label, value: String(value) }))

  const best = bestOffer(product, now)
  const usableOffers = product.offers.filter((offer) => offer.merchant.enabled)
  const cheapestOfferId =
    [...usableOffers]
      .map((offer) => ({ offer, pricing: computeDealPricing(offer, now) }))
      .filter((entry) => entry.pricing.isActive)
      .sort((left, right) => left.pricing.currentPriceCents - right.pricing.currentPriceCents)[0]?.offer.id ??
    null

  // Verzendkosten alleen tonen wanneer élke actieve aanbieding ze meelevert;
  // anders zou de vergelijking scheef staan.
  const shippingKnownForAll =
    usableOffers.length > 0 && usableOffers.every((offer) => offer.shippingCost !== null)

  const analysis = product.analysis
    ? analysisFromRecord(product.analysis, shippingKnownForAll ? 'prijs-en-verzending' : 'prijs')
    : null

  const sourceLabels = new Set<string>()
  for (const offer of usableOffers) {
    if (offer.merchant.sourceType === 'FIXTURE') sourceLabels.add('demo-fixture')
    else if (offer.merchant.sourceType === 'API') sourceLabels.add('merchant-API')
    else sourceLabels.add('merchantfeed')
  }
  if (analysis && analysis.numberOfObservedPrices > 1) sourceLabels.add('eigen prijsmeting')

  return {
    ...card,
    brand: product.brand,
    model: product.model,
    ean: product.ean,
    longDescription: product.editorial?.longDescription ?? '',
    whyItStandsOut: product.editorial?.whyItStandsOut ?? '',
    bestFor: jsonStringArray(product.editorial?.bestFor ?? null),
    caveat: product.editorial?.caveat ?? '',
    seoTitle: product.editorial?.seoTitle ?? product.title,
    metaDescription:
      product.editorial?.metaDescription ?? dutchSourceDescription(product.shortSourceDescription) ?? '',
    tags: jsonStringArray(product.editorial?.tags ?? null),
    specifications,
    shortSourceDescription: dutchSourceDescription(product.shortSourceDescription),
    priceHistory: history,
    updatedAt: product.updatedAt,
    merchantDomain: best?.offer.merchant.domain ?? '',
    // Alleen fixturebronnen leveren verzonnen productgegevens; een ingelezen
    // democatalogus levert echte titels, prijzen en foto's.
    demoOrigin: best?.offer.merchant.sourceType === 'FIXTURE' ? 'fictief' : 'bron',
    priceAnalysis: analysis
      ? {
          statements: priceStatements(analysis, now),
          numberOfObservedPrices: analysis.numberOfObservedPrices,
          numberOfComparedMerchants: analysis.numberOfComparedMerchants,
          historyDays: analysis.historyDays,
          firstSeenAt: analysis.firstSeenAt,
          lastSeenAt: analysis.lastSeenAt,
          lastPriceChangeAt: analysis.lastPriceChangeAt,
          confidenceLevel: analysis.confidenceLevel,
          comparisonBasis: analysis.comparisonBasis,
          calculatedAt: analysis.calculatedAt,
          analysisVersion: analysis.analysisVersion,
        }
      : null,
    sources: {
      labels: [...sourceLabels],
      lastCheckedAt: best?.pricing.checkedAt ?? null,
      priceDataSince: analysis?.firstSeenAt ?? null,
      merchantCount: new Set(usableOffers.map((offer) => offer.merchant.id)).size,
      experienceType: product.experienceType,
    },
    offers: usableOffers
      .map((offer) => ({
        offerId: offer.id,
        merchantName: offer.merchant.name,
        pricing: computeDealPricing(offer, now),
        shippingLabel:
          offer.shippingCost === null
            ? null
            : (toCents(offer.shippingCost) ?? 0) === 0
              ? 'gratis verzending'
              : `+ ${formatMoney(toCents(offer.shippingCost) ?? 0)} verzending`,
        availabilityLabel: offer.availabilityLabel,
        isCheapest: offer.id === cheapestOfferId,
      }))
      .sort((left, right) => left.pricing.currentPriceCents - right.pricing.currentPriceCents),
  }
}

/**
 * Vergelijkbare producten: zelfde categorie, vergelijkbare prijsklasse, en
 * alleen wat publiek geldig is. Bewust op gecontroleerde gegevens en niet op een
 * AI-oordeel.
 */
export async function getComparableProducts(
  product: Pick<ProductDetailView, 'id' | 'category' | 'pricing'>,
  limit = 4,
): Promise<ProductCardView[]> {
  const priceCents = product.pricing?.currentPriceCents ?? null
  const candidates = await prisma.product.findMany({
    where: publicProductFilter({ id: { not: product.id }, primaryCategory: product.category }),
    include: productInclude,
    take: 40,
  })

  const now = new Date()
  const views = candidates.map((entry) => toCardView(entry, { now }))
  if (priceCents === null) return views.slice(0, limit)

  // Zelfde prijsklasse: tot 40% er onder of boven, en op voorraad.
  const inRange = views
    .filter((view) => view.pricing !== null && view.pricing.isActive)
    .map((view) => ({ view, distance: Math.abs((view.pricing?.currentPriceCents ?? 0) - priceCents) }))
    .filter(({ view }) => {
      const value = view.pricing?.currentPriceCents ?? 0
      return value >= priceCents * 0.6 && value <= priceCents * 1.4
    })
    .sort((left, right) => left.distance - right.distance)
    .map(({ view }) => view)

  if (inRange.length >= limit) return inRange.slice(0, limit)
  const rest = views.filter((view) => !inRange.some((entry) => entry.id === view.id))
  return [...inRange, ...rest].slice(0, limit)
}

/** De actuele editie: die van vandaag, of anders de laatst gepubliceerde. */
export async function getCurrentEdition(now: Date = new Date()): Promise<EditionView | null> {
  const today = editionDate(now)
  const edition =
    (await prisma.dailyEdition.findFirst({
      where: { status: 'PUBLISHED', editionDate: today },
      include: { items: { include: { product: { include: productInclude } } } },
    })) ??
    (await prisma.dailyEdition.findFirst({
      where: { status: { in: ['PUBLISHED', 'ARCHIVED'] } },
      orderBy: { editionDate: 'desc' },
      include: { items: { include: { product: { include: productInclude } } } },
    }))

  if (!edition) return null

  // Een editie-item verdwijnt zodra het product niet meer publiek geldig is:
  // teruggetrokken, kapotte afbeelding, of demo-inhoud die uit staat. De editie
  // zelf blijft bestaan.
  const visible = edition.items.filter(
    (item) =>
      checkPublicVisibility({
        status: item.product.status,
        imageStatus: item.product.imageStatus,
        isDemo: item.product.isDemo,
        hasEditorial: item.product.editorial !== null,
      }).visible,
  )
  const sorted = [...visible].sort((left, right) => left.position - right.position)
  const section = (name: string) =>
    sorted
      .filter((item) => item.section === name)
      .map((item) => toCardView(item.product, { now }))
  const heroItem = sorted.find((item) => item.section === 'HERO')

  return {
    editionDate: edition.editionDate,
    isToday: edition.editionDate.getTime() === today.getTime(),
    hero: heroItem ? toCardView(heroItem.product, { isHero: true, now }) : null,
    bestDeals: section('BEST_DEALS'),
    latestPriceDrops: section('LATEST_PRICE_DROPS'),
    editorsPick: section('EDITORS_PICK'),
    under100: section('UNDER_100'),
    unnecessaryButGreat: section('UNNECESSARY_BUT_GREAT'),
    discovery: section('DISCOVERY'),
    today: section('TODAY'),
  }
}

/**
 * De publieke productpagina. Levert `null` voor alles wat niet publiek is;
 * de pagina maakt daar een echte 404 van. Voor het adminpaneel is er
 * {@link getProductBySlugForPreview}.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetailView | null> {
  const product = await prisma.product.findUnique({ where: { slug }, include: productInclude })
  if (!product) return null

  const verdict = checkPublicVisibility({
    status: product.status,
    imageStatus: product.imageStatus,
    isDemo: product.isDemo,
    hasEditorial: product.editorial !== null,
  })
  if (!verdict.visible) return null

  const now = new Date()
  const offerIds = product.offers.map((offer) => offer.id)
  const snapshots =
    offerIds.length === 0
      ? []
      : await prisma.priceSnapshot.findMany({
          where: { offerId: { in: offerIds } },
          orderBy: { capturedAt: 'desc' },
          take: 8,
        })

  const history: PriceHistoryPoint[] = snapshots
    .map((snapshot) => {
      const cents = toCents(snapshot.price) ?? 0
      return {
        capturedAt: snapshot.capturedAt,
        priceCents: cents,
        priceLabel: formatMoney(cents),
      }
    })
    .reverse()

  return toDetailView(product, now, history)
}

export async function getRelatedProducts(
  product: Pick<ProductDetailView, 'id' | 'category'>,
  limit = 4,
): Promise<ProductCardView[]> {
  const products = await prisma.product.findMany({
    where: publicProductWhere({
      id: { not: product.id },
      primaryCategory: product.category,
    }),
    include: productInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  if (products.length >= limit) return products.map((entry) => toCardView(entry))

  const filler = await prisma.product.findMany({
    where: publicProductWhere({
      id: { notIn: [product.id, ...products.map((entry) => entry.id)] },
    }),
    include: productInclude,
    orderBy: { createdAt: 'desc' },
    take: limit - products.length,
  })
  return [...products, ...filler].map((entry) => toCardView(entry))
}

export type CategoryResult = {
  items: ProductCardView[]
  total: number
  page: number
  perPage: number
  hasMore: boolean
}

/** Producten voor een categoriepagina, met sortering, filters en paginering. */
export async function getCategoryProducts(
  categoryName: string,
  filters: CategoryFilters,
): Promise<CategoryResult> {
  const where = publicProductWhere({ primaryCategory: categoryName })
  const now = new Date()
  const products = await prisma.product.findMany({ where, include: productInclude })

  let views = products.map((product) => toCardView(product, { now }))
  if (filters.onlyDeals) {
    views = views.filter((view) => view.pricing?.qualifiesAsDeal === true)
  }
  if (filters.maxPriceCents !== undefined) {
    const max = filters.maxPriceCents
    views = views.filter((view) => (view.pricing?.currentPriceCents ?? Number.MAX_SAFE_INTEGER) <= max)
  }

  views.sort((left, right) => {
    if (filters.sort === 'korting') {
      return (right.pricing?.discountPercentage ?? 0) - (left.pricing?.discountPercentage ?? 0)
    }
    if (filters.sort === 'prijs-laag') {
      return (
        (left.pricing?.currentPriceCents ?? Number.MAX_SAFE_INTEGER) -
        (right.pricing?.currentPriceCents ?? Number.MAX_SAFE_INTEGER)
      )
    }
    if (filters.sort === 'populair') {
      // Echte data: saves. Bij gelijke stand vallen we terug op nieuwste.
      if (right.saveCount !== left.saveCount) return right.saveCount - left.saveCount
      return right.createdAt.getTime() - left.createdAt.getTime()
    }
    return right.createdAt.getTime() - left.createdAt.getTime()
  })

  const total = views.length
  const start = (filters.page - 1) * filters.perPage
  const items = views.slice(start, start + filters.perPage)
  return { items, total, page: filters.page, perPage: filters.perPage, hasMore: start + items.length < total }
}

/** Zoekt server-side in titel, merk, model, categorie, tags en headline. */
export async function searchProducts(query: string, limit = 36): Promise<ProductCardView[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const products = await prisma.product.findMany({
    where: publicProductWhere({
      OR: [
        { title: { contains: trimmed, mode: 'insensitive' } },
        { brand: { contains: trimmed, mode: 'insensitive' } },
        { model: { contains: trimmed, mode: 'insensitive' } },
        { primaryCategory: { contains: trimmed, mode: 'insensitive' } },
        { normalizedTitle: { contains: trimmed.toLowerCase() } },
        { editorial: { headline: { contains: trimmed, mode: 'insensitive' } } },
        { editorial: { teaser: { contains: trimmed, mode: 'insensitive' } } },
      ],
    }),
    include: productInclude,
    take: limit,
  })

  const tagMatches = await prisma.product.findMany({
    where: publicProductWhere({
      id: { notIn: products.map((product) => product.id) },
      editorial: { tags: { array_contains: trimmed.toLowerCase() } },
    }),
    include: productInclude,
    take: Math.max(0, limit - products.length),
  })

  return [...products, ...tagMatches].map((product) => toCardView(product))
}

export async function getNewProducts(limit = 24): Promise<ProductCardView[]> {
  const products = await prisma.product.findMany({
    where: publicProductWhere(),
    include: productInclude,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
  return products.map((product) => toCardView(product))
}

export async function getCollectionProducts(collectionSlug: string, limit = 12): Promise<ProductCardView[]> {
  const products = await prisma.product.findMany({
    where: publicProductWhere({ collections: { has: collectionSlug } }),
    include: productInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return products.map((product) => toCardView(product))
}

export type PopularResult = {
  items: ProductCardView[]
  /** True wanneer de lijst op echte save- en klikdata is gebaseerd. */
  isReal: boolean
}

/**
 * Populaire producten op basis van echte saves en clicks. Is er te weinig echte
 * data, dan tonen we redactiefavorieten en geen verzonnen aantallen.
 */
export async function getPopularProducts(limit = 8): Promise<PopularResult> {
  const [saves, clicks] = await Promise.all([
    prisma.anonymousSave.groupBy({ by: ['productId'], _count: { productId: true } }),
    prisma.outboundClick.groupBy({ by: ['productId'], _count: { productId: true } }),
  ])

  const weights = new Map<string, number>()
  for (const entry of saves) {
    weights.set(entry.productId, (weights.get(entry.productId) ?? 0) + entry._count.productId * 2)
  }
  for (const entry of clicks) {
    weights.set(entry.productId, (weights.get(entry.productId) ?? 0) + entry._count.productId)
  }

  const ranked = [...weights.entries()].sort(([, left], [, right]) => right - left).slice(0, limit)
  const hasEnoughRealData = ranked.length >= limit && (ranked[0]?.[1] ?? 0) >= MIN_VISIBLE_SAVE_COUNT

  if (hasEnoughRealData) {
    const products = await prisma.product.findMany({
      where: publicProductWhere({ id: { in: ranked.map(([id]) => id) } }),
      include: productInclude,
    })
    const order = new Map(ranked.map(([id], index) => [id, index]))
    const items = products
      .map((product) => toCardView(product))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
    if (items.length === limit) return { items, isReal: true }
  }

  const products = await prisma.product.findMany({
    where: publicProductWhere(),
    include: productInclude,
    take: 60,
  })
  const items = products
    .map((product) => ({ product, score: editorialScore(product) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => toCardView(entry.product))
  return { items, isReal: false }
}

export async function getSavedProducts(visitorId: string): Promise<ProductCardView[]> {
  if (!visitorId) return []
  const saves = await prisma.anonymousSave.findMany({
    where: { anonymousVisitorId: visitorId },
    orderBy: { createdAt: 'desc' },
    include: { product: { include: productInclude } },
  })
  const showDemo = demoContentEnabled()
  return saves
    .filter((save) => save.product.status !== 'REJECTED')
    .filter((save) => showDemo || !save.product.isDemo)
    .map((save) => toCardView(save.product))
}

export async function getSavedProductIds(visitorId: string): Promise<string[]> {
  if (!visitorId) return []
  const saves = await prisma.anonymousSave.findMany({
    where: { anonymousVisitorId: visitorId },
    select: { productId: true },
  })
  return saves.map((save) => save.productId)
}

/**
 * Voor de sitemap: alleen producten die publiek geldig zijn én geen demo-inhoud.
 * Een product met een kapotte afbeelding of zonder content staat er dus niet in.
 */
export async function getIndexableProducts(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.product.findMany({
    where: publicProductFilter({ isDemo: false }),
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function countPublishedProducts(): Promise<number> {
  return prisma.product.count({ where: { status: 'PUBLISHED' } })
}
