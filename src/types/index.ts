import type { ConfidenceLevel, ExperienceType } from '@prisma/client'
import type { DealPricing } from '@/lib/pricing/deal'
import type { PriceStatement } from '@/lib/analysis/statements'
import type { DemoOrigin } from '@/components/ui/DemoNotice'

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
  /**
   * Herkomst van demo-inhoud: fictieve fixtures of een echt ingelezen open
   * catalogus. Bepaalt welke demo-melding klopt op de productpagina.
   */
  demoOrigin: DemoOrigin
  /** Onze eigen prijsanalyse; null zolang er geen meting is. */
  priceAnalysis: ProductPriceAnalysisView | null
  /** Waar de gegevens op deze pagina vandaan komen. */
  sources: ProductSourcesView
  /** Alle aanbiedingen, gesorteerd op prijs. */
  offers: Array<{
    offerId: string
    merchantName: string
    pricing: DealPricing
    /** Alleen gevuld wanneer de bron verzendkosten betrouwbaar meelevert. */
    shippingLabel: string | null
    /** Voorraadtekst uit de bron, wanneer beschikbaar. */
    availabilityLabel: string | null
    isCheapest: boolean
  }>
}

/** Wat wij zelf over de prijs hebben gemeten; alleen echte gegevens. */
export type ProductPriceAnalysisView = {
  statements: PriceStatement[]
  numberOfObservedPrices: number
  numberOfComparedMerchants: number
  historyDays: number
  firstSeenAt: Date | null
  lastSeenAt: Date | null
  lastPriceChangeAt: Date | null
  confidenceLevel: ConfidenceLevel
  /** Waarop de vergelijking tussen aanbieders is gebaseerd. */
  comparisonBasis: 'prijs' | 'prijs-en-verzending'
  calculatedAt: Date
  analysisVersion: string
}

export type ProductSourcesView = {
  /** Bijvoorbeeld "merchantfeed" of "eigen prijsmeting". */
  labels: string[]
  lastCheckedAt: Date | null
  /** Sinds wanneer wij prijzen van dit product hebben. */
  priceDataSince: Date | null
  merchantCount: number
  experienceType: ExperienceType
}

export type EditionView = {
  editionDate: Date
  isToday: boolean
  hero: ProductCardView | null
  /** Geverifieerde deals: geldige referentieprijs, actief en op voorraad. */
  bestDeals: ProductCardView[]
  /** Door ons gemeten prijsdalingen van de afgelopen dagen. */
  latestPriceDrops: ProductCardView[]
  editorsPick: ProductCardView[]
  under100: ProductCardView[]
  unnecessaryButGreat: ProductCardView[]
  /** Bijzondere producten zonder referentieprijs; nooit met een kortingsclaim. */
  discovery: ProductCardView[]
  /** Historische sectie uit oudere edities; wordt bij BEST_DEALS getoond. */
  today: ProductCardView[]
}

export type SortOption = 'nieuwste' | 'korting' | 'populair' | 'prijs-laag'

export type CategoryFilters = {
  sort: SortOption
  maxPriceCents?: number
  onlyDeals?: boolean
  page: number
  perPage: number
}
