import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetServerEnvCache } from '@/lib/env'
import { buildMetadata } from '@/lib/seo/metadata'
import { itemListJsonLd, productJsonLd } from '@/lib/seo/jsonld'
import { isNeverIndexedPath, securityHeaders } from '@/lib/security/headers'
import robots from '@/app/robots'
import type { DealPricing } from '@/lib/pricing/deal'
import type { ProductCardView, ProductDetailView } from '@/types'

const original = {
  indexing: process.env.SEARCH_ENGINE_INDEXING_ENABLED,
  appEnv: process.env.APP_ENV,
}

function setIndexing(value: 'true' | 'false'): void {
  process.env.SEARCH_ENGINE_INDEXING_ENABLED = value
  resetServerEnvCache()
}

function pricing(overrides: Partial<DealPricing> = {}): DealPricing {
  return {
    kind: 'DEAL',
    currency: 'EUR',
    currentPriceCents: 29_900,
    currentPrice: '€ 299',
    referencePriceCents: 39_900,
    referencePrice: '€ 399',
    referencePriceType: 'MERCHANT_WAS_PRICE',
    referencePriceLabel: 'Van-prijs volgens aanbieder',
    hasValidReferencePrice: true,
    savingsCents: 10_000,
    savings: '€ 100',
    discountPercentage: 25,
    isTemporary: false,
    promotionEndsAt: null,
    priceLeadLabel: 'Nu',
    inStock: true,
    isStale: false,
    isActive: true,
    checkedAt: new Date('2026-08-11T08:00:00Z'),
    checkedAtLabel: 'net gecontroleerd',
    qualifiesAsDeal: true,
    ...overrides,
  }
}

function card(overrides: Partial<ProductCardView> = {}): ProductCardView {
  return {
    id: 'p1',
    slug: 'bijzettafel',
    title: 'Bijzettafel',
    category: 'Wonen & Design',
    categorySlug: 'wonen-en-design',
    headline: 'Deze bijzettafel verstopt een koelkast',
    teaser: 'Een rustige tafel met een gekoeld compartiment onder het blad.',
    imageUrl: '/demo/bijzettafel-koeling.svg',
    imageAlt: 'Bijzettafel',
    isDemo: false,
    badge: null,
    merchantName: 'Huisvondst',
    offerId: 'o1',
    pricing: pricing(),
    saveCount: 0,
    createdAt: new Date('2026-08-10T08:00:00Z'),
    ...overrides,
  }
}

function detail(overrides: Partial<ProductDetailView> = {}): ProductDetailView {
  return {
    ...card(),
    brand: 'Nocta',
    model: 'CT-40',
    ean: null,
    longDescription: 'x'.repeat(400),
    whyItStandsOut: 'Twee functies in één meubel.',
    bestFor: ['kleine woonkamers'],
    caveat: 'Controleer de afmetingen bij de aanbieder.',
    seoTitle: 'Bijzettafel met koeling',
    metaDescription: 'Bijzettafel met een gekoeld compartiment.',
    tags: ['wonen'],
    specifications: [],
    shortSourceDescription: null,
    priceHistory: [],
    updatedAt: new Date('2026-08-11T08:00:00Z'),
    merchantDomain: 'demo.huisvondst.example',
    demoOrigin: 'fictief',
    indexable: true,
    indexabilityReasons: [],
    priceAnalysis: null,
    sources: {
      labels: ['demo-fixture'],
      lastCheckedAt: new Date('2026-08-11T08:00:00Z'),
      priceDataSince: null,
      merchantCount: 1,
      experienceType: 'NOT_TESTED',
    },
    offers: [],
    ...overrides,
  }
}

beforeEach(() => {
  process.env.APP_ENV = 'test'
  resetServerEnvCache()
})

afterEach(() => {
  process.env.SEARCH_ENGINE_INDEXING_ENABLED = original.indexing
  process.env.APP_ENV = original.appEnv
  resetServerEnvCache()
})

describe('noindex voor demo en technische pagina´s', () => {
  it('zet demo-producten op noindex, ook met indexeren aan', () => {
    setIndexing('true')
    const metadata = buildMetadata({
      title: 'Demo-product',
      description: 'Demo',
      path: '/product/demo-product',
      noindex: true,
    })
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
  })

  it('indexeert een echt product wanneer indexeren aan staat', () => {
    setIndexing('true')
    const metadata = buildMetadata({ title: 'Product', description: 'Echt', path: '/product/echt' })
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
  })

  it('zet de hele site op noindex wanneer indexeren uit staat', () => {
    setIndexing('false')
    const metadata = buildMetadata({ title: 'Product', description: 'Echt', path: '/product/echt' })
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
  })

  it('houdt admin, api, go, zoeken en bewaard altijd buiten de index', () => {
    for (const path of ['/api/saves', '/go/abc', '/admin', '/admin/producten', '/zoeken', '/bewaard']) {
      expect(isNeverIndexedPath(path)).toBe(true)
    }
    for (const path of ['/', '/product/echt', '/categorie/wonen-en-design']) {
      expect(isNeverIndexedPath(path)).toBe(false)
    }
  })

  it('blokkeert alles in robots.txt zolang indexeren uit staat', () => {
    setIndexing('false')
    expect(robots()).toEqual({ rules: [{ userAgent: '*', disallow: '/' }] })

    setIndexing('true')
    const allowed = robots()
    const rules = Array.isArray(allowed.rules) ? allowed.rules : [allowed.rules]
    expect(rules[0]?.allow).toBe('/')
    expect(rules[0]?.disallow).toContain('/admin')
    expect(rules[0]?.disallow).toContain('/api/')
  })

  it('geeft een noindex-header zolang indexeren uit staat', () => {
    const off = securityHeaders({ isProduction: true, indexingEnabled: false })
    expect(off['x-robots-tag']).toBe('noindex, nofollow')
    const on = securityHeaders({ isProduction: true, indexingEnabled: true })
    expect(on['x-robots-tag']).toBeUndefined()
  })
})

describe('structured data', () => {
  it('voegt geen Product-data toe bij demo-inhoud', () => {
    expect(productJsonLd(detail({ isDemo: true }))).toBeNull()
  })

  it('voegt geen Product-data toe zonder geldige prijs', () => {
    expect(productJsonLd(detail({ pricing: null }))).toBeNull()
    expect(productJsonLd(detail({ offerId: null }))).toBeNull()
  })

  it('beschrijft een echt product met een Offer', () => {
    const data = productJsonLd(detail())
    expect(data).not.toBeNull()
    expect(data?.['@type']).toBe('Product')
    expect(data?.offers).toMatchObject({
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: '299.00',
      availability: 'https://schema.org/InStock',
    })
    // Nooit reviews of sterren.
    expect(JSON.stringify(data)).not.toContain('AggregateRating')
    expect(JSON.stringify(data)).not.toContain('Review')
  })

  it('laat demo-producten uit een ItemList', () => {
    const list = itemListJsonLd([card(), card({ id: 'p2', slug: 'demo', isDemo: true })], 'Vondsten')
    expect(list.numberOfItems).toBe(1)
    expect(JSON.stringify(list)).not.toContain('/product/demo')
  })
})

describe('security headers', () => {
  it('bevat de verwachte headers en HSTS alleen in productie', () => {
    const production = securityHeaders({ isProduction: true, indexingEnabled: true })
    expect(production['x-content-type-options']).toBe('nosniff')
    expect(production['x-frame-options']).toBe('DENY')
    expect(production['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(production['strict-transport-security']).toContain('max-age=')
    expect(production['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(production['content-security-policy']).not.toContain('unsafe-eval')

    const development = securityHeaders({ isProduction: false, indexingEnabled: true })
    expect(development['strict-transport-security']).toBeUndefined()
  })
})
