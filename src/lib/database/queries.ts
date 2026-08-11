import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/database/client'
import { categorySlugForName } from '@/lib/categories'
import { computeDealPricing, discountBadgeLabel, type DealPricing } from '@/lib/pricing/deal'
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

/** Nieuw ontdekt: producten die we minder dan drie dagen kennen. */
const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

const productInclude = {
  editorial: true,
  offers: {
    orderBy: { currentPrice: 'asc' },
    include: { merchant: { select: { name: true, domain: true, enabled: true } } },
  },
  _count: { select: { saves: true } },
} satisfies Prisma.ProductInclude

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>

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
  const discountLabel = discountBadgeLabel(pricing?.discountPercentage ?? null)
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
    teaser: product.editorial?.teaser ?? product.shortSourceDescription ?? '',
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
    metaDescription: product.editorial?.metaDescription ?? product.shortSourceDescription ?? '',
    tags: jsonStringArray(product.editorial?.tags ?? null),
    specifications,
    shortSourceDescription: product.shortSourceDescription,
    priceHistory: history,
    updatedAt: product.updatedAt,
    merchantDomain: best?.offer.merchant.domain ?? '',
    offers: product.offers
      .filter((offer) => offer.merchant.enabled)
      .map((offer) => ({
        offerId: offer.id,
        merchantName: offer.merchant.name,
        pricing: computeDealPricing(offer, now),
      }))
      .sort((left, right) => left.pricing.currentPriceCents - right.pricing.currentPriceCents),
  }
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

  const sorted = [...edition.items].sort((left, right) => left.position - right.position)
  const section = (name: string) =>
    sorted
      .filter((item) => item.section === name)
      .map((item) => toCardView(item.product, { now }))
  const heroItem = sorted.find((item) => item.section === 'HERO')

  return {
    editionDate: edition.editionDate,
    isToday: edition.editionDate.getTime() === today.getTime(),
    hero: heroItem ? toCardView(heroItem.product, { isHero: true, now }) : null,
    today: section('TODAY'),
    editorsPick: section('EDITORS_PICK'),
    under100: section('UNDER_100'),
    unnecessaryButGreat: section('UNNECESSARY_BUT_GREAT'),
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetailView | null> {
  const product = await prisma.product.findUnique({ where: { slug }, include: productInclude })
  if (!product) return null
  if (product.status === 'REJECTED' || product.status === 'CANDIDATE') return null

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
    where: {
      status: 'PUBLISHED',
      id: { not: product.id },
      primaryCategory: product.category,
    },
    include: productInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  if (products.length >= limit) return products.map((entry) => toCardView(entry))

  const filler = await prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      id: { notIn: [product.id, ...products.map((entry) => entry.id)] },
    },
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
  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED',
    primaryCategory: categoryName,
  }
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
    where: {
      status: 'PUBLISHED',
      OR: [
        { title: { contains: trimmed, mode: 'insensitive' } },
        { brand: { contains: trimmed, mode: 'insensitive' } },
        { model: { contains: trimmed, mode: 'insensitive' } },
        { primaryCategory: { contains: trimmed, mode: 'insensitive' } },
        { normalizedTitle: { contains: trimmed.toLowerCase() } },
        { editorial: { headline: { contains: trimmed, mode: 'insensitive' } } },
        { editorial: { teaser: { contains: trimmed, mode: 'insensitive' } } },
      ],
    },
    include: productInclude,
    take: limit,
  })

  const tagMatches = await prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      id: { notIn: products.map((product) => product.id) },
      editorial: { tags: { array_contains: trimmed.toLowerCase() } },
    },
    include: productInclude,
    take: Math.max(0, limit - products.length),
  })

  return [...products, ...tagMatches].map((product) => toCardView(product))
}

export async function getNewProducts(limit = 24): Promise<ProductCardView[]> {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
    include: productInclude,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
  return products.map((product) => toCardView(product))
}

export async function getCollectionProducts(collectionSlug: string, limit = 12): Promise<ProductCardView[]> {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', collections: { has: collectionSlug } },
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
      where: { status: 'PUBLISHED', id: { in: ranked.map(([id]) => id) } },
      include: productInclude,
    })
    const order = new Map(ranked.map(([id], index) => [id, index]))
    const items = products
      .map((product) => toCardView(product))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
    if (items.length === limit) return { items, isReal: true }
  }

  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
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
  return saves
    .filter((save) => save.product.status !== 'REJECTED')
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

/** Voor sitemap: alleen publiceerbare, niet-demo producten. */
export async function getIndexableProducts(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return prisma.product.findMany({
    where: { status: 'PUBLISHED', isDemo: false },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function countPublishedProducts(): Promise<number> {
  return prisma.product.count({ where: { status: 'PUBLISHED' } })
}
