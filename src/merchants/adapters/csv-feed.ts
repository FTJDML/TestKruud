import { parseCsv } from '@/lib/scraping/csv'
import { fetchText } from '@/lib/scraping/http'
import { mapRow } from '@/merchants/adapters/mapping'
import { csvFeedConfigSchema } from '@/merchants/schemas/feed-config'
import type { AdapterContext, AdapterResult, MerchantAdapter, NormalizedItem } from '@/merchants/types'

/** Generieke CSV-feedadapter; kolomnamen komen uit de merchantconfiguratie. */
export const csvFeedAdapter: MerchantAdapter = {
  sourceType: 'CSV',
  validate(context) {
    const errors: string[] = []
    if (!context.merchant.feedUrl) errors.push('feedUrl ontbreekt')
    const parsed = csvFeedConfigSchema.safeParse(context.merchant.configuration)
    if (!parsed.success) {
      errors.push(
        ...parsed.error.issues.map((issue) => `configuration.${issue.path.join('.')}: ${issue.message}`),
      )
    }
    return errors
  },
  async fetchItems(context: AdapterContext): Promise<AdapterResult> {
    const config = csvFeedConfigSchema.parse(context.merchant.configuration)
    if (!context.merchant.feedUrl) throw new Error('feedUrl ontbreekt')

    const body = await fetchText(context.merchant.feedUrl, { headers: { accept: 'text/csv' } })
    const rows = parseCsv(body, config.delimiter)
    const selected = context.limit ? rows.slice(0, context.limit) : rows

    const items: NormalizedItem[] = []
    const warnings: string[] = []
    if (rows.length === 0) warnings.push('CSV-feed bevatte geen rijen')

    for (const row of selected) {
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
