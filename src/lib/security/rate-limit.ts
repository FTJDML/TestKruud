import { RateLimiter } from '@/lib/scraping/rate-limit'

/**
 * Rate limiting voor publieke verzoeken. In-memory en dus per instantie: goed
 * genoeg tegen scripts en dubbelklikken, geen vervanging voor een WAF. Zet een
 * hardere limiet in Caddy of bij de hostingpartij wanneer dat nodig is.
 */
export type RateLimitBucket = 'saves' | 'search' | 'outbound' | 'events'

const limiters: Record<RateLimitBucket, RateLimiter> = {
  // capaciteit (burst), aanvulling per minuut
  saves: new RateLimiter(30, 60),
  search: new RateLimiter(20, 40),
  outbound: new RateLimiter(30, 60),
  events: new RateLimiter(60, 120),
}

/** Bepaalt bij welke bucket een pad hoort; null betekent geen limiet. */
export function bucketForPath(path: string): RateLimitBucket | null {
  if (path.startsWith('/api/saves')) return 'saves'
  if (path.startsWith('/api/events')) return 'events'
  if (path.startsWith('/go/')) return 'outbound'
  if (path === '/zoeken') return 'search'
  return null
}

export function allowRequest(bucket: RateLimitBucket, key: string, now?: number): boolean {
  return limiters[bucket].take(key, now)
}

/** Alleen voor tests: leegt alle buckets. */
export function resetRateLimits(): void {
  for (const limiter of Object.values(limiters)) limiter.reset()
}

/**
 * Sleutel per bezoeker. De anonieme cookie is de beste sleutel; zonder cookie
 * vallen we terug op het IP uit de proxyheader. Er wordt niets gelogd.
 */
export function requestKey(input: { visitorId?: string | null; forwardedFor?: string | null }): string {
  if (input.visitorId) return `v:${input.visitorId}`
  const first = input.forwardedFor?.split(',')[0]?.trim()
  return first && first.length > 0 ? `ip:${first}` : 'anoniem'
}
