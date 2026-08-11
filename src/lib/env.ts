import { z } from 'zod'

/**
 * Server-side environment. Waarden worden lui gelezen zodat een build niet
 * faalt op optionele variabelen (bijvoorbeeld ANTHROPIC_API_KEY).
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CONTENT_PROVIDER: z.enum(['fixture', 'template', 'anthropic']).default('template'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  CRON_SECRET: z.string().default(''),
  SCRAPER_USER_AGENT: z
    .string()
    .default('HomeAndLivingDealsBot/0.1 (+https://homeandlivingdeals.nl/over)'),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  SCRAPER_MAX_CONCURRENCY: z.coerce.number().int().positive().max(16).default(2),
  SCRAPER_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(30),
  SCRAPER_ALLOW_BROWSER: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  ADMIN_USERNAME: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
  ADMIN_SESSION_SECRET: z.string().default(''),
  SEED_DEMO_CONTENT: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (!cached) cached = serverSchema.parse(process.env)
  return cached
}

/** Alleen voor tests: wist de cache na het aanpassen van process.env. */
export function resetServerEnvCache(): void {
  cached = null
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
