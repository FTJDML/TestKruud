import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetServerEnvCache } from '@/lib/env'

const queryRaw = vi.hoisted(() => vi.fn<() => Promise<unknown>>())

vi.mock('@/lib/database/client', () => ({ prisma: { $queryRaw: queryRaw } }))

const { GET: health } = await import('@/app/api/health/route')
const { GET: ready } = await import('@/app/api/ready/route')

const original = {
  appEnv: process.env.APP_ENV,
  cronSecret: process.env.CRON_SECRET,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
}

beforeEach(() => {
  queryRaw.mockReset()
  queryRaw.mockResolvedValue([{ '1': 1 }])
  process.env.APP_ENV = 'test'
  resetServerEnvCache()
})

afterEach(() => {
  process.env.APP_ENV = original.appEnv
  process.env.CRON_SECRET = original.cronSecret
  process.env.NEXT_PUBLIC_SITE_URL = original.siteUrl
  resetServerEnvCache()
})

describe('/api/health', () => {
  it('antwoordt zonder database en zonder gevoelige informatie', async () => {
    const response = health()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')

    const body = (await response.json()) as Record<string, unknown>
    expect(body).toEqual({ status: 'ok' })
    // Liveness raakt de database niet aan.
    expect(queryRaw).not.toHaveBeenCalled()

    const serialized = JSON.stringify(body)
    for (const leak of ['postgres', 'DATABASE_URL', 'secret', 'password', 'ADMIN']) {
      expect(serialized).not.toContain(leak)
    }
  })
})

describe('/api/ready', () => {
  it('is gereed met database en complete configuratie', async () => {
    const response = await ready()
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toEqual({
      status: 'ready',
      appEnv: 'test',
      database: 'ok',
      configuration: 'ok',
    })
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('geeft 503 en geen databasefout wanneer de database wegvalt', async () => {
    queryRaw.mockRejectedValue(
      new Error('connect ECONNREFUSED postgresql://gebruiker:geheim@db:5432/hald'),
    )
    const response = await ready()
    expect(response.status).toBe(503)

    const body = (await response.json()) as Record<string, unknown>
    expect(body.status).toBe('niet-gereed')
    expect(body.database).toBe('fout')

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('geheim')
    expect(serialized).not.toContain('postgresql://')
    expect(serialized).not.toContain('ECONNREFUSED')
  })

  it('is niet gereed wanneer de productieconfiguratie incompleet is', async () => {
    process.env.APP_ENV = 'production'
    process.env.CRON_SECRET = ''
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    resetServerEnvCache()

    const response = await ready()
    expect(response.status).toBe(503)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.configuration).toBe('incompleet')
    // Welke variabele ontbreekt staat in de log, niet in het antwoord.
    expect(JSON.stringify(body)).not.toContain('CRON_SECRET')
  })
})
