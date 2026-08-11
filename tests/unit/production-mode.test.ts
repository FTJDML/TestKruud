import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertProductionEnv,
  demoContentEnabled,
  productionConfigProblems,
  resetServerEnvCache,
  searchEngineIndexingEnabled,
  serverEnv,
  shouldSeedDemoContent,
} from '@/lib/env'
import { isDemoMerchant, liveSources } from '@/merchants/sources/live-sources'
import { redactFields } from '@/lib/logger'

const keys = [
  'APP_ENV',
  'DEMO_CONTENT_ENABLED',
  'SEARCH_ENGINE_INDEXING_ENABLED',
  'ADS_ENABLED',
  'AFFILIATE_LINKS_ENABLED',
  'DATABASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'CRON_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'ADMIN_SESSION_SECRET',
  'CONTENT_PROVIDER',
  'ANTHROPIC_API_KEY',
] as const

const original = new Map<string, string | undefined>()

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetServerEnvCache()
}

/** Een complete, geldige productieconfiguratie zonder echte secrets. */
function completeProduction(): Record<string, string> {
  return {
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://gebruiker:geheim@db:5432/hald?schema=public',
    NEXT_PUBLIC_SITE_URL: 'https://homeandlivingdeals.nl',
    CRON_SECRET: 'k7QpZ2rTxN4mB8vLdC1yWs3E',
    ADMIN_USERNAME: 'redactie',
    ADMIN_PASSWORD: 'p9Xr2LmQ7vTb',
    ADMIN_SESSION_SECRET: 'nD8fJ2kQ7vZr4LmX9pWc3TgY6bH1sVe5',
    DEMO_CONTENT_ENABLED: 'false',
    CONTENT_PROVIDER: 'template',
  }
}

beforeEach(() => {
  for (const key of keys) original.set(key, process.env[key])
})

afterEach(() => {
  setEnv(Object.fromEntries(original))
  original.clear()
})

describe('draaimodi', () => {
  it('staat standaard in development met demo-inhoud aan', () => {
    setEnv({ APP_ENV: undefined, DEMO_CONTENT_ENABLED: undefined })
    expect(serverEnv().APP_ENV).toBe('development')
    expect(demoContentEnabled()).toBe(true)
  })

  it('zet demo-inhoud standaard uit in productie', () => {
    setEnv({ APP_ENV: 'production', DEMO_CONTENT_ENABLED: undefined })
    expect(demoContentEnabled()).toBe(false)
  })

  it('houdt indexeren standaard uit, ook in productie', () => {
    setEnv({ APP_ENV: 'production', SEARCH_ENGINE_INDEXING_ENABLED: undefined })
    expect(searchEngineIndexingEnabled()).toBe(false)
    setEnv({ SEARCH_ENGINE_INDEXING_ENABLED: 'true' })
    expect(searchEngineIndexingEnabled()).toBe(true)
  })

  it('laat test-modus demo-inhoud gebruiken', () => {
    setEnv({ APP_ENV: 'test', DEMO_CONTENT_ENABLED: undefined })
    expect(demoContentEnabled()).toBe(true)
  })
})

describe('productie zonder complete configuratie', () => {
  it('accepteert een complete configuratie', () => {
    setEnv(completeProduction())
    expect(productionConfigProblems()).toEqual([])
    expect(() => assertProductionEnv()).not.toThrow()
  })

  it('weigert te starten zonder secrets', () => {
    setEnv({
      ...completeProduction(),
      CRON_SECRET: '',
      ADMIN_PASSWORD: '',
      ADMIN_SESSION_SECRET: '',
    })
    const problems = productionConfigProblems()
    expect(problems.join(' ')).toContain('CRON_SECRET')
    expect(problems.join(' ')).toContain('ADMIN_PASSWORD')
    expect(problems.join(' ')).toContain('ADMIN_SESSION_SECRET')
    expect(() => assertProductionEnv()).toThrow(/Productieconfiguratie is niet compleet/)
  })

  it('weigert voorbeeldwaarden en http in productie', () => {
    setEnv({
      ...completeProduction(),
      NEXT_PUBLIC_SITE_URL: 'http://homeandlivingdeals.nl',
      ADMIN_PASSWORD: 'verander-dit-wachtwoord',
    })
    const problems = productionConfigProblems().join(' ')
    expect(problems).toContain('https')
    expect(problems).toContain('voorbeeldwaarde')
  })

  it('weigert demo-inhoud in productie', () => {
    setEnv({ ...completeProduction(), DEMO_CONTENT_ENABLED: 'true' })
    expect(productionConfigProblems().join(' ')).toContain('DEMO_CONTENT_ENABLED')
  })

  it('vraagt een API-key wanneer de anthropic-provider aan staat', () => {
    setEnv({ ...completeProduction(), CONTENT_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' })
    expect(productionConfigProblems().join(' ')).toContain('ANTHROPIC_API_KEY')
  })

  it('noemt nooit de waarde van een secret in de melding', () => {
    setEnv({ ...completeProduction(), ADMIN_SESSION_SECRET: 'te-kort' })
    const problems = productionConfigProblems().join(' ')
    expect(problems).not.toContain('te-kort')
    expect(problems).not.toContain('geheim')
  })

  it('doet geen uitspraak buiten productie', () => {
    setEnv({ APP_ENV: 'development', CRON_SECRET: '', ADMIN_PASSWORD: '' })
    expect(productionConfigProblems()).toEqual([])
  })
})

describe('demo-seed', () => {
  it('seedt niet in productie, ook niet met de vlag aan', () => {
    setEnv({ APP_ENV: 'production', DEMO_CONTENT_ENABLED: 'true' })
    const decision = shouldSeedDemoContent()
    expect(decision.seed).toBe(false)
    expect(decision.reason).toContain('production')
  })

  it('seedt niet wanneer demo-inhoud uit staat', () => {
    setEnv({ APP_ENV: 'development', DEMO_CONTENT_ENABLED: 'false' })
    expect(shouldSeedDemoContent().seed).toBe(false)
  })

  it('seedt in development met demo-inhoud aan', () => {
    setEnv({ APP_ENV: 'development', DEMO_CONTENT_ENABLED: 'true' })
    expect(shouldSeedDemoContent().seed).toBe(true)
  })
})

describe('demobronnen', () => {
  it('herkent fixtures en de democatalogus als demobron', () => {
    expect(isDemoMerchant({ slug: 'demo-huisvondst', sourceType: 'FIXTURE' })).toBe(true)
    for (const source of liveSources) {
      expect(isDemoMerchant({ slug: source.slug, sourceType: source.sourceType })).toBe(true)
    }
    expect(
      isDemoMerchant({ slug: 'winkel', sourceType: 'HTML', configuration: { markAsDemo: true } }),
    ).toBe(true)
  })

  it('laat een echte merchant staan', () => {
    expect(
      isDemoMerchant({ slug: 'echte-winkel', sourceType: 'JSON', configuration: { markAsDemo: false } }),
    ).toBe(false)
    expect(isDemoMerchant({ slug: 'echte-winkel', sourceType: 'CSV' })).toBe(false)
  })
})

describe('logging van secrets', () => {
  it('verbergt wachtwoorden, tokens en verbindingsgegevens', () => {
    const fields = redactFields({
      password: 'p9Xr2LmQ7vTb',
      ADMIN_SESSION_SECRET: 'nD8fJ2kQ7vZr4LmX9pWc3TgY6bH1sVe5',
      apiKey: 'sk-ant-12345678',
      nested: { cookie: 'hald_admin=abc.def', productSlug: 'office-chair' },
      reason: 'kan geen verbinding maken met postgresql://gebruiker:geheim@db:5432/hald',
    })
    const serialized = JSON.stringify(fields)
    expect(serialized).not.toContain('p9Xr2LmQ7vTb')
    expect(serialized).not.toContain('nD8fJ2kQ7vZr4LmX9pWc3TgY6bH1sVe5')
    expect(serialized).not.toContain('sk-ant-12345678')
    expect(serialized).not.toContain('hald_admin=abc.def')
    expect(serialized).not.toContain('geheim@db')
    // Onschuldige velden blijven leesbaar.
    expect(serialized).toContain('office-chair')
  })
})
