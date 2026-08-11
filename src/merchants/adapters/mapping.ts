import type { FieldMapping } from '@/merchants/schemas/feed-config'
import type { NormalizedItem } from '@/merchants/types'
import {
  normalizeCategory,
  normalizeEan,
  normalizePriceCents,
  normalizeStock,
  normalizeText,
  normalizeUrl,
  readPath,
} from '@/lib/scraping/normalize'

export type MappingResult = {
  item: NormalizedItem | null
  /** Reden waarom een rij is overgeslagen. */
  warning?: string
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Zet één rij uit een feed om naar genormaliseerde product- en aanbiedingsdata.
 * Rijen zonder prijs, afbeelding of URL worden overgeslagen in plaats van
 * half opgeslagen.
 *
 * `read` is de enige plek die weet hoe een pad in de bron wordt gelezen; JSON,
 * CSV en XML leveren elk hun eigen implementatie.
 */
export function mapRow(
  row: unknown,
  mapping: FieldMapping,
  options: {
    categoryMapping: Record<string, string>
    defaultCurrency: string
    baseUrl?: string
    /** Alternatieve lezer, bijvoorbeeld voor XML-paden. */
    read?: (row: unknown, path: string) => unknown
  },
): MappingResult {
  const reader = options.read ?? readPath
  const read = (path?: string): unknown => (path ? reader(row, path) : undefined)

  const externalId = normalizeText(read(mapping.externalId), 120)
  const title = normalizeText(read(mapping.title), 240)
  const currentPriceCents = normalizePriceCents(read(mapping.price))
  const destinationUrl = normalizeUrl(read(mapping.url), options.baseUrl)
  const imageUrl = normalizeUrl(read(mapping.imageUrl), options.baseUrl)

  if (!externalId) return { item: null, warning: 'rij zonder product-ID' }
  if (!title) return { item: null, warning: `rij ${externalId} zonder titel` }
  if (currentPriceCents === null || currentPriceCents <= 0) {
    return { item: null, warning: `rij ${externalId} zonder betrouwbare prijs` }
  }
  if (!destinationUrl) return { item: null, warning: `rij ${externalId} zonder geldige product-URL` }
  if (!imageUrl) return { item: null, warning: `rij ${externalId} zonder bruikbare afbeelding` }

  const referencePriceCents = normalizePriceCents(read(mapping.referencePrice))
  const specifications: Record<string, string> = {}
  for (const [label, path] of Object.entries(mapping.specifications)) {
    const value = normalizeText(read(path), 160)
    if (value) specifications[label] = value
  }

  const currencyRaw = normalizeText(read(mapping.currency), 3)
  const currency = currencyRaw && currencyRaw.length === 3 ? currencyRaw.toUpperCase() : options.defaultCurrency

  // Een feed levert de affiliate-deeplink onder verschillende namen; beide
  // mappings leiden naar hetzelfde veld.
  const affiliateUrl =
    normalizeUrl(read(mapping.affiliateUrl), options.baseUrl) ??
    normalizeUrl(read(mapping.deeplink), options.baseUrl)

  const stockValue = read(mapping.stock)
  const availabilityLabel = normalizeText(read(mapping.availability), 120)

  return {
    item: {
      product: {
        externalId,
        title,
        brand: normalizeText(read(mapping.brand), 80),
        model: normalizeText(read(mapping.model), 80),
        ean: normalizeEan(read(mapping.ean)),
        primaryCategory: normalizeCategory(read(mapping.category), options.categoryMapping),
        shortSourceDescription: normalizeText(read(mapping.description), 600),
        specifications,
        imageUrl,
        imageAlt: normalizeText(read(mapping.imageAlt), 200) ?? title,
        isDemo: false,
        collections: [],
      },
      offer: {
        externalOfferId: externalId,
        currentPriceCents,
        // Een referentieprijs die niet hoger is dan de huidige prijs bewaren we niet.
        referencePriceCents:
          referencePriceCents !== null && referencePriceCents > currentPriceCents ? referencePriceCents : null,
        referencePriceType:
          referencePriceCents !== null && referencePriceCents > currentPriceCents
            ? mapping.referencePriceType
            : null,
        currency,
        // Verzendkosten alleen wanneer de feed ze echt meelevert; 0 is ook een
        // waarde ("gratis verzending"), undefined is dat niet.
        shippingCostCents: normalizePriceCents(read(mapping.shippingCost)),
        inStock: mapping.stock
          ? normalizeStock(stockValue)
          : availabilityLabel
            ? normalizeStock(availabilityLabel)
            : true,
        availabilityLabel,
        destinationUrl,
        affiliateUrl,
        promotionEndsAt: parseDate(read(mapping.promotionEndsAt)),
        productGroup: normalizeText(read(mapping.productGroup), 120),
        variantId: normalizeText(read(mapping.variantId), 120),
      },
    },
  }
}
