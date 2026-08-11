import { parseCsv } from '@/lib/scraping/csv'
import { fetchFeed } from '@/lib/scraping/authenticated-http'
import { mapRow } from '@/merchants/adapters/mapping'
import { csvFeedConfigSchema, findLiteralSecrets } from '@/merchants/schemas/feed-config'
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
    errors.push(
      ...findLiteralSecrets(context.merchant.configuration).map(
        (problem) => `${problem.path}: ${problem.message}`,
      ),
    )
    return errors
  },
  async fetchItems(context: AdapterContext): Promise<AdapterResult> {
    const config = csvFeedConfigSchema.parse(context.merchant.configuration)
    if (!context.merchant.feedUrl) throw new Error('feedUrl ontbreekt')

    const feed = await fetchFeed({
      url: context.merchant.feedUrl,
      auth: config.auth,
      headers: config.headers,
      compression: config.compression,
      accept: 'text/csv,text/plain,*/*',
    })
    const rows = parseCsv(feed.body, config.delimiter)
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
