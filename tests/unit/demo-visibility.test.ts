import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { resetServerEnvCache } from '@/lib/env'
import {
  getCategoryProducts,
  getNewProducts,
  getProductBySlug,
  getIndexableProducts,
  searchProducts,
} from '@/lib/database/queries'

/**
 * Demo-inhoud moet volledig verdwijnen zodra `DEMO_CONTENT_ENABLED` uit staat,
 * en nooit in de sitemap komen. Deze test heeft een echte database nodig en
 * wordt zonder DATABASE_URL overgeslagen, zodat `pnpm test` altijd slaagt.
 */
const connectionString = process.env.DATABASE_URL ?? ''
const hasDatabase = connectionString.length > 0
const originalFlag = process.env.DEMO_CONTENT_ENABLED

function setDemo(value: 'true' | 'false'): void {
  process.env.APP_ENV = 'test'
  process.env.DEMO_CONTENT_ENABLED = value
  resetServerEnvCache()
}

describe.skipIf(!hasDatabase)('zichtbaarheid van demo-inhoud', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const suffix = `demo-${Math.round(Number(process.hrtime.bigint() % 1_000_000n))}`
  const demoSlug = `demoproduct-${suffix}`
  const realSlug = `echtproduct-${suffix}`
  const category = 'Comfort & Gemak'
  const createdIds: string[] = []

  beforeAll(async () => {
    const merchant = await prisma.merchant.create({
      data: {
        slug: `merchant-${suffix}`,
        name: 'Testwinkel',
        domain: 'test.example',
        sourceType: 'FIXTURE',
        enabled: true,
      },
    })

    for (const [slug, isDemo] of [
      [demoSlug, true],
      [realSlug, false],
    ] as const) {
      const product = await prisma.product.create({
        data: {
          slug,
          title: `Zichtbaarheidstest ${slug}`,
          normalizedTitle: `zichtbaarheidstest ${slug}`,
          primaryCategory: category,
          imageUrl: '/demo/placeholder.svg',
          imageAlt: 'Testproduct',
          isDemo,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          // Publiek zichtbaar vraagt een gevalideerde afbeelding én content.
          imageStatus: 'VALID',
          imageCheckedAt: new Date(),
          lastValidImageUrl: '/demo/placeholder.svg',
          editorial: {
            create: {
              headline: `Kop voor ${slug}`,
              teaser: 'Een korte Nederlandse teaser voor deze zichtbaarheidstest.',
              longDescription: 'Een langere Nederlandse beschrijving voor deze zichtbaarheidstest.',
              whyItStandsOut: 'Dit product bestaat alleen om de zichtbaarheid te testen.',
              caveat: 'Niet echt te koop; dit is een testproduct.',
              seoTitle: 'Zichtbaarheidstest',
              metaDescription: 'Testproduct voor de zichtbaarheidsregels.',
              promptVersion: 'test',
              aiProvider: 'test',
            },
          },
          offers: {
            create: {
              merchantId: merchant.id,
              externalOfferId: `${slug}-offer`,
              currentPrice: '49.95',
              currency: 'EUR',
              inStock: true,
              destinationUrl: 'https://test.example/product',
              checkedAt: new Date(),
            },
          },
        },
      })
      createdIds.push(product.id)
    }
  })

  afterEach(() => {
    process.env.DEMO_CONTENT_ENABLED = originalFlag
    resetServerEnvCache()
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: createdIds } } })
    await prisma.merchant.deleteMany({ where: { slug: `merchant-${suffix}` } })
    await prisma.$disconnect()
  })

  it('toont demo-producten wanneer demo-inhoud aan staat', async () => {
    setDemo('true')
    const slugs = (await getNewProducts(200)).map((product) => product.slug)
    expect(slugs).toContain(demoSlug)
    expect(slugs).toContain(realSlug)
    expect(await getProductBySlug(demoSlug)).not.toBeNull()
  })

  it('verbergt demo-producten volledig wanneer demo-inhoud uit staat', async () => {
    setDemo('false')

    const slugs = (await getNewProducts(200)).map((product) => product.slug)
    expect(slugs).not.toContain(demoSlug)
    expect(slugs).toContain(realSlug)

    // Ook geen 200 meer op de productpagina: die bestaat dan niet.
    expect(await getProductBySlug(demoSlug)).toBeNull()
    expect(await getProductBySlug(realSlug)).not.toBeNull()

    const inCategory = await getCategoryProducts(category, { sort: 'nieuwste', page: 1, perPage: 200 })
    expect(inCategory.items.map((item) => item.slug)).not.toContain(demoSlug)

    const found = await searchProducts('Zichtbaarheidstest', 200)
    expect(found.map((item) => item.slug)).not.toContain(demoSlug)
    expect(found.map((item) => item.slug)).toContain(realSlug)
  })

  it('houdt demo-producten altijd uit de sitemap', async () => {
    for (const value of ['true', 'false'] as const) {
      setDemo(value)
      const slugs = (await getIndexableProducts()).map((product) => product.slug)
      expect(slugs).not.toContain(demoSlug)
    }
    // Dat het echte product ook in de sitemap komt, hangt daarnaast af van de
    // indexeringspoort (eigen inhoud, actieve aanbieding, bereikbaar via een
    // cluster); die regels staan in public-access.test.ts en
    // editorial-database.test.ts.
  })
})
