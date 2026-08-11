/**
 * Security headers voor elk antwoord. Bewust een pure module zonder imports uit
 * de database of Prisma, zodat de proxy haar goedkoop kan gebruiken.
 */
export type HeaderOptions = {
  /** `APP_ENV=production`: strengere CSP en HSTS. */
  isProduction: boolean
  /** Zet de hele site op noindex zolang indexeren uit staat. */
  indexingEnabled: boolean
}

function contentSecurityPolicy(isProduction: boolean): string {
  const scriptSrc = isProduction
    ? // Next.js plaatst hydratatiedata inline; 'unsafe-eval' is in productie niet nodig.
      "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'"

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // Productfoto's lopen via /_next/image, maar blijven ook direct toegestaan.
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

export function securityHeaders(options: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'content-security-policy': contentSecurityPolicy(options.isProduction),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-opener-policy': 'same-origin',
    'x-dns-prefetch-control': 'off',
  }

  if (options.isProduction) {
    headers['strict-transport-security'] = 'max-age=63072000; includeSubDomains; preload'
  }
  if (!options.indexingEnabled) {
    headers['x-robots-tag'] = 'noindex, nofollow'
  }
  return headers
}

/** Paden die nooit in een zoekmachine horen, ongeacht de indexeerstand. */
export function isNeverIndexedPath(path: string): boolean {
  return (
    path.startsWith('/api') ||
    path.startsWith('/go/') ||
    path.startsWith('/admin') ||
    path === '/zoeken' ||
    path === '/bewaard'
  )
}
