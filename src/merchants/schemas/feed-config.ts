import { z } from 'zod'
import type { ReferencePriceType } from '@prisma/client'

const referencePriceTypes = [
  'MERCHANT_WAS_PRICE',
  'RECOMMENDED_RETAIL_PRICE',
  'OWN_PREVIOUS_PRICE',
  'OWN_30_DAY_LOW',
  'OWN_90_DAY_MEDIAN',
] as const satisfies readonly ReferencePriceType[]

/**
 * Veldmapping voor JSON- en CSV-feeds. De configuratie staat per merchant in
 * de database (`Merchant.configuration`), zodat een nieuwe feed geen code vraagt.
 */
export const fieldMappingSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  price: z.string().min(1),
  referencePrice: z.string().optional(),
  referencePriceType: z.enum(referencePriceTypes).default('MERCHANT_WAS_PRICE'),
  currency: z.string().optional(),
  stock: z.string().optional(),
  url: z.string().min(1),
  imageUrl: z.string().min(1),
  imageAlt: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  ean: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  /** Extra velden die als specificatie worden opgeslagen. */
  specifications: z.record(z.string(), z.string()).default({}),
})

export type FieldMapping = z.infer<typeof fieldMappingSchema>

export const jsonFeedConfigSchema = z.object({
  /** Pad naar de array met producten, bijvoorbeeld "data.products". */
  itemsPath: z.string().default(''),
  mapping: fieldMappingSchema,
  categoryMapping: z.record(z.string(), z.string()).default({}),
  defaultCurrency: z.string().length(3).default('EUR'),
})

export const csvFeedConfigSchema = z.object({
  delimiter: z.string().max(1).optional(),
  mapping: fieldMappingSchema,
  categoryMapping: z.record(z.string(), z.string()).default({}),
  defaultCurrency: z.string().length(3).default('EUR'),
})

/**
 * HTML-adapter: CSS-selectors per veld. Werkt alleen wanneer de bron scraping
 * expliciet toestaat (`Merchant.scrapingAllowed`).
 */
export const htmlSelectorSchema = z.object({
  selector: z.string().min(1),
  /** Attribuut in plaats van tekst, bijvoorbeeld "href" of "src". */
  attribute: z.string().optional(),
})

export const htmlConfigSchema = z.object({
  listUrl: z.string().url(),
  itemSelector: z.string().min(1),
  fields: z.object({
    externalId: htmlSelectorSchema.optional(),
    title: htmlSelectorSchema,
    price: htmlSelectorSchema,
    referencePrice: htmlSelectorSchema.optional(),
    referencePriceType: z.enum(referencePriceTypes).default('MERCHANT_WAS_PRICE'),
    url: htmlSelectorSchema,
    imageUrl: htmlSelectorSchema,
    brand: htmlSelectorSchema.optional(),
    category: htmlSelectorSchema.optional(),
    description: htmlSelectorSchema.optional(),
    stock: htmlSelectorSchema.optional(),
  }),
  categoryMapping: z.record(z.string(), z.string()).default({}),
  defaultCurrency: z.string().length(3).default('EUR'),
  /** Gebruik een browser voor bronnen die JavaScript nodig hebben. */
  requiresBrowser: z.boolean().default(false),
})

export type JsonFeedConfig = z.infer<typeof jsonFeedConfigSchema>
export type CsvFeedConfig = z.infer<typeof csvFeedConfigSchema>
export type HtmlConfig = z.infer<typeof htmlConfigSchema>
