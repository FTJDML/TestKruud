import { formatPriceValue } from '@/lib/pricing/money'
import { absoluteImageUrl, absoluteUrl, siteName, siteTagline } from '@/lib/seo/metadata'
import type { EditorialPageView, ProductCardView, ProductDetailView } from '@/types'

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

/**
 * Product met Offer. Structured data wordt alleen toegevoegd bij echte,
 * geldige productdata: geen demo-inhoud en geen product zonder actuele prijs.
 * Levert `null` wanneer er niets te claimen valt.
 */
export function productJsonLd(product: ProductDetailView): JsonLdObject | null {
  const pricing = product.pricing
  if (product.isDemo) return null
  if (!pricing || !product.offerId || pricing.currentPriceCents <= 0) return null

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
    // Externe afbeeldingen blijven ongewijzigd; lokale paden worden absoluut.
    image: [absoluteImageUrl(product.imageUrl)],
    category: product.category,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.model ? { model: product.model } : {}),
    ...(product.ean ? { gtin13: product.ean } : {}),
    ...(offers ? { offers } : {}),
  }
}

/** Lijst met producten. Demo-inhoud staat er nooit in: die is noindex. */
export function itemListJsonLd(products: readonly ProductCardView[], name: string): JsonLdObject {
  const real = products.filter((product) => !product.isDemo)
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: real.length,
    itemListElement: real.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/product/${product.slug}`),
      name: product.headline,
    })),
  }
}

/**
 * Redactionele pagina als ItemList. Alleen wat de bezoeker ook echt ziet: de
 * geselecteerde producten met hun zichtbare prijs. Er komt géén Review,
 * AggregateRating, sterren of testresultaat in — die hebben wij niet.
 *
 * Een pagina die de indexeringspoort niet haalt krijgt geen structured data:
 * markup voor een pagina die niet in de index hoort, voegt niets toe.
 */
export function editorialPageJsonLd(page: EditorialPageView): JsonLdObject | null {
  if (!page.indexable) return null
  const real = page.selected.filter((entry) => !entry.product.isDemo)
  if (real.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page.title,
    description: page.metaDescription,
    url: absoluteUrl(`/gids/${page.slug}`),
    numberOfItems: real.length,
    itemListElement: real.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/product/${entry.product.slug}`),
      name: entry.product.title,
      ...(entry.product.pricing
        ? {
            // Exact het bedrag dat op de pagina staat.
            item: {
              '@type': 'Product',
              name: entry.product.title,
              image: [absoluteImageUrl(entry.product.imageUrl)],
              offers: {
                '@type': 'Offer',
                priceCurrency: entry.product.pricing.currency,
                price: formatPriceValue(entry.product.pricing.currentPriceCents),
                availability: entry.product.pricing.isActive
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
                url: absoluteUrl(`/product/${entry.product.slug}`),
              },
            },
          }
        : {}),
    })),
  }
}
