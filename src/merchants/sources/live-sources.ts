import type { Prisma, SourceType } from '@prisma/client'

/**
 * Echte bronnen die over HTTP worden ingelezen. In tegenstelling tot de
 * fictieve demo-merchants in `../fixtures/demo-merchants` staat hier een bron
 * die daadwerkelijk van internet wordt gehaald, inclusief echte productfoto's.
 *
 * Toegestaan gebruik: de bron is publieke, open-source broncode op de
 * ongeauthenticeerde CDN van GitHub. Er wordt niets omzeild, geen anti-bot,
 * geen browser, één GET per run, met de user-agent uit `SCRAPER_USER_AGENT`.
 */
export type LiveSource = {
  slug: string
  name: string
  domain: string
  sourceType: SourceType
  trustScore: number
  /** Alleen `true` wanneer scrapen bij deze bron expliciet is toegestaan. */
  scrapingAllowed: boolean
  feedUrl: string
  configuration: Prisma.InputJsonValue
  /** Korte herkomstvermelding; komt in de README en in het adminpaneel terug. */
  attribution: string
}

const odooCatalogUrl =
  'https://raw.githubusercontent.com/odoo/odoo/master/addons/product/data/product_demo.xml'

/**
 * De democatalogus van Odoo (LGPL-3.0): ruim twintig meubels en bureau-objecten
 * met echte productfoto's op raw.githubusercontent.com. De bron levert alleen
 * een actuele prijs en geen was-prijs; er wordt dus geen referentieprijs
 * ingevuld en deze producten komen niet in de dagelijkse deal-editie.
 *
 * `markAsDemo` staat aan: de producten zijn niet te koop, dragen een
 * demo-melding en krijgen `noindex`.
 */
const odooDemoCatalog: LiveSource = {
  slug: 'odoo-democatalogus',
  name: 'Odoo democatalogus',
  domain: 'raw.githubusercontent.com',
  sourceType: 'HTML',
  trustScore: 55,
  scrapingAllowed: true,
  feedUrl: odooCatalogUrl,
  attribution: 'Odoo democatalogus (odoo/odoo, LGPL-3.0) via raw.githubusercontent.com',
  configuration: {
    listUrl: odooCatalogUrl,
    // De bron noteert afbeeldingen ten opzichte van de map `addons/`.
    imageBaseUrl: 'https://raw.githubusercontent.com/odoo/odoo/master/addons/',
    itemSelector: 'record[model="product.product"], record[model="product.template"]',
    fields: {
      externalId: { selector: 'field[name="default_code"]' },
      title: { selector: 'field[name="name"]' },
      price: { selector: 'field[name="list_price"]' },
      imageUrl: { selector: 'field[name="image_1920"]', attribute: 'file' },
      category: { selector: 'field[name="categ_id"]', attribute: 'ref' },
      description: { selector: 'field[name="description_sale"]' },
    },
    categoryMapping: {
      product_category_office: 'Wonen & Design',
      'product.product_category_office': 'Wonen & Design',
      product_category_outdoor_furniture: 'Tuin & Buitenleven',
      'product.product_category_outdoor_furniture': 'Tuin & Buitenleven',
    },
    defaultCurrency: 'EUR',
    markAsDemo: true,
    // Een democatalogus mag direct online; echte merchants houden de standaard
    // aan en vragen handmatige goedkeuring in /admin.
    autoPublish: true,
  },
}

export const liveSources: readonly LiveSource[] = [odooDemoCatalog]

/** Bronnen die demo-inhoud leveren en dus niet in productie horen. */
const demoSourceSlugs = new Set(
  liveSources
    .filter((source) => {
      const config = source.configuration as { markAsDemo?: unknown }
      return config.markAsDemo === true
    })
    .map((source) => source.slug),
)

/**
 * Levert deze merchant demo-inhoud? Fixtures altijd, en verder elke bron die
 * `markAsDemo` gebruikt. In productie worden deze bronnen niet ingelezen en
 * blijven hun producten onzichtbaar (zie `DEMO_CONTENT_ENABLED`).
 */
export function isDemoMerchant(merchant: {
  slug: string
  sourceType: SourceType
  configuration?: unknown
}): boolean {
  if (merchant.sourceType === 'FIXTURE') return true
  if (demoSourceSlugs.has(merchant.slug)) return true
  const config = merchant.configuration
  return (
    typeof config === 'object' &&
    config !== null &&
    (config as { markAsDemo?: unknown }).markAsDemo === true
  )
}
