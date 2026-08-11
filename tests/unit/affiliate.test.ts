import { afterEach, describe, expect, it } from 'vitest'
import * as cheerio from 'cheerio'
import { gzipSync } from 'node:zlib'
import {
  awinLinkBuilder,
  bolLinkBuilder,
  daisyconLinkBuilder,
  directLinkBuilder,
  linkBuilderFor,
  scaffoldOnlyNetworks,
  tradetrackerLinkBuilder,
  amazonCreatorsLinkBuilder,
} from '@/lib/affiliate/networks'
import { affiliateConfigSchema } from '@/lib/affiliate/types'
import { MAX_SUBID_LENGTH, placementSubId, safeSubId } from '@/lib/affiliate/subid'
import {
  credentialsAvailable,
  fetchFeed,
  resolveAuthHeaders,
} from '@/lib/scraping/authenticated-http'
import { feedAuthSchema, fieldMappingSchema, findLiteralSecrets } from '@/merchants/schemas/feed-config'
import { mapRow } from '@/merchants/adapters/mapping'
import { readXmlPath } from '@/merchants/adapters/xml-feed'

const context = { subId: 'home_hero', productId: 'p1', offerId: 'o1' }

function config(overrides: Record<string, unknown> = {}) {
  return affiliateConfigSchema.parse({ network: 'DIRECT', ...overrides })
}

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('affiliate-links', () => {
  it('gebruikt de deeplink uit de feed wanneer die er is', () => {
    const link = directLinkBuilder.buildLink(
      {
        destinationUrl: 'https://winkel.example/p/1',
        affiliateUrl: 'https://tracking.example/click?url=https%3A%2F%2Fwinkel.example%2Fp%2F1',
      },
      context,
      config({ subIdParameter: 'subid' }),
    )
    expect(link.ok).toBe(true)
    if (link.ok) {
      expect(link.source).toBe('feed')
      expect(link.url).toContain('tracking.example')
      expect(link.url).toContain('subid=home_hero')
      expect(link.subIdApplied).toBe(true)
    }
  })

  it('valt zonder deeplink terug op de gewone bestemming', () => {
    const link = directLinkBuilder.buildLink(
      { destinationUrl: 'https://winkel.example/p/1', affiliateUrl: null },
      context,
      config(),
    )
    expect(link.ok).toBe(true)
    if (link.ok) {
      expect(link.source).toBe('direct')
      expect(link.url).toBe('https://winkel.example/p/1')
      // Zonder subid-parameter wordt er niets aan de URL toegevoegd.
      expect(link.subIdApplied).toBe(false)
    }
  })

  it('weigert een onveilige deeplink en een onveilige bestemming', () => {
    const unsafeFeed = directLinkBuilder.buildLink(
      { destinationUrl: 'https://winkel.example/p/1', affiliateUrl: 'javascript:alert(1)' },
      context,
      config(),
    )
    // De onveilige deeplink wordt genegeerd, niet gevolgd.
    expect(unsafeFeed.ok).toBe(true)
    if (unsafeFeed.ok) expect(unsafeFeed.url).toBe('https://winkel.example/p/1')

    const unsafeDestination = directLinkBuilder.buildLink(
      { destinationUrl: 'file:///etc/passwd', affiliateUrl: null },
      context,
      config(),
    )
    expect(unsafeDestination.ok).toBe(false)
  })
})

describe('niet-geconfigureerde netwerkconnector', () => {
  const scaffolds = [
    { builder: bolLinkBuilder, network: 'BOL' as const },
    { builder: awinLinkBuilder, network: 'AWIN' as const },
    { builder: daisyconLinkBuilder, network: 'DAISYCON' as const },
    { builder: tradetrackerLinkBuilder, network: 'TRADETRACKER' as const },
    { builder: amazonCreatorsLinkBuilder, network: 'AMAZON_CREATORS' as const },
  ]

  it.each(scaffolds)('meldt bij $network duidelijk "niet geconfigureerd"', ({ builder, network }) => {
    const empty = config({ network })
    expect(builder.isConfigured(empty)).toBe(false)
    expect(builder.missingConfiguration(empty).length).toBeGreaterThan(0)

    const link = builder.buildLink(
      { destinationUrl: 'https://winkel.example/p/1', affiliateUrl: null },
      context,
      empty,
    )
    expect(link.ok).toBe(false)
    if (!link.ok) {
      expect(link.notConfigured).toBe(true)
      expect(link.reason).toContain('niet geconfigureerd')
      // Geen verzonnen link en geen verzonnen data.
      expect(link.reason).not.toContain('http')
    }
  })

  it('noemt alleen de naam van de ontbrekende environment variable, nooit een waarde', () => {
    process.env.AWIN_API_KEY = 'niet-in-de-melding'
    const withKey = config({ network: 'AWIN', publisherId: '12345', apiKeyEnv: 'AWIN_API_KEY' })
    expect(awinLinkBuilder.missingConfiguration(withKey)).toEqual([])

    delete process.env.AWIN_API_KEY
    const missing = awinLinkBuilder.missingConfiguration(withKey)
    expect(missing).toEqual(['environment variable AWIN_API_KEY'])
    expect(missing.join(' ')).not.toContain('niet-in-de-melding')
  })

  it('bouwt met complete configuratie wél een link uit de feed-deeplink', () => {
    process.env.AWIN_API_KEY = 'sleutel'
    const link = awinLinkBuilder.buildLink(
      {
        destinationUrl: 'https://winkel.example/p/1',
        affiliateUrl: 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=12345',
      },
      { ...context, subId: 'home_best_deals_3' },
      config({ network: 'AWIN', publisherId: '12345', apiKeyEnv: 'AWIN_API_KEY' }),
    )
    expect(link.ok).toBe(true)
    if (link.ok) {
      expect(link.source).toBe('feed')
      expect(link.url).toContain('clickref=home_best_deals_3')
    }
  })

  it('weigert zonder deeplink een link te verzinnen, ook mét credentials', () => {
    process.env.BOL_API_KEY = 'sleutel'
    const link = bolLinkBuilder.buildLink(
      { destinationUrl: 'https://www.bol.com/nl/p/x/9200000000000000/', affiliateUrl: null },
      context,
      config({ network: 'BOL', siteId: '987654', apiKeyEnv: 'BOL_API_KEY' }),
    )
    expect(link.ok).toBe(false)
    if (!link.ok) expect(link.reason).toContain('scaffold')
  })

  it('houdt bij welke netwerken alleen een scaffold zijn', () => {
    expect(scaffoldOnlyNetworks).not.toContain('DIRECT')
    expect(scaffoldOnlyNetworks).toHaveLength(5)
    for (const network of scaffoldOnlyNetworks) {
      expect(linkBuilderFor(network).requires.length).toBeGreaterThan(0)
    }
    expect(linkBuilderFor('DIRECT').isConfigured(config())).toBe(true)
  })
})

describe('veilige subid', () => {
  it('schoont een plaatsingsnaam op tot kleine letters, cijfers en underscores', () => {
    expect(safeSubId('Keuken & Apparaten')).toBe('keuken_apparaten')
    expect(safeSubId('categorie/wonen-en-design')).toBe('categorie_wonen_en_design')
    expect(safeSubId('  ')).toBe('onbekend')
    expect(safeSubId(null)).toBe('onbekend')
    expect(safeSubId('café')).toBe('cafe')
  })

  it('blijft binnen de maximale lengte', () => {
    const long = safeSubId('a'.repeat(200))
    expect(long).toHaveLength(MAX_SUBID_LENGTH)
    const placement = placementSubId('x'.repeat(200), 12)
    expect(placement.length).toBeLessThanOrEqual(MAX_SUBID_LENGTH)
    expect(placement.endsWith('_12')).toBe(true)
  })

  it('voegt een positie toe en laat die weg wanneer die er niet is', () => {
    expect(placementSubId('home_best_deals', 3)).toBe('home_best_deals_3')
    expect(placementSubId('home_hero')).toBe('home_hero')
    expect(placementSubId('product_related', null)).toBe('product_related')
  })

  it('laat geen tekens door die een link kunnen breken', () => {
    for (const raw of ['a b', 'a?b=c', 'a#b', 'a&b', 'a/b', 'a%20b', '<script>']) {
      expect(safeSubId(raw)).toMatch(/^[a-z0-9_]+$/)
    }
  })
})

describe('geauthenticeerde feedconfiguratie', () => {
  it('bouwt basic-, bearer- en api-key-headers uit de environment', () => {
    process.env.FEED_USER = 'partner'
    process.env.FEED_PASSWORD = 'geheim'
    const basic = resolveAuthHeaders(
      feedAuthSchema.parse({ type: 'basic', usernameEnv: 'FEED_USER', passwordEnv: 'FEED_PASSWORD' }),
    )
    expect(basic.ok).toBe(true)
    if (basic.ok) {
      expect(basic.headers.authorization).toBe(`Basic ${Buffer.from('partner:geheim').toString('base64')}`)
    }

    process.env.FEED_TOKEN = 'token-123'
    const bearer = resolveAuthHeaders(feedAuthSchema.parse({ type: 'bearer', tokenEnv: 'FEED_TOKEN' }))
    expect(bearer.ok && bearer.headers.authorization).toBe('Bearer token-123')

    process.env.FEED_KEY = 'key-123'
    const apiKey = resolveAuthHeaders(
      feedAuthSchema.parse({ type: 'apiKey', headerName: 'X-Api-Key', valueEnv: 'FEED_KEY' }),
    )
    expect(apiKey.ok && apiKey.headers['x-api-key']).toBe('key-123')
  })

  it('meldt welke environment variables ontbreken', () => {
    delete process.env.FEED_USER
    delete process.env.FEED_PASSWORD
    const resolved = resolveAuthHeaders(
      feedAuthSchema.parse({ type: 'basic', usernameEnv: 'FEED_USER', passwordEnv: 'FEED_PASSWORD' }),
    )
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.missing).toEqual(['FEED_USER', 'FEED_PASSWORD'])

    // Zonder authenticatie zijn er geen credentials nodig; dat geldt als "in orde".
    expect(credentialsAvailable(feedAuthSchema.parse({ type: 'none' }))).toBe(true)
    process.env.FEED_TOKEN = 'token'
    expect(credentialsAvailable(feedAuthSchema.parse({ type: 'bearer', tokenEnv: 'FEED_TOKEN' }))).toBe(true)
    delete process.env.FEED_TOKEN
    expect(credentialsAvailable(feedAuthSchema.parse({ type: 'bearer', tokenEnv: 'FEED_TOKEN' }))).toBe(false)
  })

  it('weigert een auth-configuratie met een letterlijke waarde', () => {
    expect(() => feedAuthSchema.parse({ type: 'bearer', tokenEnv: 'dit-is-een-waarde' })).toThrow()
    const problems = findLiteralSecrets({
      auth: { type: 'bearer', token: 'letterlijk-token' },
      affiliate: { apiKeyEnv: 'awin_api_key' },
    })
    expect(problems.map((problem) => problem.path)).toEqual([
      'configuration.auth.token',
      'configuration.affiliate.apiKeyEnv',
    ])
    expect(findLiteralSecrets({ auth: { type: 'bearer', tokenEnv: 'FEED_TOKEN' } })).toEqual([])
  })

  it('haalt een feed niet op zolang de credentials ontbreken', async () => {
    delete process.env.FEED_TOKEN
    await expect(
      fetchFeed({
        url: 'https://feed.example/products.json',
        auth: feedAuthSchema.parse({ type: 'bearer', tokenEnv: 'FEED_TOKEN' }),
      }),
    ).rejects.toThrow('FEED_TOKEN')
  })

  it('stuurt de auth- en extra headers mee', async () => {
    process.env.FEED_TOKEN = 'token-abc'
    const original = globalThis.fetch
    const seen: Headers[] = []
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers))
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      await fetchFeed({
        url: 'https://feed.example/products.json',
        auth: feedAuthSchema.parse({ type: 'bearer', tokenEnv: 'FEED_TOKEN' }),
        headers: { 'x-partner': 'homeandlivingdeals' },
        compression: 'none',
      })
    } finally {
      globalThis.fetch = original
    }
    expect(seen).toHaveLength(1)
    expect(seen[0]?.get('authorization')).toBe('Bearer token-abc')
    expect(seen[0]?.get('x-partner')).toBe('homeandlivingdeals')
  })

  it('pakt een gzip-feed uit met authenticatie', async () => {
    process.env.FEED_KEY = 'key-1'
    const payload = '<products><item><id>1</id></item></products>'
    const original = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(gzipSync(Buffer.from(payload)), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      })) as typeof fetch
    try {
      const feed = await fetchFeed({
        url: 'https://feed.example/products.xml.gz',
        auth: feedAuthSchema.parse({ type: 'apiKey', headerName: 'X-Api-Key', valueEnv: 'FEED_KEY' }),
      })
      expect(feed.body).toBe(payload)
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('XML-feed', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss xmlns:g="http://base.google.com/ns/1.0">
      <channel>
        <item id="SKU-1">
          <title>Pizzaoven voor buiten</title>
          <g:price>349,00 EUR</g:price>
          <g:sale_price>279,00 EUR</g:sale_price>
          <g:availability>in stock</g:availability>
          <g:brand>Fornetto</g:brand>
          <g:gtin>8712345000011</g:gtin>
          <g:shipping><g:price>6,95 EUR</g:price></g:shipping>
          <link>https://winkel.example/p/sku-1</link>
          <deeplink>https://tracking.example/c/1?url=sku-1</deeplink>
          <image href="https://cdn.winkel.example/sku-1.jpg" />
          <g:product_type>Keuken &amp; Apparaten</g:product_type>
        </item>
      </channel>
    </rss>`

  // De mapping noteert namespaces zoals de feed ze schrijft; readXmlPath escapt zelf.
  const mapping = fieldMappingSchema.parse({
    externalId: '@id',
    title: 'title',
    price: 'g:sale_price',
    referencePrice: 'g:price',
    url: 'link',
    deeplink: 'deeplink',
    imageUrl: 'image@href',
    brand: 'g:brand',
    ean: 'g:gtin',
    availability: 'g:availability',
    shippingCost: 'g:shipping.g:price',
    category: 'g:product_type',
  })

  function firstItem() {
    const $ = cheerio.load(xml, { xmlMode: true })
    return { element: $($('item').toArray()[0]!) as never }
  }

  it('leest tekst, attributen, namespaces en geneste paden', () => {
    const row = firstItem()
    expect(readXmlPath(row, '@id')).toBe('SKU-1')
    expect(readXmlPath(row, 'title')).toBe('Pizzaoven voor buiten')
    expect(readXmlPath(row, 'g:price')).toBe('349,00 EUR')
    expect(readXmlPath(row, 'image@href')).toBe('https://cdn.winkel.example/sku-1.jpg')
    expect(readXmlPath(row, 'g:shipping.g:price')).toBe('6,95 EUR')
    expect(readXmlPath(row, 'bestaat-niet')).toBeUndefined()
    expect(readXmlPath(row, '  ')).toBeUndefined()
  })

  it('zet een XML-item om naar product en aanbieding met de deeplink als affiliateUrl', () => {
    const result = mapRow(firstItem(), mapping, {
      categoryMapping: {},
      defaultCurrency: 'EUR',
      baseUrl: 'https://winkel.example',
      read: readXmlPath,
    })

    expect(result.item).not.toBeNull()
    expect(result.item?.product.externalId).toBe('SKU-1')
    expect(result.item?.product.ean).toBe('8712345000011')
    expect(result.item?.product.primaryCategory).toBe('Keuken & Apparaten')
    expect(result.item?.offer.currentPriceCents).toBe(27_900)
    expect(result.item?.offer.referencePriceCents).toBe(34_900)
    expect(result.item?.offer.shippingCostCents).toBe(695)
    expect(result.item?.offer.inStock).toBe(true)
    // De deeplink uit de feed is de affiliate-URL; de gewone link blijft de bestemming.
    expect(result.item?.offer.affiliateUrl).toBe('https://tracking.example/c/1?url=sku-1')
    expect(result.item?.offer.destinationUrl).toBe('https://winkel.example/p/sku-1')
  })

  it('geeft affiliateUrl voorrang boven deeplink wanneer beide gemapt zijn', () => {
    const result = mapRow(
      { sku: '1', name: 'X', price: '10,00', link: 'https://a.example/p', image: 'https://a.example/i.jpg', aff: 'https://net.example/aff', deep: 'https://net.example/deep' },
      fieldMappingSchema.parse({
        externalId: 'sku',
        title: 'name',
        price: 'price',
        url: 'link',
        imageUrl: 'image',
        affiliateUrl: 'aff',
        deeplink: 'deep',
      }),
      { categoryMapping: {}, defaultCurrency: 'EUR' },
    )
    expect(result.item?.offer.affiliateUrl).toBe('https://net.example/aff')
  })

  it('laat affiliateUrl leeg wanneer de feed er geen levert', () => {
    const result = mapRow(
      { sku: '1', name: 'X', price: '10,00', link: 'https://a.example/p', image: 'https://a.example/i.jpg' },
      fieldMappingSchema.parse({
        externalId: 'sku',
        title: 'name',
        price: 'price',
        url: 'link',
        imageUrl: 'image',
        affiliateUrl: 'aff',
      }),
      { categoryMapping: {}, defaultCurrency: 'EUR' },
    )
    expect(result.item?.offer.affiliateUrl).toBeNull()
  })
})
