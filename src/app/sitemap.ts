import type { MetadataRoute } from 'next'
import { categories } from '@/lib/categories'
import { collections } from '@/lib/collections'
import { searchEngineIndexingEnabled } from '@/lib/env'
import { getIndexableProducts } from '@/lib/database/queries'
import { getClusters, getIndexableEditorialPages } from '@/lib/database/editorial-queries'
import { absoluteUrl } from '@/lib/seo/metadata'

// De sitemap leest producten uit de database en wordt daarom per request gemaakt.
export const dynamic = 'force-dynamic'

const staticPaths = [
  '/',
  '/categorieen',
  '/nieuw',
  '/gidsen',
  '/over',
  '/hoe-wij-selecteren',
  '/affiliateverklaring',
  '/privacy',
  '/cookies',
  '/contact',
]

/**
 * Sitemap met stabiele URL's. Zoekresultaten, bewaarde producten, admin en
 * demo-producten staan er bewust niet in.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Niet indexeren betekent ook: geen sitemap aanbieden.
  if (!searchEngineIndexingEnabled()) return []

  const [products, editorialPages, clusters] = await Promise.all([
    getIndexableProducts().catch(() => []),
    getIndexableEditorialPages().catch(() => []),
    // Alleen clusters die de drempels halen: een leeg thema hoort niet in de
    // sitemap.
    getClusters({ onlyProminent: true }).catch(() => []),
  ])
  const now = new Date()

  return [
    ...staticPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: path === '/' ? ('daily' as const) : ('monthly' as const),
      priority: path === '/' ? 1 : 0.5,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/categorie/${category.slug}`),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...collections.map((collection) => ({
      url: absoluteUrl(`/collectie/${collection.slug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...clusters.map((cluster) => ({
      url: absoluteUrl(`/thema/${cluster.slug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...editorialPages.map((page) => ({
      url: absoluteUrl(`/gids/${page.slug}`),
      lastModified: page.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/product/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
