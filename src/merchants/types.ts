import type { AffiliateNetwork, ReferencePriceType, SourceType } from '@prisma/client'

/** Genormaliseerd product zoals een adapter het oplevert. */
export type NormalizedProduct = {
  /** Stabiele ID bij de merchant. */
  externalId: string
  title: string
  brand?: string | null
  model?: string | null
  ean?: string | null
  primaryCategory: string
  shortSourceDescription?: string | null
  specifications?: Record<string, string>
  imageUrl: string
  imageAlt: string
  isDemo?: boolean
  collections?: string[]
  /** Alleen gevuld door fixtures met handgeschreven redactionele content. */
  editorialKey?: string
}

/** Genormaliseerde aanbieding; prijzen in hele centen. */
export type NormalizedOffer = {
  externalOfferId: string
  currentPriceCents: number
  referencePriceCents?: number | null
  referencePriceType?: ReferencePriceType | null
  currency: string
  /** Alleen wanneer de bron verzendkosten betrouwbaar meelevert. */
  shippingCostCents?: number | null
  inStock: boolean
  /** Ruwe voorraadtekst uit de bron; alleen voor uitleg in /admin. */
  availabilityLabel?: string | null
  destinationUrl: string
  /** Affiliate-deeplink uit de feed; heeft voorrang op destinationUrl. */
  affiliateUrl?: string | null
  promotionEndsAt?: Date | null
  productGroup?: string | null
  variantId?: string | null
}

export type NormalizedItem = {
  product: NormalizedProduct
  offer: NormalizedOffer
}

export type AdapterContext = {
  merchant: {
    id: string
    slug: string
    name: string
    domain: string
    sourceType: SourceType
    feedUrl: string | null
    scrapingAllowed: boolean
    configuration: Record<string, unknown>
    affiliateNetwork?: AffiliateNetwork
  }
  /** Maximaal aantal items dat de adapter mag opleveren. */
  limit?: number
}

export type AdapterResult = {
  items: NormalizedItem[]
  /** Niet-fatale problemen; de job logt deze en gaat door. */
  warnings: string[]
}

/**
 * Iedere merchantbron implementeert deze interface. Adapters draaien alleen in
 * jobs, nooit tijdens een paginaweergave.
 *
 * Een adapter doet twee dingen en niet meer: de feed **ophalen** en de velden
 * **mappen**. De drie andere onderdelen van een koppeling staan er los van:
 *
 * - authenticatie van het verzoek — `src/lib/scraping/authenticated-http.ts`;
 * - affiliate-links genereren — `src/lib/affiliate/link-builder.ts`;
 * - clicks van een subid voorzien — `src/app/go/[offerId]/route.ts`.
 *
 * Zo blijft een nieuwe merchant een kwestie van configuratie, en een nieuw
 * netwerk een kwestie van één link builder.
 */
export type MerchantAdapter = {
  readonly sourceType: SourceType
  /** Controleert of de configuratie compleet is voordat de job start. */
  validate(context: AdapterContext): string[]
  fetchItems(context: AdapterContext): Promise<AdapterResult>
}
