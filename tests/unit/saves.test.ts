import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { testClickSources, testVisitorIds } from '../fixtures/interaction-fixtures'

/**
 * Deze test controleert de unieke combinatie van productId en
 * anonymousVisitorId tegen een echte database. Zonder DATABASE_URL wordt zij
 * overgeslagen, zodat `pnpm test` ook zonder database slaagt.
 */
const connectionString = process.env.DATABASE_URL ?? ''
const hasDatabase = connectionString.length > 0

describe.skipIf(!hasDatabase)('bewaren in de database', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const suffix = `test-${Math.round(Number(process.hrtime.bigint() % 1_000_000n))}`
  let productId = ''
  let merchantId = ''
  let offerId = ''

  beforeAll(async () => {
    const merchant = await prisma.merchant.create({
      data: {
        slug: `merchant-${suffix}`,
        name: 'Testwinkel',
        domain: 'test.example',
        sourceType: 'FIXTURE',
        enabled: false,
      },
    })
    merchantId = merchant.id

    const product = await prisma.product.create({
      data: {
        slug: `product-${suffix}`,
        title: 'Testproduct',
        normalizedTitle: 'testproduct',
        primaryCategory: 'Comfort & Gemak',
        imageUrl: '/demo/placeholder.svg',
        imageAlt: 'Testproduct',
        status: 'PUBLISHED',
        isDemo: true,
      },
    })
    productId = product.id

    const offer = await prisma.offer.create({
      data: {
        productId,
        merchantId,
        externalOfferId: `offer-${suffix}`,
        currentPrice: '49.95',
        referencePrice: '69.95',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        destinationUrl: 'https://test.example/product',
      },
    })
    offerId = offer.id
  })

  afterAll(async () => {
    await prisma.merchant.deleteMany({ where: { id: merchantId } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.$disconnect()
  })

  it('bewaart een product één keer per bezoeker', async () => {
    const visitorId = testVisitorIds[0]
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await prisma.anonymousSave.upsert({
        where: { productId_anonymousVisitorId: { productId, anonymousVisitorId: visitorId } },
        create: { productId, anonymousVisitorId: visitorId },
        update: {},
      })
    }
    const count = await prisma.anonymousSave.count({ where: { productId, anonymousVisitorId: visitorId } })
    expect(count).toBe(1)
  })

  it('weigert een tweede rij met dezelfde combinatie', async () => {
    const visitorId = testVisitorIds[1]
    await prisma.anonymousSave.create({ data: { productId, anonymousVisitorId: visitorId } })
    await expect(
      prisma.anonymousSave.create({ data: { productId, anonymousVisitorId: visitorId } }),
    ).rejects.toThrow()
  })

  it('telt saves per bezoeker apart', async () => {
    await prisma.anonymousSave.create({ data: { productId, anonymousVisitorId: testVisitorIds[2] } })
    const total = await prisma.anonymousSave.count({ where: { productId } })
    expect(total).toBe(3)
  })

  it('maakt unsaven mogelijk en daarna opnieuw bewaren', async () => {
    const visitorId = testVisitorIds[0]
    await prisma.anonymousSave.deleteMany({ where: { productId, anonymousVisitorId: visitorId } })
    expect(await prisma.anonymousSave.count({ where: { productId, anonymousVisitorId: visitorId } })).toBe(0)
    await prisma.anonymousSave.create({ data: { productId, anonymousVisitorId: visitorId } })
    expect(await prisma.anonymousSave.count({ where: { productId, anonymousVisitorId: visitorId } })).toBe(1)
  })

  it('registreert uitgaande kliks met een bron', async () => {
    await prisma.outboundClick.create({
      data: {
        productId,
        offerId,
        merchantId,
        anonymousVisitorId: testVisitorIds[0],
        source: testClickSources[0],
      },
    })
    const clicks = await prisma.outboundClick.count({ where: { productId } })
    expect(clicks).toBe(1)
  })
})
