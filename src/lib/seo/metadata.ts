import type { Metadata } from 'next'
import { publicConfig } from '@/lib/env'

export const siteName = 'HomeAndLivingDeals.nl'
export const siteTagline = 'Spullen waarvan je vijf minuten geleden nog niet wist dat je ze wilde'

export function absoluteUrl(path = '/'): string {
  return `${publicConfig.siteUrl}${path.startsWith('/') ? path : `/${path}`}`
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
  const ogImage = image ? (image.startsWith('http') ? image : absoluteUrl(image)) : absoluteUrl('/demo/placeholder.svg')

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex
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
