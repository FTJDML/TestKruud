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
  /**
   * Pagina's die de indexeringspoort niet halen blijven wél browsebaar en
   * doorlinken: die krijgen `noindex, follow` in plaats van `noindex, nofollow`.
   */
  followWhenNoindex?: boolean
  /** Canonical naar een andere pagina, bijvoorbeeld bij overlappende content. */
  canonicalPath?: string
  image?: string
  type?: 'website' | 'article'
}

/** Bouwt consistente metadata met canonical, Open Graph en Twitter card. */
export function buildMetadata({
  title,
  description,
  path,
  noindex = false,
  followWhenNoindex = false,
  canonicalPath,
  image,
  type = 'website',
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path)
  // Zolang SEARCH_ENGINE_INDEXING_ENABLED uit staat, krijgt de hele site
  // noindex. Dat voorkomt dat een acceptatieomgeving wordt geïndexeerd.
  const blocked = noindex || !searchEngineIndexingEnabled()
  // Volgen mag alleen wanneer de site zelf geïndexeerd mag worden: op een
  // acceptatieomgeving blijft alles nofollow.
  const follow = followWhenNoindex && searchEngineIndexingEnabled()
  const ogImage = absoluteImageUrl(image)

  return {
    title,
    description,
    alternates: { canonical: canonicalPath ? absoluteUrl(canonicalPath) : url },
    robots: blocked
      ? { index: false, follow, googleBot: { index: false, follow } }
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
