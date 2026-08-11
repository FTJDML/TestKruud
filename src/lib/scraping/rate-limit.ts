/**
 * Eenvoudige in-memory rate limiting. Gebruikt door adapters (per host) en door
 * de publieke API-routes (per bezoeker). Geen externe dienst nodig.
 */
type Bucket = { tokens: number; updatedAt: number }

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(
    private readonly capacity: number,
    private readonly refillPerMinute: number,
  ) {}

  /** Probeert één token te nemen; false betekent geweigerd. */
  take(key: string, now: number = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now }
    const elapsedMinutes = (now - bucket.updatedAt) / 60_000
    const tokens = Math.min(this.capacity, bucket.tokens + elapsedMinutes * this.refillPerMinute)
    if (tokens < 1) {
      this.buckets.set(key, { tokens, updatedAt: now })
      return false
    }
    this.buckets.set(key, { tokens: tokens - 1, updatedAt: now })
    return true
  }

  /** Wacht tot er een token beschikbaar is (voor jobs, niet voor requests). */
  async acquire(key: string): Promise<void> {
    // Bewust een simpele lus: jobs mogen wachten, requests niet.
    while (!this.take(key)) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(60_000 / this.refillPerMinute)))
    }
  }

  reset(): void {
    this.buckets.clear()
  }
}

/** Beperkt het aantal gelijktijdige taken. */
export async function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      const item = items[index]
      if (item === undefined) continue
      results[index] = await worker(item, index)
    }
  })
  await Promise.all(runners)
  return results
}
