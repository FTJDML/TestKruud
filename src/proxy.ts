import { NextResponse, type NextRequest } from 'next/server'
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from '@/lib/saves/visitor'

/**
 * Proxy (voorheen middleware). Zet één keer een anonieme, httpOnly first-party
 * cookie zodat bewaarde producten aan een bezoeker gekoppeld kunnen worden
 * zonder account. Er wordt niets naar derden gestuurd.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const existing = request.cookies.get(VISITOR_COOKIE)?.value

  if (!existing || !/^[0-9a-f-]{36}$/i.test(existing)) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }

  // Technische endpoints en admin nooit indexeren.
  const path = request.nextUrl.pathname
  if (path.startsWith('/api') || path.startsWith('/go/') || path.startsWith('/admin')) {
    response.headers.set('x-robots-tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|demo/).*)'],
}
