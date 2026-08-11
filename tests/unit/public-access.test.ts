import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient, type ProductStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { resetServerEnvCache } from '@/lib/env'
import {
  getCategoryProducts,
  getIndexableProducts,
  getNewProducts,
  getProductBySlug,
  searchProducts,
} from '@/lib/database/queries'
import { checkPublicVisibility, nonPublicStatuses } from '@/lib/products/visibility'
import { productJsonLd } from '@/lib/seo/jsonld'
import { promotePublishableProducts } from '@/jobs/lib/publish-products'

/**
 * Alleen `PUBLISHED` mag publiek zijn. Concepten geven een echte 404, maar zijn
 * in de beveiligde adminpreview wél te bekijken. Deze test heeft een echte
 * database nodig en wordt zonder DATABASE_URL overgeslagen.
 */
const connectionString = process.env.DATABASE_URL ?? ''
const hasDatabase = connectionString.length > 0

const allStatuses: readonly ProductStatus[] = [
  'CANDIDATE',
  'DRAFT',
  'NEEDS_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
]

describe.skipIf(!hasDatabase)('publieke toegang per productstatus', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const suffix = `status-${Math.round(Number(process.hrtime.bigint() % 1_000_000n))}`
  const category = 'Comfort & Gemak'
  const slugFor = (name: string) => `${name}-${suffix}`
  const ids = new Map<string, string>()

  async function createProduct(options: {
    name: string
    status: ProductStatus
    imageStatus?: 'PENDING' | 'VALID' | 'INVALID'
    withEditorial?: boolean
    merchantId: string
  }): Promise<string> {
    const slug = slugFor(options.name)
    const product = await prisma.product.create({
      data: {
        slug,
        title: `Statustest ${options.name}`,
        normalizedTitle: `statustest ${options.name}`,
        primaryCategory: category,
        imageUrl: '/demo/placeholder.svg',
        imageAlt: 'Statustest',
        isDemo: false,
        status: options.status,
        publishedAt: options.status === 'PUBLISHED' ? new Date() : null,
        imageStatus: options.imageStatus ?? 'VALID',
        imageCheckedAt: new Date(),
        lastValidImageUrl: options.imageStatus === 'INVALID' ? null : '/demo/placeholder.svg',
        ...(options.withEditorial === false
          ? {}
          : {
              editorial: {
                create: {
                  headline: `Kop voor ${options.name}`,
                  teaser: 'Een korte Nederlandse teaser voor deze statustest.',
                  longDescription: 'Een langere Nederlandse beschrijving voor deze statustest.',
                  whyItStandsOut: 'Dit product bestaat alleen om de statusregels te testen.',
                  caveat: 'Niet echt te koop; dit is een testproduct.',
                  seoTitle: 'Statustest',
                  metaDescription: 'Testproduct voor de publicatieregels.',
                  promptVersion: 'test',
                  aiProvider: 'test',
                },
              },
            }),
        offers: {
          create: {
            merchantId: options.merchantId,
            externalOfferId: `${slug}-offer`,
            currentPrice: '49.95',
            referencePrice: '79.95',
            referencePriceType: 'MERCHANT_WAS_PRICE',
            currency: 'EUR',
            inStock: true,
            destinationUrl: 'https://test.example/product',
            checkedAt: new Date(),
          },
        },
      },
    })
    ids.set(options.name, product.id)
    return product.id
  }

  beforeAll(async () => {
    process.env.APP_ENV = 'test'
    process.env.DEMO_CONTENT_ENABLED = 'true'
    resetServerEnvCache()

    const merchant = await prisma.merchant.create({
      data: {
        slug: `merchant-${suffix}`,
        name: 'Statuswinkel',
        domain: 'status.example',
        sourceType: 'FIXTURE',
        enabled: true,
      },
    })

    for (const status of allStatuses) {
      await createProduct({ name: status.toLowerCase(), status, merchantId: merchant.id })
    }
    // Twee gepubliceerde producten die om een andere reden niet publiek zijn.
    await createProduct({
      name: 'kapotte-afbeelding',
      status: 'PUBLISHED',
      imageStatus: 'INVALID',
      merchantId: merchant.id,
    })
    await createProduct({
      name: 'zonder-content',
      status: 'PUBLISHED',
      withEditorial: false,
      merchantId: merchant.id,
    })
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: [...ids.values()] } } })
    await prisma.merchant.deleteMany({ where: { slug: `merchant-${suffix}` } })
    await prisma.$disconnect()
  })

  it.each(nonPublicStatuses)('geeft %s publiek geen pagina', async (status) => {
    expect(await getProductBySlug(slugFor(status.toLowerCase()))).toBeNull()
  })

  it('toont alleen het PUBLISHED product op de publieke pagina', async () => {
    const detail = await getProductBySlug(slugFor('published'))
    expect(detail).not.toBeNull()
    expect(detail?.slug).toBe(slugFor('published'))
  })

  it('houdt concepten uit de overzichten en uit het zoeken', async () => {
    const newSlugs = (await getNewProducts(300)).map((product) => product.slug)
    const inCategory = (
      await getCategoryProducts(category, { sort: 'nieuwste', page: 1, perPage: 300 })
    ).items.map((item) => item.slug)
    const found = (await searchProducts('Statustest', 300)).map((item) => item.slug)

    for (const status of nonPublicStatuses) {
      const slug = slugFor(status.toLowerCase())
      expect(newSlugs, status).not.toContain(slug)
      expect(inCategory, status).not.toContain(slug)
      expect(found, status).not.toContain(slug)
    }
    expect(newSlugs).toContain(slugFor('published'))
  })

  it('publiceert geen product met een afgekeurde afbeelding of zonder content', async () => {
    for (const name of ['kapotte-afbeelding', 'zonder-content']) {
      expect(await getProductBySlug(slugFor(name)), name).toBeNull()
    }
    const newSlugs = (await getNewProducts(300)).map((product) => product.slug)
    expect(newSlugs).not.toContain(slugFor('kapotte-afbeelding'))
    expect(newSlugs).not.toContain(slugFor('zonder-content'))
  })

  it('zet alleen publiek zichtbare producten in de sitemap', async () => {
    const slugs = (await getIndexableProducts()).map((product) => product.slug)
    expect(slugs).toContain(slugFor('published'))
    for (const name of [...nonPublicStatuses.map((status) => status.toLowerCase()), 'kapotte-afbeelding', 'zonder-content']) {
      expect(slugs, name).not.toContain(slugFor(name))
    }
  })

  it('maakt alleen structured data voor een publiek gepubliceerd product', async () => {
    const detail = await getProductBySlug(slugFor('published'))
    expect(detail).not.toBeNull()
    expect(productJsonLd(detail!)).not.toBeNull()
    // Voor een concept bestaat er geen detailweergave, en dus ook geen JSON-LD.
    expect(await getProductBySlug(slugFor('draft'))).toBeNull()
  })

  it('laat een concept wél zien in de beveiligde adminpreview', async () => {
    for (const status of nonPublicStatuses) {
      const id = ids.get(status.toLowerCase())
      expect(id, status).toBeDefined()
      // Dezelfde query als /admin/producten/[id]/preview.
      const product = await prisma.product.findUnique({
        where: { id: id! },
        include: { editorial: true },
      })
      expect(product, status).not.toBeNull()
      expect(product?.status).toBe(status)
      const verdict = checkPublicVisibility({
        status: product!.status,
        imageStatus: product!.imageStatus,
        isDemo: product!.isDemo,
        hasEditorial: product!.editorial !== null,
      })
      expect(verdict.visible).toBe(false)
      if (!verdict.visible) expect(verdict.reason).toContain(status)
    }
  })

  it('promoveert een DRAFT met geldige afbeelding en content naar PUBLISHED', async () => {
    const id = ids.get('draft')!
    const summary = await promotePublishableProducts(prisma)
    expect(summary.promoted).toBeGreaterThanOrEqual(1)

    const after = await prisma.product.findUnique({ where: { id } })
    expect(after?.status).toBe('PUBLISHED')
    expect(after?.publishedAt).not.toBeNull()
    expect(await getProductBySlug(slugFor('draft'))).not.toBeNull()

    // De andere statussen blijven staan: promotie geldt alleen voor DRAFT.
    for (const status of ['CANDIDATE', 'NEEDS_REVIEW', 'REJECTED', 'ARCHIVED'] as const) {
      const other = await prisma.product.findUnique({ where: { id: ids.get(status.toLowerCase())! } })
      expect(other?.status, status).toBe(status)
    }

    // Terugzetten, zodat de opruiming en andere tests niets erven.
    await prisma.product.update({ where: { id }, data: { status: 'DRAFT', publishedAt: null } })
  })

  it('promoveert nooit een DRAFT zonder geldige afbeelding of zonder content', async () => {
    const merchant = await prisma.merchant.findUniqueOrThrow({ where: { slug: `merchant-${suffix}` } })
    const blocked = await Promise.all([
      createProduct({
        name: 'draft-kapot',
        status: 'DRAFT',
        imageStatus: 'INVALID',
        merchantId: merchant.id,
      }),
      createProduct({
        name: 'draft-zonder-content',
        status: 'DRAFT',
        withEditorial: false,
        merchantId: merchant.id,
      }),
      createProduct({
        name: 'draft-pending',
        status: 'DRAFT',
        imageStatus: 'PENDING',
        merchantId: merchant.id,
      }),
    ])

    const summary = await promotePublishableProducts(prisma)
    expect(summary.waitingForImage).toBeGreaterThanOrEqual(2)
    expect(summary.waitingForContent).toBeGreaterThanOrEqual(1)
    for (const id of blocked) {
      const product = await prisma.product.findUnique({ where: { id } })
      expect(product?.status).toBe('DRAFT')
    }
  })
})
