import { describe, expect, it } from 'vitest'
import { parseCsv, detectDelimiter } from '@/lib/scraping/csv'
import { normalizeCategory, normalizeEan, normalizeStock, readPath } from '@/lib/scraping/normalize'
import { mapRow } from '@/merchants/adapters/mapping'
import { fieldMappingSchema } from '@/merchants/schemas/feed-config'
import { adapterFor } from '@/merchants/adapters'
import { fixtureAdapter } from '@/merchants/adapters/fixture'
import { demoProducts } from '@/merchants/fixtures/demo-products'

const mapping = fieldMappingSchema.parse({
  externalId: 'sku',
  title: 'name',
  price: 'price',
  referencePrice: 'was_price',
  referencePriceType: 'MERCHANT_WAS_PRICE',
  stock: 'stock',
  url: 'link',
  imageUrl: 'image',
  brand: 'brand',
  ean: 'ean',
  category: 'category',
  description: 'description',
  specifications: { Kleur: 'colour' },
})

const options = { categoryMapping: { Woonkamer: 'Wonen & Design' }, defaultCurrency: 'EUR' }

describe('CSV-parser', () => {
  it('leest quotes, escaped quotes en scheidingstekens', () => {
    const csv = 'sku;name;price\n1;"Tafel ""Nocta""";"€ 1.299,00"\n2;Lamp;89,95\n'
    expect(detectDelimiter(csv)).toBe(';')
    const rows = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.name).toBe('Tafel "Nocta"')
    expect(rows[1]?.price).toBe('89,95')
  })

  it('negeert lege regels en een BOM', () => {
    const rows = parseCsv('﻿a,b\n1,2\n\n')
    expect(rows).toEqual([{ a: '1', b: '2' }])
  })
})

describe('normalisatie van brondata', () => {
  it('normaliseert voorraadwaarden', () => {
    expect(normalizeStock('Op voorraad')).toBe(true)
    expect(normalizeStock('uitverkocht')).toBe(false)
    expect(normalizeStock('12')).toBe(true)
    expect(normalizeStock('0')).toBe(false)
    expect(normalizeStock(true)).toBe(true)
    expect(normalizeStock(undefined)).toBe(false)
  })

  it('accepteert alleen geldige EAN-lengtes', () => {
    expect(normalizeEan('8712345000011')).toBe('8712345000011')
    expect(normalizeEan('871-234-500-0011')).toBe('8712345000011')
    expect(normalizeEan('12345')).toBeNull()
  })

  it('zet onbekende categorieën in Cadeaus', () => {
    expect(normalizeCategory('Woonkamer', options.categoryMapping)).toBe('Wonen & Design')
    expect(normalizeCategory('keuken & apparaten')).toBe('Keuken & Apparaten')
    expect(normalizeCategory('Onbekend')).toBe('Cadeaus')
  })

  it('leest geneste paden', () => {
    expect(readPath({ product: { price: { amount: '12,50' } } }, 'product.price.amount')).toBe('12,50')
    expect(readPath({ items: [{ sku: 'a' }] }, 'items.0.sku')).toBe('a')
    expect(readPath({}, 'geen.pad')).toBeUndefined()
  })
})

describe('veldmapping', () => {
  it('zet een complete rij om naar product en aanbieding', () => {
    const result = mapRow(
      {
        sku: 'ABC-1',
        name: 'Design bijzettafel',
        price: '€ 299,00',
        was_price: '399,00',
        stock: 'op voorraad',
        link: 'https://winkel.example/p/abc-1',
        image: 'https://winkel.example/img/abc-1.jpg',
        brand: 'Nocta',
        ean: '8712345000011',
        category: 'Woonkamer',
        description: 'Ronde bijzettafel',
        colour: 'zwart',
      },
      mapping,
      options,
    )

    expect(result.item).not.toBeNull()
    expect(result.item?.product.primaryCategory).toBe('Wonen & Design')
    expect(result.item?.product.specifications).toEqual({ Kleur: 'zwart' })
    expect(result.item?.offer.currentPriceCents).toBe(29_900)
    expect(result.item?.offer.referencePriceCents).toBe(39_900)
    expect(result.item?.offer.referencePriceType).toBe('MERCHANT_WAS_PRICE')
    expect(result.item?.offer.inStock).toBe(true)
  })

  it('slaat rijen zonder prijs, afbeelding of URL over', () => {
    expect(mapRow({ sku: '1', name: 'X', link: 'https://a.example', image: 'https://a.example/i.jpg' }, mapping, options).item).toBeNull()
    expect(mapRow({ sku: '1', name: 'X', price: '10', image: 'https://a.example/i.jpg' }, mapping, options).item).toBeNull()
    expect(mapRow({ sku: '1', name: 'X', price: '10', link: 'https://a.example' }, mapping, options).item).toBeNull()
    expect(mapRow({ name: 'X', price: '10' }, mapping, options).warning).toContain('product-ID')
  })

  it('bewaart geen referentieprijs die niet hoger is dan de huidige prijs', () => {
    const result = mapRow(
      {
        sku: '2',
        name: 'Lamp',
        price: '49,95',
        was_price: '39,95',
        link: 'https://winkel.example/p/2',
        image: 'https://winkel.example/i/2.jpg',
      },
      mapping,
      options,
    )
    expect(result.item?.offer.referencePriceCents).toBeNull()
    expect(result.item?.offer.referencePriceType).toBeNull()
  })
})

describe('adapterregistry', () => {
  it('kent de fixture-, JSON-, CSV- en HTML-bronnen', () => {
    for (const sourceType of ['FIXTURE', 'JSON', 'CSV', 'HTML'] as const) {
      expect(adapterFor(sourceType)).not.toBeNull()
    }
    expect(adapterFor('API')).toBeNull()
  })

  it('levert alleen de producten van de gevraagde merchant', async () => {
    const slug = 'demo-kookkamer'
    const result = await fixtureAdapter.fetchItems({
      merchant: {
        id: 'm1',
        slug,
        name: 'Kookkamer (demo)',
        domain: 'demo.kookkamer.example',
        sourceType: 'FIXTURE',
        feedUrl: null,
        scrapingAllowed: false,
        configuration: {},
      },
    })
    const expected = demoProducts.filter((product) => product.merchantSlug === slug).length
    expect(result.items).toHaveLength(expected)
    expect(result.items.every((item) => item.product.isDemo)).toBe(true)
    expect(result.items.every((item) => item.product.imageUrl.startsWith('/demo/'))).toBe(true)
  })
})

describe('demo-fixtures', () => {
  it('bevat minimaal 24 producten over de hoofdcategorieën', () => {
    expect(demoProducts.length).toBeGreaterThanOrEqual(24)
    const categories = new Set(demoProducts.map((product) => product.primaryCategory))
    expect(categories.size).toBeGreaterThanOrEqual(8)
  })

  it('heeft altijd een afbeelding, een prijs en een aandachtspunt', () => {
    for (const product of demoProducts) {
      expect(product.image.length).toBeGreaterThan(0)
      expect(product.priceCents).toBeGreaterThan(0)
      expect(product.editorial.caveat.length).toBeGreaterThan(10)
    }
  })

  it('gebruikt geen referentieprijs die niet hoger is dan de prijs', () => {
    for (const product of demoProducts) {
      if (product.referencePriceCents !== null) {
        expect(product.referencePriceCents).toBeGreaterThan(product.priceCents)
        expect(product.referencePriceType).not.toBeNull()
      } else {
        expect(product.referencePriceType).toBeNull()
      }
    }
  })
})
