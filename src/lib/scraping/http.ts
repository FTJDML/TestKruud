import { serverEnv } from '@/lib/env'
import { errorMessage, logger } from '@/lib/logger'
import { RateLimiter } from '@/lib/scraping/rate-limit'

/**
 * HTTP-laag voor feeds en toegestane scrapes: time-outs, retries met backoff,
 * rate limiting per host en een duidelijke user-agent uit de environment.
 * Er wordt geen anti-botbeveiliging omzeild en er is geen proxyrotatie.
 */
const limiters = new Map<string, RateLimiter>()

function limiterFor(host: string): RateLimiter {
  const perMinute = serverEnv().SCRAPER_REQUESTS_PER_MINUTE
  let limiter = limiters.get(host)
  if (!limiter) {
    limiter = new RateLimiter(Math.max(1, Math.ceil(perMinute / 4)), perMinute)
    limiters.set(host, limiter)
  }
  return limiter
}

export type FetchTextOptions = {
  /** Extra headers, bijvoorbeeld Accept voor een JSON-feed. */
  headers?: Record<string, string>
  timeoutMs?: number
  retries?: number
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function backoffDelay(attempt: number): number {
  return Math.min(8_000, 2 ** attempt * 500)
}

/** Haalt tekst op met retries; gooit na de laatste poging. */
export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const env = serverEnv()
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Alleen http en https zijn toegestaan: ${url}`)
  }
  const retries = options.retries ?? 2
  const timeoutMs = options.timeoutMs ?? env.SCRAPER_TIMEOUT_MS
  const limiter = limiterFor(parsed.host)

  let lastError: unknown = new Error('onbekende fout')
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await limiter.acquire(parsed.host)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': env.SCRAPER_USER_AGENT,
          accept: 'text/html,application/json,text/csv,*/*',
          ...options.headers,
        },
        signal: controller.signal,
        redirect: 'follow',
      })
      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} voor ${url}`, response.status)
      }
      return await response.text()
    } catch (error) {
      lastError = error
      // 4xx (behalve 429) opnieuw proberen heeft geen zin.
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) break
      if (attempt < retries) {
        const delay = backoffDelay(attempt)
        logger.warn('HTTP-poging mislukt, opnieuw proberen', {
          url,
          attempt: attempt + 1,
          delay,
          reason: errorMessage(error),
        })
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fetchJson<T = unknown>(url: string, options: FetchTextOptions = {}): Promise<T> {
  const body = await fetchText(url, { ...options, headers: { accept: 'application/json', ...options.headers } })
  return JSON.parse(body) as T
}
