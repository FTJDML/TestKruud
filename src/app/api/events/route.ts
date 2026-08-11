import { NextResponse } from 'next/server'
import { analyticsEventSchema, trackServerEvent } from '@/lib/analytics/events'
import { RateLimiter } from '@/lib/scraping/rate-limit'
import { readVisitorId } from '@/lib/saves/visitor'

/** Ruime limiet: impressies en scroll-depth komen in kleine bursts binnen. */
const limiter = new RateLimiter(120, 240)

/**
 * Interne eventcollector. Er gaat niets naar een externe dienst; deze route
 * bestaat zodat een toekomstige provider achter één interface past.
 */
export async function POST(request: Request) {
  const visitorId = await readVisitorId()
  if (!limiter.take(visitorId ?? 'anoniem')) {
    return new NextResponse(null, { status: 429 })
  }

  const parsed = analyticsEventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldig event.' }, { status: 400 })
  }

  await trackServerEvent(parsed.data, { visitorId })
  return new NextResponse(null, { status: 204 })
}
