import { formatPriceValue } from '@/lib/pricing/money'
import { absoluteUrl, siteName, siteTagline } from '@/lib/seo/metadata'
import type { ProductCardView, ProductDetailView } from '@/types'

/**
 * Structured data. Bewust zonder Review, AggregateRating of sterren: wij hebben
 * geen gebruikersreviews en verzinnen die ook niet. Alle waarden komen exact
 * overeen met wat de bezoeker op de pagina ziet.
 */
export type JsonLdObject = Record<string, unknown>

export function organizationJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: absoluteUrl('/'),
    description: siteTagline,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'redactie',
      email: 'redactie@homeandlivingdeals.nl',
      availableLanguage: ['nl'],
    },
  }
}

export function websiteJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: absoluteUrl('/'),
    inLanguage: 'nl-NL',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/zoeken')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

/** Product met Offer. Alleen een prijs wanneer de aanbieding actief is. */
export function productJsonLd(product: ProductDetailView): JsonLdObject {
  const pricing = product.pricing
  const offers =
    pricing && product.offerId
      ? {
          '@type': 'Offer',
          url: absoluteUrl(`/product/${product.slug}`),
          priceCurrency: pricing.currency,
          price: formatPriceValue(pricing.currentPriceCents),
          availability: pricing.isActive
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: product.merchantName },
          ...(pricing.promotionEndsAt ? { priceValidUntil: pricing.promotionEndsAt.toISOString() } : {}),
        }
      : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.metaDescription,
    image: [absoluteUrl(product.imageUrl)],
    category: product.category,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.model ? { model: product.model } : {}),
    ...(product.ean ? { gtin13: product.ean } : {}),
    ...(offers ? { offers } : {}),
  }
}

export function itemListJsonLd(products: readonly ProductCardView[], name: string): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/product/${product.slug}`),
      name: product.headline,
    })),
  }
}
