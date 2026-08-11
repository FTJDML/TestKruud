import * as cheerio from 'cheerio'
import { fetchFeed } from '@/lib/scraping/authenticated-http'
import { mapRow } from '@/merchants/adapters/mapping'
import { xmlFeedConfigSchema } from '@/merchants/schemas/feed-config'
import { findLiteralSecrets } from '@/merchants/schemas/feed-config'
import type { AdapterContext, AdapterResult, MerchantAdapter, NormalizedItem } from '@/merchants/types'

/**
 * Generieke XML-feedadapter. Werkt met de vormen die affiliatenetwerken en
 * webshops leveren: Google Shopping (`<item><g:price>`), eigen productfeeds en
 * netwerk-exports.
 *
 * Padsyntaxis in de mapping:
 *
 * - `price` — tekst van het kindelement `price`;
 * - `offer.price` — genest element;
 * - `g:price` — element met namespace-prefix;
 * - `@id` — attribuut van het item zelf;
 * - `image@href` — attribuut van een kindelement.
 *
 * Parsing gebruikt cheerio in XML-modus; er komt geen extra dependency bij.
 */
type XmlRow = {
  element: cheerio.Cheerio<never>
}

/** Leest één pad binnen een XML-item. */
export function readXmlPath(row: unknown, path: string): unknown {
  const { element } = row as XmlRow
  const trimmed = path.trim()
  if (trimmed.length === 0) return undefined

  // Attribuut van het item zelf.
  if (trimmed.startsWith('@')) {
    return element.attr(trimmed.slice(1))
  }

  const [selectorPart, attribute] = trimmed.split('@')
  const selector = (selectorPart ?? '')
    .split('.')
    .filter((part) => part.length > 0)
    // Namespace-prefixen escapen: g:price is in CSS g\\:price.
    .map((part) => part.replace(/:/g, '\\:'))
    .join(' ')
  if (selector.length === 0) return undefined

  const found = element.find(selector).first()
  if (found.length === 0) return undefined
  if (attribute) return found.attr(attribute)
  const text = found.text()
  return text.length > 0 ? text : undefined
}

export const xmlFeedAdapter: MerchantAdapter = {
  sourceType: 'XML',
  validate(context) {
    const errors: string[] = []
    if (!context.merchant.feedUrl) errors.push('feedUrl ontbreekt')
    const parsed = xmlFeedConfigSchema.safeParse(context.merchant.configuration)
    if (!parsed.success) {
      errors.push(
        ...parsed.error.issues.map((issue) => `configuration.${issue.path.join('.')}: ${issue.message}`),
      )
    }
    errors.push(
      ...findLiteralSecrets(context.merchant.configuration).map(
        (problem) => `${problem.path}: ${problem.message}`,
      ),
    )
    return errors
  },
  async fetchItems(context: AdapterContext): Promise<AdapterResult> {
    const config = xmlFeedConfigSchema.parse(context.merchant.configuration)
    if (!context.merchant.feedUrl) throw new Error('feedUrl ontbreekt')

    const feed = await fetchFeed({
      url: context.merchant.feedUrl,
      auth: config.auth,
      headers: config.headers,
      compression: config.compression,
      accept: 'application/xml,text/xml,application/rss+xml,*/*',
    })

    const $ = cheerio.load(feed.body, { xmlMode: true })
    const selector = config.itemSelector.replace(/:/g, '\\:')
    const elements = $(selector).toArray()
    const selected = context.limit ? elements.slice(0, context.limit) : elements

    const items: NormalizedItem[] = []
    const warnings: string[] = []
    if (elements.length === 0) {
      warnings.push(`selector "${config.itemSelector}" leverde geen items op`)
    }

    for (const element of selected) {
      const result = mapRow({ element: $(element) as unknown as cheerio.Cheerio<never> }, config.mapping, {
        categoryMapping: config.categoryMapping,
        defaultCurrency: config.defaultCurrency,
        baseUrl: `https://${context.merchant.domain}`,
        read: readXmlPath,
      })
      if (result.item) items.push(result.item)
      else if (result.warning) warnings.push(result.warning)
    }

    return { items, warnings }
  },
}
