/**
 * CSRF-bescherming voor de eigen JSON-endpoints. De saves- en events-routes
 * werken met een first-party cookie en zijn daarmee gevoelig voor verzoeken van
 * een andere site. Server Actions in /admin hebben hun eigen origincontrole van
 * Next.js; deze module dekt de handmatige route handlers.
 */
export type OriginCheckResult = { ok: true } | { ok: false; reason: string }

function hostOf(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).host
  } catch {
    return null
  }
}

/**
 * Vergelijkt de Origin-header met de host van het verzoek. Browsers sturen
 * Origin bij elke cross-origin fetch, dus een ontbrekende Origin bij een
 * same-origin fetch is toegestaan zolang de Referer klopt of ontbreekt.
 */
export function checkSameOrigin(request: {
  headers: { get(name: string): string | null }
  url: string
}): OriginCheckResult {
  const host = request.headers.get('host') ?? hostOf(request.url)
  if (!host) return { ok: false, reason: 'geen host in het verzoek' }

  const origin = hostOf(request.headers.get('origin'))
  if (origin) {
    return origin === host ? { ok: true } : { ok: false, reason: 'origin hoort niet bij deze site' }
  }

  const referer = hostOf(request.headers.get('referer'))
  if (referer && referer !== host) {
    return { ok: false, reason: 'referer hoort niet bij deze site' }
  }
  return { ok: true }
}
