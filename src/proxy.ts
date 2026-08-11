import { NextResponse, type NextRequest } from 'next/server'
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from '@/lib/saves/visitor'
import { isNeverIndexedPath, securityHeaders } from '@/lib/security/headers'
import { allowRequest, bucketForPath, requestKey } from '@/lib/security/rate-limit'

/**
 * Proxy (voorheen middleware). Doet drie dingen voor elk verzoek:
 *
 * 1. één anonieme, httpOnly first-party cookie zetten, zodat bewaarde producten
 *    aan een bezoeker gekoppeld kunnen worden zonder account;
 * 2. security headers meegeven, inclusief noindex zolang indexeren uit staat;
 * 3. de publieke endpoints licht rate limiten.
 *
 * De environment wordt hier bewust via `process.env` gelezen: de proxy draait
 * per verzoek en heeft geen Zod-parse of databaseverbinding nodig.
 */
const isProduction = process.env.APP_ENV === 'production'
const indexingEnabled = process.env.SEARCH_ENGINE_INDEXING_ENABLED === 'true'
const headers = securityHeaders({ isProduction, indexingEnabled })

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const existing = request.cookies.get(VISITOR_COOKIE)?.value
  const visitorId = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : null

  const bucket = bucketForPath(path)
  if (
    bucket &&
    !allowRequest(
      bucket,
      requestKey({ visitorId, forwardedFor: request.headers.get('x-forwarded-for') }),
    )
  ) {
    const response = NextResponse.json(
      { error: 'Te veel verzoeken. Probeer het over een minuut opnieuw.' },
      { status: 429 },
    )
    response.headers.set('retry-after', '60')
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
    return response
  }

  const response = NextResponse.next()

  if (!visitorId) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }

  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)

  // Admin, technische endpoints, zoekresultaten en bewaarde producten blijven
  // altijd uit de index, ook wanneer de site wél geïndexeerd mag worden.
  if (isNeverIndexedPath(path)) {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo/).*)'],
}
