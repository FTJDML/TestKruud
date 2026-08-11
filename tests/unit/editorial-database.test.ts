import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { resetServerEnvCache } from '@/lib/env'
import { getEditorialPageBySlug, getIndexableEditorialPages } from '@/lib/database/editorial-queries'
import { getProductBySlug, getIndexableProducts } from '@/lib/database/queries'
import { evaluatePage, refreshIndexability } from '@/lib/editorial/service'
import { collectLaunchDashboard } from '@/lib/editorial/launch-metrics'
import { importCsvRows } from '@/jobs/lib/import-products'
import { parseProductImport } from '@/lib/csv/product-import'
import { productJsonLd } from '@/lib/seo/jsonld'
import { comparisonCriteriaSeeds } from '@/lib/editorial/criteria'

/**
 * Deze tests gebruiken een echte database en slaan zichzelf over zonder
 * DATABASE_URL, zodat `pnpm test` altijd werkt.
 */
const connectionString = process.env.DATABASE_URL ?? ''
const hasDatabase = connectionString.length > 0
const now = new Date()

describe.skipIf(!hasDatabase)('redactionele pagina in de database', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const suffix = `ed-${Math.round(Number(process.hrtime.bigint() % 1_000_000n))}`
  const created = { products: [] as string[], pages: [] as string[], sources: [] as string[] }
  let merchantId = ''
  let clusterId = ''
  let pageSlug = ''
  let pageId = ''

  async function makeProduct(name: string, priceCents: number): Promise<string> {
    const product = await prisma.product.create({
      data: {
        slug: `${name}-${suffix}`,
        title: `Redactietest ${name}`,
        normalizedTitle: `redactietest ${name}`,
        primaryCategory: 'Keuken & Apparaten',
        specifications: { Maalgraden: '40', Bonenreservoir: '250 g' },
        imageUrl: '/demo/placeholder.svg',
        imageAlt: 'Redactietest',
        imageStatus: 'VALID',
        imageCheckedAt: now,
        lastValidImageUrl: '/demo/placeholder.svg',
        status: 'PUBLISHED',
        publishedAt: now,
        isDemo: false,
        editorial: {
          create: {
            headline: `Kop voor ${name}`,
            teaser: 'Een korte Nederlandse teaser voor deze redactietest met genoeg tekst erin.',
            longDescription: 'x'.repeat(600),
            whyItStandsOut: 'Deze molen bestaat om de redactionele engine te testen.',
            caveat: 'Niet echt te koop; dit is een testproduct.',
            seoTitle: `Redactietest ${name}`,
            metaDescription: 'Testproduct voor de redactionele engine met een nette meta description.',
            promptVersion: 'test',
            aiProvider: 'test',
            reviewedAt: now,
            humanReviewedAt: now,
          },
        },
        offers: {
          create: {
            merchantId,
            externalOfferId: `${name}-${suffix}`,
            currentPrice: (priceCents / 100).toFixed(2),
            referencePrice: ((priceCents * 1.3) / 100).toFixed(2),
            referencePriceType: 'MERCHANT_WAS_PRICE',
            currency: 'EUR',
            inStock: true,
            destinationUrl: 'https://test.example/product',
            checkedAt: now,
          },
        },
        analysis: {
          create: {
            currentPrice: (priceCents / 100).toFixed(2),
            numberOfObservedPrices: 12,
            numberOfComparedMerchants: 1,
            analysisVersion: 'test',
            historyDays: 40,
            firstSeenAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
            lastSeenAt: now,
          },
        },
      },
    })
    created.products.push(product.id)
    return product.id
  }

  beforeAll(async () => {
    process.env.APP_ENV = 'test'
    process.env.DEMO_CONTENT_ENABLED = 'true'
    resetServerEnvCache()

    const merchant = await prisma.merchant.create({
      data: {
        slug: `merchant-${suffix}`,
        name: 'Redactiewinkel',
        domain: 'redactie.example',
        sourceType: 'FIXTURE',
        enabled: true,
      },
    })
    merchantId = merchant.id

    const cluster = await prisma.contentCluster.create({
      data: {
        slug: `cluster-${suffix}`,
        title: 'Testcluster',
        introduction: 'Een cluster om de redactionele engine te testen.',
        categorySlugs: ['keuken-en-apparaten'],
        seoTitle: 'Testcluster',
        metaDescription: 'Cluster voor de tests van de redactionele engine.',
        status: 'PUBLISHED',
        visible: true,
        minProducts: 1,
        minEditorialPages: 1,
      },
    })
    clusterId = cluster.id

    // Criteria uit de bibliotheek; de seed heeft ze mogelijk al aangemaakt.
    for (const criterion of comparisonCriteriaSeeds.slice(0, 4)) {
      await prisma.comparisonCriterion.upsert({
        where: { name: criterion.name },
        create: criterion,
        update: {},
      })
    }

    const productIds = await Promise.all([
      makeProduct('molen-a', 24_900),
      makeProduct('molen-b', 34_900),
      makeProduct('molen-c', 44_900),
    ])

    const source = await prisma.evidenceSource.create({
      data: {
        sourceType: 'MANUFACTURER_DOCUMENTATION',
        title: `Handleiding ${suffix}`,
        publisher: 'Voorbeeldmerk',
        factTypes: ['afmetingen', 'vermogen'],
      },
    })
    created.sources.push(source.id)

    pageSlug = `koffiemolens-${suffix}`
    const page = await prisma.editorialPage.create({
      data: {
        type: 'COMPARISON',
        title: 'Koffiemolens voor de redactietest vergeleken',
        slug: pageSlug,
        clusterId,
        primaryQuery: `welke koffiemolen past bij de redactietest ${suffix}`,
        searchIntent: 'COMMERCIAL_INVESTIGATION',
        introduction: 'x'.repeat(260),
        methodology: 'y'.repeat(140),
        selectionCriteria: 'Maalgraden, bonenreservoir, type maalwerk en waterreservoir.',
        conclusion: 'De keuze hangt af van het aanrecht en het aantal koppen per dag.',
        seoTitle: `Koffiemolens vergeleken ${suffix}`,
        metaDescription: `Drie koffiemolens vergeleken op gecontroleerde specificaties, test ${suffix}.`,
        status: 'PUBLISHED',
        publishedAt: now,
        reviewedAt: now,
        lastFactCheckedAt: now,
        featuredProductId: productIds[1],
        featuredLabel: 'Beste voor beginners',
        featuredReason:
          'Deze molen heeft de meeste maalgraden van de drie en past nog op een klein aanrecht.',
        featuredCaveat: 'Het bonenreservoir is kleiner dan bij de andere twee.',
        products: {
          create: productIds.map((productId, index) => ({
            productId,
            role: 'SELECTED' as const,
            position: index,
            caveat: 'De doserlade is klein; naschenken hoort erbij.',
            bestForAudience: 'thuisbaristas',
            recommendation: 'Van de drie molens heeft deze het fijnste bereik aan maalgraden.',
          })),
        },
        criteria: {
          create: comparisonCriteriaSeeds.slice(0, 4).map((criterion, index) => ({
            criterionName: criterion.name,
            displayOrder: index,
          })),
        },
        sources: { create: [{ sourceId: source.id }] },
      },
    })
    pageId = page.id
    created.pages.push(page.id)

    // Alle criteriumwaarden gecontroleerd, met bron — op één na: die blijft
    // bewust "niet opgegeven".
    for (const productId of productIds) {
      for (const [index, criterion] of comparisonCriteriaSeeds.slice(0, 4).entries()) {
        const isMissing = productId === productIds[2] && index === 3
        await prisma.productCriterionValue.create({
          data: {
            editorialPageId: page.id,
            productId,
            criterionName: criterion.name,
            value: isMissing ? null : `${20 + index * 10}`,
            sourceId: isMissing ? null : source.id,
            verificationStatus: isMissing ? 'NOT_PROVIDED' : 'VERIFIED',
            verifiedAt: isMissing ? null : now,
          },
        })
      }
    }

    await refreshIndexability(prisma, page.id, now)
  })

  afterAll(async () => {
    await prisma.editorialPage.deleteMany({ where: { id: { in: created.pages } } })
    await prisma.product.deleteMany({ where: { id: { in: created.products } } })
    await prisma.evidenceSource.deleteMany({ where: { id: { in: created.sources } } })
    await prisma.contentCluster.deleteMany({ where: { slug: `cluster-${suffix}` } })
    await prisma.merchant.deleteMany({ where: { slug: `merchant-${suffix}` } })
    await prisma.$disconnect()
  })

  it('is indexeerbaar en staat in de sitemap', async () => {
    const evaluation = await evaluatePage(prisma, pageId, now)
    expect(evaluation?.reasons ?? []).toEqual([])
    expect(evaluation?.verdict.indexable).toBe(true)

    const slugs = (await getIndexableEditorialPages()).map((page) => page.slug)
    expect(slugs).toContain(pageSlug)
  })

  it('vult een ontbrekende criteriumwaarde niet aan', async () => {
    const page = await getEditorialPageBySlug(pageSlug)
    expect(page).not.toBeNull()
    const cells = page!.selected.flatMap((entry) => entry.cells)
    const missing = cells.filter((cell) => cell.value === null)
    expect(missing).toHaveLength(1)
    expect(missing[0]?.verificationStatus).toBe('NOT_PROVIDED')
    // De overige waarden zijn gecontroleerd en hebben een bron.
    const verified = cells.filter((cell) => cell.value !== null)
    expect(verified.every((cell) => cell.verificationStatus === 'VERIFIED')).toBe(true)
    expect(verified.every((cell) => cell.sourceLabel !== null)).toBe(true)
  })

  it('toont een ongecontroleerde waarde niet als feit', async () => {
    const criterion = comparisonCriteriaSeeds[0]!
    const productId = created.products[0]!
    await prisma.productCriterionValue.update({
      where: {
        editorialPageId_productId_criterionName: {
          editorialPageId: pageId,
          productId,
          criterionName: criterion.name,
        },
      },
      data: { verificationStatus: 'UNVERIFIED' },
    })

    const page = await getEditorialPageBySlug(pageSlug)
    const cell = page!.selected
      .find((entry) => entry.product.id === productId)!
      .cells.find((entry) => entry.criterionName === criterion.name)
    expect(cell?.value).toBeNull()

    // En de pagina is daardoor niet meer indexeerbaar.
    const evaluation = await refreshIndexability(prisma, pageId, now)
    expect(evaluation?.verdict.indexable).toBe(false)
    expect(evaluation?.reasons.join(' ')).toContain('niet gecontroleerd')

    await prisma.productCriterionValue.update({
      where: {
        editorialPageId_productId_criterionName: {
          editorialPageId: pageId,
          productId,
          criterionName: criterion.name,
        },
      },
      data: { verificationStatus: 'VERIFIED' },
    })
    await refreshIndexability(prisma, pageId, now)
  })

  it('blokkeert een verweesde pagina', async () => {
    const orphan = await prisma.editorialPage.create({
      data: {
        type: 'DISCOVERY_COLLECTION',
        title: 'Verweesde vondstencollectie voor de test',
        slug: `verweesd-${suffix}`,
        primaryQuery: `welke bijzondere vondsten passen bij test ${suffix}`,
        introduction: 'x'.repeat(260),
        seoTitle: `Verweesde collectie ${suffix}`,
        metaDescription: `Collectie zonder interne link, test ${suffix}, met genoeg tekens erin.`,
        status: 'PUBLISHED',
        publishedAt: now,
        reviewedAt: now,
        lastFactCheckedAt: now,
        // Geen cluster en geen goedgekeurde inkomende link.
        products: {
          create: created.products.map((productId, index) => ({
            productId,
            role: 'SELECTED' as const,
            position: index,
            caveat: 'Alleen bedoeld om de linkregels te testen.',
          })),
        },
        sources: { create: [{ sourceId: created.sources[0]! }] },
      },
    })
    created.pages.push(orphan.id)

    const evaluation = await refreshIndexability(prisma, orphan.id, now)
    expect(evaluation?.verdict.indexable).toBe(false)
    expect(evaluation?.reasons.join(' ')).toContain('verweesde pagina')

    // Een goedgekeurde interne link haalt de blokkade weg.
    await prisma.internalLinkSuggestion.create({
      data: {
        fromType: 'CLUSTER',
        fromRef: `cluster-${suffix}`,
        toType: 'EDITORIAL_PAGE',
        toRef: orphan.slug,
        anchorText: orphan.title,
        reason: 'test',
        status: 'APPROVED',
      },
    })
    const second = await refreshIndexability(prisma, orphan.id, now)
    expect(second?.reasons.join(' ')).not.toContain('verweesde pagina')

    await prisma.internalLinkSuggestion.deleteMany({ where: { toRef: orphan.slug } })
  })

  it('laat een niet-indexeerbaar product wel browsebaar', async () => {
    const product = await prisma.product.create({
      data: {
        slug: `alleen-merchanttekst-${suffix}`,
        title: 'Product met alleen merchanttekst',
        normalizedTitle: 'product met alleen merchanttekst',
        primaryCategory: 'Keuken & Apparaten',
        // Geen specificaties en geen prijshistorie: geen eigen inhoud.
        specifications: {},
        shortSourceDescription: 'z'.repeat(800),
        imageUrl: '/demo/placeholder.svg',
        imageAlt: 'Test',
        imageStatus: 'VALID',
        lastValidImageUrl: '/demo/placeholder.svg',
        status: 'PUBLISHED',
        publishedAt: now,
        editorial: {
          create: {
            headline: 'Kop',
            teaser: 'Een korte Nederlandse teaser die net genoeg tekens heeft voor de test.',
            longDescription: 'y'.repeat(200),
            whyItStandsOut: 'Bestaat om de indexeringspoort te testen.',
            caveat: 'Niet echt te koop.',
            seoTitle: 'Test',
            metaDescription: 'Testproduct voor de indexeringspoort met een nette meta description.',
            promptVersion: 'test',
            aiProvider: 'test',
            reviewedAt: now,
            humanReviewedAt: now,
          },
        },
        offers: {
          create: {
            merchantId,
            externalOfferId: `merchanttekst-${suffix}`,
            currentPrice: '19.95',
            currency: 'EUR',
            inStock: true,
            destinationUrl: 'https://test.example/product',
            checkedAt: now,
          },
        },
      },
    })
    created.products.push(product.id)

    // Publiek bereikbaar…
    const view = await getProductBySlug(product.slug)
    expect(view).not.toBeNull()
    // …maar niet indexeerbaar, en dus ook niet in de sitemap.
    expect(view?.indexable).toBe(false)
    expect(view?.indexabilityReasons.join(' ')).toContain('merchanttekst')
    const slugs = (await getIndexableProducts()).map((entry) => entry.slug)
    expect(slugs).not.toContain(product.slug)
  })

  it('houdt de slug van een product na koppeling aan een affiliatefeed', async () => {
    const productId = created.products[0]!
    const before = await prisma.product.findUniqueOrThrow({ where: { id: productId } })

    const csv = [
      'merchantSlug,externalId,title,category,price,url,affiliateUrl,imageUrl,imageAlt',
      `merchant-${suffix},${before.slug}-feed,Compleet andere titel uit de feed,Keuken & Apparaten,"29,95",https://test.example/p,https://tracking.example/c/1,https://cdn.test.example/i.jpg,Alt uit de feed`,
    ].join('\n')
    const { rows, errors } = parseProductImport(csv)
    expect(errors).toEqual([])

    // Koppelen op EAN of externe ID; hier op externe ID via een eerste import.
    await prisma.product.update({ where: { id: productId }, data: { externalId: rows[0]!.externalId } })
    const summary = await importCsvRows(prisma, rows)
    expect(summary.updated).toBe(1)

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { offers: { where: { merchantId } } },
    })
    // De publieke URL verandert niet, ook niet bij een andere titel in de feed.
    expect(after.slug).toBe(before.slug)
    expect(after.title).toBe('Compleet andere titel uit de feed')
    expect(after.offers.some((offer) => offer.affiliateUrl === 'https://tracking.example/c/1')).toBe(true)
    // De nieuwe afbeelding is nog niet goedgekeurd, dus de werkende blijft staan.
    expect(after.imageUrl).toBe(before.imageUrl)
    expect(after.imageSourceUrl).toBe('https://cdn.test.example/i.jpg')
  })

  it('laat structured data overeenkomen met de zichtbare prijs', async () => {
    const view = await getProductBySlug(`molen-b-${suffix}`)
    expect(view).not.toBeNull()
    const data = productJsonLd(view!)
    expect(data).not.toBeNull()
    const offers = data?.offers as { price: string; priceCurrency: string } | undefined
    // Zichtbare prijs "€ 349" hoort bij price "349.00" — exact hetzelfde bedrag.
    expect(offers?.price).toBe((view!.pricing!.currentPriceCents / 100).toFixed(2))
    expect(offers?.priceCurrency).toBe(view!.pricing!.currency)
    expect(JSON.stringify(data)).not.toContain('AggregateRating')
    expect(JSON.stringify(data)).not.toContain('Review')
  })

  it('gebruikt in het launchdashboard alleen gemeten aantallen', async () => {
    const dashboard = await collectLaunchDashboard(prisma, {
      homepagePlacements: 7,
      homepageMinimum: 32,
      now,
    })

    const visible = dashboard.metrics.find((metric) => metric.key === 'visibleProducts')!
    const realCount = await prisma.product.count({
      where: { status: 'PUBLISHED', imageStatus: 'VALID', editorial: { isNot: null } },
    })
    expect(visible.value).toBe(realCount)

    const pages = dashboard.metrics.find((metric) => metric.key === 'publishedPages')!
    expect(pages.value).toBe(await prisma.editorialPage.count({ where: { status: 'PUBLISHED' } }))

    // De homepage haalt het minimum niet met zeven plaatsingen: dat wordt eerlijk
    // rood, niet stilletjes bijgeschat.
    const homepage = dashboard.metrics.find((metric) => metric.key === 'homepage')!
    expect(homepage.value).toBe(7)
    expect(homepage.tone).toBe('rood')
    expect(dashboard.homepage.meetsMinimum).toBe(false)

    // Elk getal is een geheel, niet-negatief aantal.
    for (const metric of dashboard.metrics) {
      expect(Number.isInteger(metric.value), metric.key).toBe(true)
      expect(metric.value, metric.key).toBeGreaterThanOrEqual(0)
    }
  })
})
