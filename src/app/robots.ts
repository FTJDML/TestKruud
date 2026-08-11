import type { MetadataRoute } from 'next'
import { searchEngineIndexingEnabled } from '@/lib/env'
import { absoluteUrl } from '@/lib/seo/metadata'

// Per request: SEARCH_ENGINE_INDEXING_ENABLED wordt in productie gezet, niet bij
// de build. Zonder dit zou robots.txt de buildwaarde bevriezen.
export const dynamic = 'force-dynamic'

/**
 * Technische endpoints, admin en persoonlijke pagina's blijven altijd uit de
 * index. Staat `SEARCH_ENGINE_INDEXING_ENABLED` uit, dan geldt dat voor de hele
 * site: geen enkele crawler mag dan iets ophalen.
 */
export default function robots(): MetadataRoute.Robots {
  if (!searchEngineIndexingEnabled()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/go/', '/zoeken', '/bewaard'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  }
}
