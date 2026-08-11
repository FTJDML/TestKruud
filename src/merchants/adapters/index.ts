import type { SourceType } from '@prisma/client'
import type { MerchantAdapter } from '@/merchants/types'
import { csvFeedAdapter } from '@/merchants/adapters/csv-feed'
import { fixtureAdapter } from '@/merchants/adapters/fixture'
import { htmlAdapter } from '@/merchants/adapters/html'
import { jsonFeedAdapter } from '@/merchants/adapters/json-feed'
import { xmlFeedAdapter } from '@/merchants/adapters/xml-feed'

/**
 * Registry van adapters. Een nieuwe merchantbron toevoegen betekent: adapter
 * schrijven, hier registreren en een Merchant-record met configuratie maken.
 * Zie README, sectie "Nieuwe merchant toevoegen".
 */
const registry: Partial<Record<SourceType, MerchantAdapter>> = {
  FIXTURE: fixtureAdapter,
  JSON: jsonFeedAdapter,
  CSV: csvFeedAdapter,
  XML: xmlFeedAdapter,
  HTML: htmlAdapter,
}

export function adapterFor(sourceType: SourceType): MerchantAdapter | null {
  return registry[sourceType] ?? null
}

export const supportedSourceTypes = Object.keys(registry) as SourceType[]

export { csvFeedAdapter, fixtureAdapter, htmlAdapter, jsonFeedAdapter, xmlFeedAdapter }
