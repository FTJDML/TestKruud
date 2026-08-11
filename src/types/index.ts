import type { DealPricing } from '@/lib/pricing/deal'

export type BadgeTone = 'accent' | 'deal' | 'neutral'

export type ProductBadge = {
  label: string
  tone: BadgeTone
}

/** Wat een productkaart nodig heeft. Alles is server-side voorbereid. */
export type ProductCardView = {
  id: string
  slug: string
  title: string
  category: string
  categorySlug: string
  headline: string
  teaser: string
  imageUrl: string
  imageAlt: string
  isDemo: boolean
  /** Maximaal één badge per kaart. */
  badge: ProductBadge | null
  merchantName: string
  offerId: string | null
  pricing: DealPricing | null
  /** Echt aantal saves; pas vanaf tien tonen we een getal. */
  saveCount: number
  createdAt: Date
}

export type PriceHistoryPoint = {
  capturedAt: Date
  priceLabel: string
  priceCents: number
}

export type ProductDetailView = ProductCardView & {
  brand: string | null
  model: string | null
  ean: string | null
  longDescription: string
  whyItStandsOut: string
  bestFor: string[]
  caveat: string
  seoTitle: string
  metaDescription: string
  tags: string[]
  specifications: Array<{ label: string; value: string }>
  shortSourceDescription: string | null
  priceHistory: PriceHistoryPoint[]
  updatedAt: Date
  merchantDomain: string
  /** Alle aanbiedingen, gesorteerd op prijs. */
  offers: Array<{
    offerId: string
    merchantName: string
    pricing: DealPricing
  }>
}

export type EditionView = {
  editionDate: Date
  isToday: boolean
  hero: ProductCardView | null
  today: ProductCardView[]
  editorsPick: ProductCardView[]
  under100: ProductCardView[]
  unnecessaryButGreat: ProductCardView[]
}

export type SortOption = 'nieuwste' | 'korting' | 'populair' | 'prijs-laag'

export type CategoryFilters = {
  sort: SortOption
  maxPriceCents?: number
  onlyDeals?: boolean
  page: number
  perPage: number
}
