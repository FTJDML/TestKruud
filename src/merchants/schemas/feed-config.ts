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
 * Verwijzing naar een environment variable. In `Merchant.configuration` staan
 * nooit secrets zelf: alleen de naam van de variabele waar het secret in staat.
 * Zo kan de configuratie in de database en in een back-up staan zonder risico.
 */
const envVarName = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'gebruik de NAAM van een environment variable, geen waarde')

/** Authenticatie voor feeds en API’s. Waarden komen uit de environment. */
export const feedAuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('basic'),
    usernameEnv: envVarName,
    passwordEnv: envVarName,
  }),
  z.object({
    type: z.literal('bearer'),
    tokenEnv: envVarName,
  }),
  z.object({
    type: z.literal('apiKey'),
    /** Bijvoorbeeld "X-Api-Key" of "Ocp-Apim-Subscription-Key". */
    headerName: z.string().min(1).max(80),
    valueEnv: envVarName,
  }),
])

export type FeedAuth = z.infer<typeof feedAuthSchema>

/** Losse requestheaders. Nooit een secret: gebruik daarvoor `auth`. */
const extraHeadersSchema = z.record(z.string().min(1).max(80), z.string().max(200)).default({})

/** Hoe een gepagineerde REST-API doorbladert. */
export const paginationSchema = z
  .object({
    style: z.enum(['page', 'offset', 'cursor']),
    /** Queryparameter voor het paginanummer of de offset. */
    parameter: z.string().min(1).default('page'),
    /** Queryparameter voor de paginagrootte; leeg betekent: niet meesturen. */
    sizeParameter: z.string().min(1).optional(),
    pageSize: z.coerce.number().int().positive().max(500).default(100),
    startAt: z.coerce.number().int().min(0).default(1),
    maxPages: z.coerce.number().int().positive().max(100).default(10),
    /** Pad naar de cursor in het antwoord, bijvoorbeeld "meta.next". */
    cursorPath: z.string().optional(),
  })
  .optional()

export type PaginationConfig = z.infer<typeof paginationSchema>

/** Compressie van het feedbestand. `auto` kijkt naar de extensie en de headers. */
export const compressionSchema = z.enum(['none', 'gzip', 'zip', 'auto']).default('auto')

const transportSchema = z.object({
  auth: feedAuthSchema.default({ type: 'none' }),
  headers: extraHeadersSchema,
  compression: compressionSchema,
  pagination: paginationSchema,
})

/**
 * Veldmapping voor JSON-, CSV- en XML-feeds. De configuratie staat per merchant
 * in `Merchant.configuration`, zodat een nieuwe feed geen code vraagt.
 */
export const fieldMappingSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  price: z.string().min(1),
  referencePrice: z.string().optional(),
  referencePriceType: z.enum(referencePriceTypes).default('MERCHANT_WAS_PRICE'),
  currency: z.string().optional(),
  /** Voorraad; wordt genormaliseerd naar een boolean. */
  stock: z.string().optional(),
  /** Vrije voorraadtekst, bijvoorbeeld "levertijd 2-3 dagen". */
  availability: z.string().optional(),
  url: z.string().min(1),
  /** Affiliate-deeplink uit de feed; wordt opgeslagen als `Offer.affiliateUrl`. */
  affiliateUrl: z.string().optional(),
  /** Alternatieve naam voor hetzelfde veld; sommige netwerken noemen het deeplink. */
  deeplink: z.string().optional(),
  imageUrl: z.string().min(1),
  imageAlt: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  ean: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  promotionEndsAt: z.string().optional(),
  shippingCost: z.string().optional(),
  productGroup: z.string().optional(),
  variantId: z.string().optional(),
  /** Extra velden die als specificatie worden opgeslagen. */
  specifications: z.record(z.string(), z.string()).default({}),
})

export type FieldMapping = z.infer<typeof fieldMappingSchema>

export const jsonFeedConfigSchema = transportSchema.extend({
  /** Pad naar de array met producten, bijvoorbeeld "data.products". */
  itemsPath: z.string().default(''),
  mapping: fieldMappingSchema,
  categoryMapping: z.record(z.string(), z.string()).default({}),
  defaultCurrency: z.string().length(3).default('EUR'),
})

export const csvFeedConfigSchema = transportSchema.extend({
  delimiter: z.string().max(1).optional(),
  mapping: fieldMappingSchema,
  categoryMapping: z.record(z.string(), z.string()).default({}),
  defaultCurrency: z.string().length(3).default('EUR'),
})

/**
 * XML-feeds: één element per product. `itemSelector` is de tagnaam, de mapping
 * gebruikt paden binnen dat element (`g:price` of `offer.price`) en
 * `@attribuut` leest een attribuut.
 */
export const xmlFeedConfigSchema = transportSchema.extend({
  itemSelector: z.string().min(1).default('item'),
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
  /**
   * Basis voor relatieve afbeeldingspaden. Zonder deze waarde worden paden
   * opgelost ten opzichte van `listUrl`; sommige bronnen geven paden ten
   * opzichte van een andere map of een CDN-root.
   */
  imageBaseUrl: z.string().url().optional(),
  itemSelector: z.string().min(1),
  fields: z.object({
    externalId: htmlSelectorSchema.optional(),
    title: htmlSelectorSchema,
    price: htmlSelectorSchema,
    referencePrice: htmlSelectorSchema.optional(),
    referencePriceType: z.enum(referencePriceTypes).default('MERCHANT_WAS_PRICE'),
    /** Optioneel: bronnen zonder losse productlink vallen terug op `listUrl`. */
    url: htmlSelectorSchema.optional(),
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
  /**
   * Zet `isDemo` op alles uit deze bron. Bedoeld voor preview- en
   * democatalogi: de producten zijn niet te koop, krijgen een demo-melding en
   * worden nooit geïndexeerd.
   */
  markAsDemo: z.boolean().default(false),
})

export type JsonFeedConfig = z.infer<typeof jsonFeedConfigSchema>
export type CsvFeedConfig = z.infer<typeof csvFeedConfigSchema>
export type XmlFeedConfig = z.infer<typeof xmlFeedConfigSchema>
export type HtmlConfig = z.infer<typeof htmlConfigSchema>

/** Sleutels die nooit een letterlijke waarde in de configuratie mogen hebben. */
const secretLikeKeys = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'accesskey',
  'privatekey',
  'authorization',
  'credential',
]

export type ConfigurationProblem = { path: string; message: string }

/**
 * Zoekt letterlijke secrets in een merchantconfiguratie. Alleen `*Env`-velden
 * mogen naar een secret verwijzen, en dan met de naam van de variabele.
 * Wordt gebruikt door de adaptervalidatie en door `/admin/integraties`.
 */
export function findLiteralSecrets(value: unknown, path = 'configuration'): ConfigurationProblem[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findLiteralSecrets(entry, `${path}[${index}]`))
  }
  if (value === null || typeof value !== 'object') return []

  const problems: ConfigurationProblem[] = []
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase()
    const isEnvReference = lowered.endsWith('env')
    if (!isEnvReference && secretLikeKeys.some((secret) => lowered.includes(secret))) {
      problems.push({
        path: `${path}.${key}`,
        message: `verwijs naar een environment variable (${key}Env) in plaats van een waarde`,
      })
      continue
    }
    if (isEnvReference && typeof entry === 'string' && !/^[A-Z][A-Z0-9_]*$/.test(entry)) {
      problems.push({
        path: `${path}.${key}`,
        message: 'moet de NAAM van een environment variable zijn (HOOFDLETTERS_MET_UNDERSCORE)',
      })
      continue
    }
    problems.push(...findLiteralSecrets(entry, `${path}.${key}`))
  }
  return problems
}
