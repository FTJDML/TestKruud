import { fetchFeed } from '@/lib/scraping/authenticated-http'
import { readPath } from '@/lib/scraping/normalize'
import { mapRow } from '@/merchants/adapters/mapping'
import {
  findLiteralSecrets,
  jsonFeedConfigSchema,
  type JsonFeedConfig,
} from '@/merchants/schemas/feed-config'
import type { AdapterContext, AdapterResult, MerchantAdapter, NormalizedItem } from '@/merchants/types'
import { logger } from '@/lib/logger'

/**
 * Generieke JSON-feedadapter; veldmapping komt uit de merchantconfiguratie.
 * Ondersteunt authenticatie, gzip/zip en gepagineerde REST-API's.
 */
function pagedUrl(base: string, config: JsonFeedConfig, page: number, cursor: string | null): string {
  const pagination = config.pagination
  if (!pagination) return base
  const url = new URL(base)
  if (pagination.style === 'cursor') {
    if (cursor) url.searchParams.set(pagination.parameter, cursor)
  } else {
    const value =
      pagination.style === 'offset' ? pagination.startAt + page * pagination.pageSize : pagination.startAt + page
    url.searchParams.set(pagination.parameter, String(value))
  }
  if (pagination.sizeParameter) {
    url.searchParams.set(pagination.sizeParameter, String(pagination.pageSize))
  }
  return url.toString()
}

function itemsFrom(payload: unknown, itemsPath: string): unknown[] {
  const raw = itemsPath.length > 0 ? readPath(payload, itemsPath) : payload
  if (!Array.isArray(raw)) {
    throw new Error(`JSON-feed leverde geen array op bij pad "${itemsPath}"`)
  }
  return raw
}

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
    errors.push(
      ...findLiteralSecrets(context.merchant.configuration).map(
        (problem) => `${problem.path}: ${problem.message}`,
      ),
    )
    return errors
  },
  async fetchItems(context: AdapterContext): Promise<AdapterResult> {
    const config = jsonFeedConfigSchema.parse(context.merchant.configuration)
    if (!context.merchant.feedUrl) throw new Error('feedUrl ontbreekt')

    const warnings: string[] = []
    const rows: unknown[] = []
    const maxPages = config.pagination?.maxPages ?? 1
    let cursor: string | null = null

    for (let page = 0; page < maxPages; page += 1) {
      const url = pagedUrl(context.merchant.feedUrl, config, page, cursor)
      const feed = await fetchFeed({
        url,
        auth: config.auth,
        headers: config.headers,
        compression: config.compression,
        accept: 'application/json,*/*',
      })

      let payload: unknown
      try {
        payload = JSON.parse(feed.body.replace(/^﻿/, ''))
      } catch (error) {
        throw new Error(`JSON-feed is geen geldige JSON: ${(error as Error).message}`)
      }

      const pageRows = itemsFrom(payload, config.itemsPath)
      rows.push(...pageRows)

      if (!config.pagination) break
      if (pageRows.length === 0) break
      if (config.pagination.style === 'cursor') {
        const next = config.pagination.cursorPath
          ? readPath(payload, config.pagination.cursorPath)
          : undefined
        cursor = typeof next === 'string' && next.length > 0 ? next : null
        if (!cursor) break
      } else if (pageRows.length < config.pagination.pageSize) {
        break
      }
      if (context.limit && rows.length >= context.limit) break
      if (page === maxPages - 1) {
        // Geen stille afkap: de operator moet weten dat er meer was.
        warnings.push(`paginalimiet van ${maxPages} bereikt; er kunnen meer producten zijn`)
        logger.warn('Paginalimiet bereikt', { merchant: context.merchant.slug, maxPages })
      }
    }

    const selected = context.limit ? rows.slice(0, context.limit) : rows
    const items: NormalizedItem[] = []
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
