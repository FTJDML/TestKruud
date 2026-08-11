import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/metadata'

/** Technische endpoints, admin en persoonlijke pagina's blijven uit de index. */
export default function robots(): MetadataRoute.Robots {
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
