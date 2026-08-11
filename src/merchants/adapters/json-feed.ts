import { fetchJson } from '@/lib/scraping/http'
import { readPath } from '@/lib/scraping/normalize'
import { mapRow } from '@/merchants/adapters/mapping'
import { jsonFeedConfigSchema } from '@/merchants/schemas/feed-config'
import type { AdapterContext, AdapterResult, MerchantAdapter, NormalizedItem } from '@/merchants/types'

/** Generieke JSON-feedadapter; veldmapping komt uit de merchantconfiguratie. */
export const jsonFeedAdapter: MerchantAdapter = {
  sourceType: 'JSON',
  validate(context) {
    const errors: string[] = []
    if (!context.merchant.feedUrl) errors.push('feedUrl ontbreekt')
    const parsed = jsonFeedConfigSchema.safeParse(context.merchant.configuration)
    if (!parsed.success) {
      errors.push(
        ...parsed.error.issues.map((issue) => `configuration.${issue.path.join('.')}: ${issue.message}`),
      )
    }
    return errors
  },
  async fetchItems(context: AdapterContext): Promise<AdapterResult> {
    const config = jsonFeedConfigSchema.parse(context.merchant.configuration)
    if (!context.merchant.feedUrl) throw new Error('feedUrl ontbreekt')

    const payload = await fetchJson(context.merchant.feedUrl)
    const raw = config.itemsPath.length > 0 ? readPath(payload, config.itemsPath) : payload
    if (!Array.isArray(raw)) {
      throw new Error(`JSON-feed leverde geen array op bij pad "${config.itemsPath}"`)
    }

    const rows = context.limit ? raw.slice(0, context.limit) : raw
    const items: NormalizedItem[] = []
    const warnings: string[] = []
    for (const row of rows) {
      const result = mapRow(row, config.mapping, {
        categoryMapping: config.categoryMapping,
        defaultCurrency: config.defaultCurrency,
        baseUrl: `https://${context.merchant.domain}`,
      })
      if (result.item) items.push(result.item)
      else if (result.warning) warnings.push(result.warning)
    }
    return { items, warnings }
  },
}
