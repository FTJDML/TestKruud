import { z } from 'zod'

/**
 * Drie draaimodi. `APP_ENV` staat los van `NODE_ENV`: `next build` zet
 * `NODE_ENV=production`, terwijl een build nog geen productieomgeving is.
 * Productie is daarom altijd een expliciete keuze via `APP_ENV=production`.
 */
export type AppEnv = 'development' | 'test' | 'production'

/** Vlaggen zijn tekst in de environment; alleen "true" en "false" zijn geldig. */
const flag = z.enum(['true', 'false']).optional()

/**
 * Server-side environment. Waarden worden lui gelezen zodat een build niet
 * faalt op optionele variabelen (bijvoorbeeld ANTHROPIC_API_KEY).
 */
const serverSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  CONTENT_PROVIDER: z.enum(['fixture', 'template', 'anthropic']).default('template'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
  CRON_SECRET: z.string().default(''),
  SCRAPER_USER_AGENT: z
    .string()
    .default('HomeAndLivingDealsBot/0.1 (+https://homeandlivingdeals.nl/over)'),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  SCRAPER_MAX_CONCURRENCY: z.coerce.number().int().positive().max(16).default(2),
  SCRAPER_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(30),
  SCRAPER_ALLOW_BROWSER: flag,
  ADMIN_USERNAME: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
  ADMIN_SESSION_SECRET: z.string().default(''),
  /** Demo-inhoud zichtbaar én seedbaar. Standaard uit in productie. */
  DEMO_CONTENT_ENABLED: flag,
  /** Zet de hele site op noindex zolang dit niet expliciet aan staat. */
  SEARCH_ENGINE_INDEXING_ENABLED: flag,
  ADS_ENABLED: flag,
  AFFILIATE_LINKS_ENABLED: flag,
  /** Draaiuur (0-23, Europe/Amsterdam) van de worker; zie src/jobs/worker.ts. */
  WORKER_DAILY_HOUR: z.coerce.number().int().min(0).max(23).default(6),
  WORKER_DAILY_MINUTE: z.coerce.number().int().min(0).max(59).default(15),
  /** Grenzen van de dagelijkse editie; zie src/lib/deals/edition.ts. */
  EDITION_MIN_ADDITIONAL_ITEMS: z.coerce.number().int().min(1).max(100).default(8),
  EDITION_TARGET_ADDITIONAL_ITEMS: z.coerce.number().int().min(1).max(100).default(16),
  EDITION_MAX_ADDITIONAL_ITEMS: z.coerce.number().int().min(1).max(200).default(24),
  MAX_PER_MERCHANT: z.coerce.number().int().min(1).max(50).default(3),
  MAX_PER_CATEGORY: z.coerce.number().int().min(1).max(50).default(4),
  /** Minimale breedte en hoogte van een productafbeelding. */
  IMAGE_MIN_DIMENSION: z.coerce.number().int().min(100).max(4000).default(400),
  /** Drempels waarboven een cluster prominent in de navigatie mag staan. */
  CLUSTER_MIN_PRODUCTS: z.coerce.number().int().min(1).max(500).default(15),
  CLUSTER_MIN_EDITORIAL_PAGES: z.coerce.number().int().min(0).max(100).default(2),
  /** Aantal productplaatsingen op de homepage; zie src/lib/editorial/homepage.ts. */
  HOMEPAGE_MIN_PLACEMENTS: z.coerce.number().int().min(4).max(200).default(32),
  HOMEPAGE_MAX_PLACEMENTS: z.coerce.number().int().min(4).max(200).default(40),
  /** Launchdoelen voor het dashboard; het zijn doelen, geen data. */
  LAUNCH_TARGET_PUBLISHED_PRODUCTS: z.coerce.number().int().min(0).default(150),
  LAUNCH_TARGET_PLANNED_PRODUCTS: z.coerce.number().int().min(0).default(50),
  LAUNCH_TARGET_PUBLISHED_PAGES: z.coerce.number().int().min(0).default(25),
  LAUNCH_TARGET_PLANNED_PAGES: z.coerce.number().int().min(0).default(15),
  LAUNCH_TARGET_PLANNED_DAYS: z.coerce.number().int().min(0).default(30),
})

type RawServerEnv = z.infer<typeof serverSchema>

export type ServerEnv = Omit<
  RawServerEnv,
  | 'SCRAPER_ALLOW_BROWSER'
  | 'DEMO_CONTENT_ENABLED'
  | 'SEARCH_ENGINE_INDEXING_ENABLED'
  | 'ADS_ENABLED'
  | 'AFFILIATE_LINKS_ENABLED'
> & {
  SCRAPER_ALLOW_BROWSER: boolean
  DEMO_CONTENT_ENABLED: boolean
  SEARCH_ENGINE_INDEXING_ENABLED: boolean
  ADS_ENABLED: boolean
  AFFILIATE_LINKS_ENABLED: boolean
}

function resolve(raw: RawServerEnv): ServerEnv {
  const isProduction = raw.APP_ENV === 'production'
  const yes = (value: 'true' | 'false' | undefined, fallback: boolean): boolean =>
    value === undefined ? fallback : value === 'true'

  return {
    ...raw,
    SCRAPER_ALLOW_BROWSER: yes(raw.SCRAPER_ALLOW_BROWSER, false),
    // Demo-inhoud hoort bij development en test, nooit standaard bij productie.
    DEMO_CONTENT_ENABLED: yes(raw.DEMO_CONTENT_ENABLED, !isProduction),
    // Indexeren is een bewuste keuze; standaard staat de site op noindex.
    SEARCH_ENGINE_INDEXING_ENABLED: yes(raw.SEARCH_ENGINE_INDEXING_ENABLED, false),
    ADS_ENABLED: yes(raw.ADS_ENABLED, false),
    AFFILIATE_LINKS_ENABLED: yes(raw.AFFILIATE_LINKS_ENABLED, false),
  }
}

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (!cached) cached = resolve(serverSchema.parse(process.env))
  return cached
}

/** Alleen voor tests: wist de cache na het aanpassen van process.env. */
export function resetServerEnvCache(): void {
  cached = null
}

export function appEnv(): AppEnv {
  return serverEnv().APP_ENV
}

export function isProductionEnv(): boolean {
  return serverEnv().APP_ENV === 'production'
}

/** Demo-producten en demo-bronnen zijn alleen buiten productie zichtbaar. */
export function demoContentEnabled(): boolean {
  return serverEnv().DEMO_CONTENT_ENABLED
}

export function searchEngineIndexingEnabled(): boolean {
  return serverEnv().SEARCH_ENGINE_INDEXING_ENABLED
}

export function adsEnabled(): boolean {
  return serverEnv().ADS_ENABLED
}

export function affiliateLinksEnabled(): boolean {
  return serverEnv().AFFILIATE_LINKS_ENABLED
}

/**
 * Grenzen van de dagelijkse editie uit de environment. De minimumwaarde wordt
 * nooit hoger dan het doel, en het doel nooit hoger dan het maximum: een
 * onmogelijke combinatie zou elke dag een lege homepage opleveren.
 */
export function editionLimitsFromEnv(env: ServerEnv = serverEnv()): {
  maxPerCategory: number
  maxPerMerchant: number
  minAdditionalItems: number
  targetAdditionalItems: number
  maxAdditionalItems: number
} {
  const max = env.EDITION_MAX_ADDITIONAL_ITEMS
  const target = Math.min(env.EDITION_TARGET_ADDITIONAL_ITEMS, max)
  const min = Math.min(env.EDITION_MIN_ADDITIONAL_ITEMS, target)
  return {
    maxPerCategory: env.MAX_PER_CATEGORY,
    maxPerMerchant: env.MAX_PER_MERCHANT,
    minAdditionalItems: min,
    targetAdditionalItems: target,
    maxAdditionalItems: max,
  }
}

/** Drempels voor clusterzichtbaarheid; per cluster te overschrijven. */
export function clusterThresholdsFromEnv(env: ServerEnv = serverEnv()): {
  minProducts: number
  minEditorialPages: number
} {
  return {
    minProducts: env.CLUSTER_MIN_PRODUCTS,
    minEditorialPages: env.CLUSTER_MIN_EDITORIAL_PAGES,
  }
}

/**
 * Hoeveel productplaatsingen de homepage moet halen. Het minimum wordt nooit
 * hoger dan het maximum; anders zou de homepage nooit "gevuld" kunnen zijn.
 */
export function homepagePlacementsFromEnv(env: ServerEnv = serverEnv()): {
  min: number
  max: number
} {
  const max = env.HOMEPAGE_MAX_PLACEMENTS
  return { min: Math.min(env.HOMEPAGE_MIN_PLACEMENTS, max), max }
}

/** Launchdoelen voor het dashboard. Doelen, geen gegenereerde gegevens. */
export function launchTargetsFromEnv(env: ServerEnv = serverEnv()): {
  publishedProducts: number
  plannedProducts: number
  publishedPages: number
  plannedPages: number
  plannedDays: number
} {
  return {
    publishedProducts: env.LAUNCH_TARGET_PUBLISHED_PRODUCTS,
    plannedProducts: env.LAUNCH_TARGET_PLANNED_PRODUCTS,
    publishedPages: env.LAUNCH_TARGET_PUBLISHED_PAGES,
    plannedPages: env.LAUNCH_TARGET_PLANNED_PAGES,
    plannedDays: env.LAUNCH_TARGET_PLANNED_DAYS,
  }
}

/** Publieke, in de client beschikbare configuratie (NEXT_PUBLIC_*). */
export const publicConfig = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  adsEnabled: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',
  adProvider: (process.env.NEXT_PUBLIC_AD_PROVIDER ?? 'none') as 'none' | 'adsense',
  adsenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? '',
} as const

export function isAdminConfigured(): boolean {
  const env = serverEnv()
  return (
    env.ADMIN_USERNAME.length > 0 &&
    env.ADMIN_PASSWORD.length > 0 &&
    env.ADMIN_SESSION_SECRET.length >= 16
  )
}

/**
 * Mag de demo-seed lopen? Productie seedt nooit automatisch demo-inhoud, ook
 * niet wanneer iemand `DEMO_CONTENT_ENABLED=true` zet: dat is een aparte,
 * bewuste ingreep in de database en geen opstartstap.
 */
export function shouldSeedDemoContent(env: ServerEnv = serverEnv()): {
  seed: boolean
  reason: string
} {
  if (env.APP_ENV === 'production') {
    return { seed: false, reason: 'APP_ENV=production: de demo-seed doet niets' }
  }
  if (!env.DEMO_CONTENT_ENABLED) {
    return { seed: false, reason: 'DEMO_CONTENT_ENABLED staat op false' }
  }
  return { seed: true, reason: `demo-inhoud voor ${env.APP_ENV}` }
}

const MIN_SECRET_LENGTH = 24
const placeholders = [
  'verander-dit',
  'changeme',
  'change-me',
  'secret',
  'password',
  'admin',
  'test',
]

function looksLikePlaceholder(value: string): boolean {
  const lowered = value.toLowerCase()
  return placeholders.some((placeholder) => lowered.includes(placeholder))
}

/**
 * Controleert of productie compleet is geconfigureerd. Geeft leesbare
 * problemen terug; nooit de waarde van een secret.
 */
export function productionConfigProblems(env: ServerEnv = serverEnv()): string[] {
  if (env.APP_ENV !== 'production') return []
  const problems: string[] = []

  if (env.DATABASE_URL.length === 0) problems.push('DATABASE_URL ontbreekt')
  if (!/^https:\/\//.test(env.NEXT_PUBLIC_SITE_URL)) {
    problems.push('NEXT_PUBLIC_SITE_URL moet een https-URL zijn')
  }
  if (env.CRON_SECRET.length < MIN_SECRET_LENGTH) {
    problems.push(`CRON_SECRET moet minimaal ${MIN_SECRET_LENGTH} tekens hebben`)
  }
  if (env.ADMIN_USERNAME.length === 0) problems.push('ADMIN_USERNAME ontbreekt')
  if (env.ADMIN_PASSWORD.length < 12) problems.push('ADMIN_PASSWORD moet minimaal 12 tekens hebben')
  if (looksLikePlaceholder(env.ADMIN_PASSWORD)) {
    problems.push('ADMIN_PASSWORD lijkt nog de voorbeeldwaarde te zijn')
  }
  if (env.ADMIN_SESSION_SECRET.length < 32) {
    problems.push('ADMIN_SESSION_SECRET moet minimaal 32 tekens hebben')
  }
  if (looksLikePlaceholder(env.ADMIN_SESSION_SECRET)) {
    problems.push('ADMIN_SESSION_SECRET lijkt nog de voorbeeldwaarde te zijn')
  }
  if (looksLikePlaceholder(env.CRON_SECRET)) {
    problems.push('CRON_SECRET lijkt nog de voorbeeldwaarde te zijn')
  }
  if (env.DEMO_CONTENT_ENABLED) {
    problems.push('DEMO_CONTENT_ENABLED moet "false" zijn in productie')
  }
  if (env.CONTENT_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY.length === 0) {
    problems.push('CONTENT_PROVIDER=anthropic vraagt een ANTHROPIC_API_KEY')
  }

  return problems
}

/**
 * Faalt hard wanneer productie niet compleet is geconfigureerd. Wordt bij het
 * starten van de server (src/instrumentation.ts) en door elke job aangeroepen,
 * zodat een productieproces niet met halve configuratie draait.
 */
export function assertProductionEnv(env: ServerEnv = serverEnv()): void {
  const problems = productionConfigProblems(env)
  if (problems.length === 0) return
  throw new Error(
    `Productieconfiguratie is niet compleet:\n- ${problems.join('\n- ')}\n` +
      'Zie .env.example en README (Productiemodi).',
  )
}
