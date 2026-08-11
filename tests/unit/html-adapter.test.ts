import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdapterContext } from '@/merchants/types'
import { htmlConfigSchema } from '@/merchants/schemas/feed-config'
import { liveSources } from '@/merchants/sources/live-sources'

const fetchText = vi.hoisted(() => vi.fn<(url: string) => Promise<string>>())

vi.mock('@/lib/scraping/http', () => ({ fetchText }))

const { htmlAdapter } = await import('@/merchants/adapters/html')

const odoo = liveSources.find((source) => source.slug === 'odoo-democatalogus')!

/** Verkorte kopie van de vorm die de echte bron levert. */
const sourceDocument = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <record id="product_chair" model="product.product">
    <field name="name">Office Chair</field>
    <field name="categ_id" ref="product_category_office"/>
    <field name="standard_price">55.0</field>
    <field name="list_price">70.0</field>
    <field name="default_code">FURN_7777</field>
    <field name="description_sale">Comfortable yellow chair for daily work</field>
    <field name="image_1920" type="bytes" file="product/static/img/product_chair.jpg"/>
  </record>
  <record id="dining_table" model="product.template">
    <field name="name">Outdoor dining table</field>
    <field name="categ_id" ref="product_category_outdoor_furniture"/>
    <field name="list_price">589</field>
    <field name="image_1920" type="bytes" file="product/static/img/dining_table.png"/>
  </record>
  <record id="zonder_prijs" model="product.product">
    <field name="name">Table frame</field>
    <field name="image_1920" type="bytes" file="product/static/img/table02.jpg"/>
  </record>
</odoo>`

function contextFor(overrides: Partial<AdapterContext['merchant']> = {}): AdapterContext {
  return {
    merchant: {
      id: 'm-live',
      slug: odoo.slug,
      name: odoo.name,
      domain: odoo.domain,
      sourceType: 'HTML',
      feedUrl: odoo.feedUrl,
      scrapingAllowed: odoo.scrapingAllowed,
      configuration: odoo.configuration as Record<string, unknown>,
      ...overrides,
    },
  }
}

beforeEach(() => {
  fetchText.mockReset()
  fetchText.mockResolvedValue(sourceDocument)
})

describe('configuratie van live bronnen', () => {
  it('valideert tegen het HTML-schema', () => {
    for (const source of liveSources) {
      expect(htmlConfigSchema.safeParse(source.configuration).success).toBe(true)
    }
  })

  it('staat alleen aan wanneer scrapen expliciet is toegestaan', () => {
    expect(htmlAdapter.validate(contextFor())).toEqual([])
    expect(htmlAdapter.validate(contextFor({ scrapingAllowed: false }))).toContain(
      'scrapingAllowed staat uit voor deze merchant',
    )
  })
})

describe('HTML-adapter', () => {
  it('leest titel, prijs, categorie en afbeelding uit de bron', async () => {
    const result = await htmlAdapter.fetchItems(contextFor())

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(result.items).toHaveLength(2)

    const chair = result.items[0]
    expect(chair?.product.title).toBe('Office Chair')
    expect(chair?.product.externalId).toBe('FURN_7777')
    expect(chair?.product.primaryCategory).toBe('Wonen & Design')
    expect(chair?.offer.currentPriceCents).toBe(7_000)
    expect(chair?.product.shortSourceDescription).toBe('Comfortable yellow chair for daily work')
    expect(result.items[1]?.product.primaryCategory).toBe('Tuin & Buitenleven')
  })

  it('lost relatieve afbeeldingspaden op met imageBaseUrl', async () => {
    const result = await htmlAdapter.fetchItems(contextFor())
    expect(result.items[0]?.product.imageUrl).toBe(
      'https://raw.githubusercontent.com/odoo/odoo/master/addons/product/static/img/product_chair.jpg',
    )
  })

  it('valt terug op de overzichtspagina wanneer de bron geen productlink heeft', async () => {
    const config = htmlConfigSchema.parse(odoo.configuration)
    const result = await htmlAdapter.fetchItems(contextFor())
    expect(result.items.every((item) => item.offer.destinationUrl === config.listUrl)).toBe(true)
  })

  it('markeert een democatalogus als demo en verzint geen referentieprijs', async () => {
    const result = await htmlAdapter.fetchItems(contextFor())
    expect(result.items.every((item) => item.product.isDemo)).toBe(true)
    expect(result.items.every((item) => item.offer.referencePriceCents === null)).toBe(true)
    expect(result.items.every((item) => item.offer.referencePriceType === null)).toBe(true)
  })

  it('slaat rijen zonder prijs over en meldt dat', async () => {
    const result = await htmlAdapter.fetchItems(contextFor())
    expect(result.items.some((item) => item.product.title === 'Table frame')).toBe(false)
    expect(result.warnings.join(' ')).toContain('Table frame')
  })

  it('respecteert de limiet uit de context', async () => {
    const result = await htmlAdapter.fetchItems({ ...contextFor(), limit: 1 })
    expect(result.items).toHaveLength(1)
  })
})
