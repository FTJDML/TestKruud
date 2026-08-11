import * as cheerio from 'cheerio'
import { fetchText } from '@/lib/scraping/http'
import { fetchRenderedHtml } from '@/lib/scraping/browser'
import {
  normalizeCategory,
  normalizePriceCents,
  normalizeStock,
  normalizeText,
  normalizeUrl,
} from '@/lib/scraping/normalize'
import { htmlConfigSchema, type HtmlConfig } from '@/merchants/schemas/feed-config'
import type { AdapterContext, AdapterResult, MerchantAdapter, NormalizedItem } from '@/merchants/types'
import { slugify } from '@/lib/utils'

type Selector = { selector: string; attribute?: string }

/**
 * Minimale structurele vorm van een Cheerio-selectie. Bewust structureel
 * getypeerd: cheerio exporteert het onderliggende nodetype niet, en zo hoeven
 * we geen transitieve dependency te importeren.
 */
type CheerioSelection = {
  find(selector: string): {
    length: number
    first(): { length: number; text(): string; attr(name: string): string | undefined }
  }
}

function extract(item: CheerioSelection, field?: Selector): string | null {
  if (!field) return null
  const node = item.find(field.selector).first()
  if (node.length === 0) return null
  const value = field.attribute ? node.attr(field.attribute) : node.text()
  return normalizeText(value ?? null, 600)
}

/**
 * Configureerbare HTML-adapter met Cheerio. Werkt alleen wanneer de merchant
 * scraping expliciet toestaat. Er wordt nooit gescraped tijdens een
 * paginaweergave: deze adapter draait uitsluitend in jobs.
 */
export const htmlAdapter: MerchantAdapter = {
  sourceType: 'HTML',
  validate(context) {
    const errors: string[] = []
    if (!context.merchant.scrapingAllowed) {
      errors.push('scrapingAllowed staat uit voor deze merchant')
    }
    const parsed = htmlConfigSchema.safeParse(context.merchant.configuration)
    if (!parsed.success) {
      errors.push(
        ...parsed.error.issues.map((issue) => `configuration.${issue.path.join('.')}: ${issue.message}`),
      )
    }
    return errors
  },
  async fetchItems(context: AdapterContext): Promise<AdapterResult> {
    if (!context.merchant.scrapingAllowed) {
      throw new Error(`Scraping is niet toegestaan voor ${context.merchant.slug}`)
    }
    const config: HtmlConfig = htmlConfigSchema.parse(context.merchant.configuration)
    const html = config.requiresBrowser
      ? await fetchRenderedHtml(config.listUrl)
      : await fetchText(config.listUrl, { headers: { accept: 'text/html' } })

    const $ = cheerio.load(html)
    const elements = $(config.itemSelector).toArray()
    const selected = context.limit ? elements.slice(0, context.limit) : elements

    const items: NormalizedItem[] = []
    const warnings: string[] = []
    if (elements.length === 0) warnings.push(`selector "${config.itemSelector}" leverde geen items op`)

    for (const element of selected) {
      const item: CheerioSelection = $(element)
      const title = extract(item, config.fields.title)
      const priceCents = normalizePriceCents(extract(item, config.fields.price))
      // Bronnen zonder losse productlink verwijzen naar de overzichtspagina.
      const destinationUrl = normalizeUrl(extract(item, config.fields.url), config.listUrl) ?? config.listUrl
      const imageUrl = normalizeUrl(
        extract(item, config.fields.imageUrl),
        config.imageBaseUrl ?? config.listUrl,
      )

      if (!title || priceCents === null || priceCents <= 0 || !imageUrl) {
        warnings.push(`item overgeslagen: ontbrekende titel, prijs, URL of afbeelding (${title ?? 'onbekend'})`)
        continue
      }

      const explicitId = extract(item, config.fields.externalId)
      const externalId = explicitId ?? slugify(`${title}-${new URL(destinationUrl).pathname}`)
      const referencePriceCents = normalizePriceCents(extract(item, config.fields.referencePrice))
      const stockText = extract(item, config.fields.stock)

      items.push({
        product: {
          externalId,
          title,
          brand: extract(item, config.fields.brand),
          model: null,
          ean: null,
          primaryCategory: normalizeCategory(
            extract(item, config.fields.category),
            config.categoryMapping,
          ),
          shortSourceDescription: extract(item, config.fields.description),
          specifications: {},
          imageUrl,
          imageAlt: title,
          isDemo: config.markAsDemo,
          collections: [],
        },
        offer: {
          externalOfferId: externalId,
          currentPriceCents: priceCents,
          referencePriceCents:
            referencePriceCents !== null && referencePriceCents > priceCents ? referencePriceCents : null,
          referencePriceType:
            referencePriceCents !== null && referencePriceCents > priceCents
              ? config.fields.referencePriceType
              : null,
          currency: config.defaultCurrency,
          inStock: stockText === null ? true : normalizeStock(stockText),
          destinationUrl,
          affiliateUrl: null,
          promotionEndsAt: null,
        },
      })
    }

    return { items, warnings }
  },
}
