import type { Metadata } from 'next'
import { publicConfig, searchEngineIndexingEnabled } from '@/lib/env'

export const siteName = 'HomeAndLivingDeals.nl'
export const siteTagline = 'Spullen waarvan je vijf minuten geleden nog niet wist dat je ze wilde'

export function absoluteUrl(path = '/'): string {
  return `${publicConfig.siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Absolute URL van een afbeelding, veilig voor beide gevallen:
 *
 * - een lokaal pad (`/demo/x.svg`) wordt onze eigen domeinnaam ervoor;
 * - een externe URL (`https://cdn.merchant.nl/x.jpg`) blijft ongewijzigd.
 *
 * Zonder deze functie ontstaat `https://site.nl/https://merchant...`, wat zowel
 * Open Graph als structured data ongeldig maakt.
 */
export function absoluteImageUrl(image: string | null | undefined): string {
  const value = (image ?? '').trim()
  if (value.length === 0) return absoluteUrl('/image-unavailable.svg')
  if (/^https?:\/\//i.test(value)) return value
  // Protocol-relatieve URL's (//cdn.example/x.jpg) krijgen https.
  if (value.startsWith('//')) return `https:${value}`
  return absoluteUrl(value)
}

type PageMetadataInput = {
  title: string
  description: string
  path: string
  /** Zoekresultaten, bewaarde producten, admin en demo krijgen noindex. */
  noindex?: boolean
  image?: string
  type?: 'website' | 'article'
}

/** Bouwt consistente metadata met canonical, Open Graph en Twitter card. */
export function buildMetadata({
  title,
  description,
  path,
  noindex = false,
  image,
  type = 'website',
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path)
  // Zolang SEARCH_ENGINE_INDEXING_ENABLED uit staat, krijgt de hele site
  // noindex. Dat voorkomt dat een acceptatieomgeving wordt geïndexeerd.
  const blocked = noindex || !searchEngineIndexingEnabled()
  const ogImage = absoluteImageUrl(image)

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: blocked
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: 'nl_NL',
      type,
      images: [{ url: ogImage, width: 800, height: 800, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}
