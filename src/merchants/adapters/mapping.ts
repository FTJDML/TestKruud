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

/**
 * Zet één rij uit een feed om naar genormaliseerde product- en aanbiedingsdata.
 * Rijen zonder prijs, afbeelding of URL worden overgeslagen in plaats van
 * half opgeslagen.
 */
export function mapRow(
  row: unknown,
  mapping: FieldMapping,
  options: {
    categoryMapping: Record<string, string>
    defaultCurrency: string
    baseUrl?: string
  },
): MappingResult {
  const read = (path?: string): unknown => (path ? readPath(row, path) : undefined)

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
        inStock: mapping.stock ? normalizeStock(read(mapping.stock)) : true,
        destinationUrl,
        affiliateUrl: null,
        promotionEndsAt: null,
      },
    },
  }
}
