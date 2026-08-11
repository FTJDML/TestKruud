import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { parseOpenIcecatExport } from '@/merchants/adapters/open-icecat'
import { parseLaunchOffers, LAUNCH_OFFER_COLUMNS } from '@/lib/csv/launch-offers'
import { importCatalogProducts, importLaunchOffers } from '@/jobs/lib/import-launch'
import { launchCategoryRules } from '@/lib/launch/catalogue'
import { getProductBySlug } from '@/lib/database/queries'

/**
 * De launchimport tegen een echte database: catalogusgegevens zonder prijs, en
 * daarna een handmatig gecontroleerde aanbieding erbij. De test laat zien dat een
 * product zonder offer DISCOVERY blijft, dat een offer met een geldige van-prijs
 * er een DEAL van maakt, en dat de herkomst van beeld en prijs bewaard blijft.
 *
 * Slaat zichzelf over zonder DATABASE_URL, zodat `pnpm test` altijd werkt.
 */
const connectionString = process.env.DATABASE_URL ?? ''
const hasDatabase = connectionString.length > 0
const now = new Date()

describe.skipIf(!hasDatabase)('launchimport in de database', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const suffix = String(Math.round(Number(process.hrtime.bigint() % 1_000_000n)))
  const ean = `9${suffix.padStart(12, '0')}`.slice(0, 13)
  const merchantSlug = `launchtest-winkel-${suffix}`
  const created = { productIds: [] as string[], merchantIds: [] as string[] }

  function icecatCsv(): string {
    const columns = {
      ean_upcs: ean,
      icecat_id: `t${suffix}`,
      title: `Launchtest ${suffix} koffiemolen met kegelmaalwerk`,
      supplier: 'Launchtest',
      prod_id: `LT-${suffix}`,
      category: 'Koffiemolens',
      highpic: 'https://images.icecat.biz/img/gallery/launchtest.jpg',
      limited: 'No',
      'spec:Maalgraden': '40 standen',
      'spec:Bonenreservoir': '250 g',
      'spec:Type maalwerk': 'kegel van staal',
      'spec:Geluid': '68 dB',
      'spec:Gewicht': '3,4 kg',
    }
    return `${Object.keys(columns).join(',')}\n${Object.values(columns)
      .map((value) => (/[",;\n]/.test(value) ? `"${value}"` : value))
      .join(',')}\n`
  }

  function offerCsv(withReference: boolean): string {
    const values: Record<string, string> = {
      ean,
      productSlug: '',
      merchantSlug,
      destinationUrl: 'https://voorbeeldwinkel.nl/p/launchtest',
      currentPrice: '389,00',
      referencePrice: withReference ? '499,00' : '',
      referencePriceType: withReference ? 'MERCHANT_WAS_PRICE' : '',
      currency: 'EUR',
      shippingCost: '0,00',
      inStock: 'ja',
      availabilityLabel: 'op voorraad',
      priceCheckedAt: now.toISOString(),
      promotionEndsAt: '',
    }
    // Prijzen bevatten een komma, dus de velden moeten aangehaald worden.
    const escape = (value: string): string => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
    return `${LAUNCH_OFFER_COLUMNS.join(',')}\n${LAUNCH_OFFER_COLUMNS.map((column) => escape(values[column] ?? '')).join(',')}\n`
  }

  beforeAll(async () => {
    if (!hasDatabase) return
    // Resten van een afgebroken run kunnen tellingen in andere tests verstoren.
    await prisma.product.deleteMany({ where: { title: { startsWith: 'Launchtest ' } } })
    await prisma.merchant.deleteMany({ where: { slug: { startsWith: 'launchtest-winkel-' } } })
  })

  afterAll(async () => {
    if (!hasDatabase) return
    await prisma.product.deleteMany({ where: { id: { in: created.productIds } } })
    await prisma.merchant.deleteMany({ where: { id: { in: created.merchantIds } } })
    await prisma.$disconnect()
  })

  it('zet een catalogusproduct neer zonder prijs, als kandidaat met te controleren afbeelding', async () => {
    const parsed = parseOpenIcecatExport(icecatCsv(), { format: 'csv', categoryRules: launchCategoryRules })
    expect(parsed.products).toHaveLength(1)

    const summary = await importCatalogProducts(prisma, parsed.products, { dataSource: 'open-icecat', now })
    expect(summary.created).toBe(1)

    const product = await prisma.product.findUnique({ where: { ean } })
    expect(product).not.toBeNull()
    created.productIds.push(product!.id)

    expect(product!.status).toBe('CANDIDATE')
    expect(product!.imageStatus).toBe('PENDING')
    expect(product!.isDemo).toBe(false)
    expect(product!.dataSource).toBe('open-icecat')
    expect(product!.imageUsageBasis).toContain('open-icecat')
    expect(product!.imageAttribution).toContain('Open Icecat')
    expect(product!.manufacturerName).toBe('Launchtest')
    // De omschrijving van de bron wordt niet overgenomen; de redactie schrijft zelf.
    expect(product!.shortSourceDescription).toBeNull()
    // Zonder handmatige offer is er geen prijs.
    const offers = await prisma.offer.count({ where: { productId: product!.id } })
    expect(offers).toBe(0)
  })

  it('blijft DISCOVERY met een gecontroleerde prijs zonder van-prijs', async () => {
    const merchant = await prisma.merchant.create({
      data: {
        slug: merchantSlug,
        name: 'Launchtest winkel',
        domain: 'voorbeeldwinkel.nl',
        sourceType: 'CSV',
        enabled: true,
        scrapingAllowed: false,
        configuration: {},
      },
    })
    created.merchantIds.push(merchant.id)

    const { rows, errors } = parseLaunchOffers(offerCsv(false))
    expect(errors).toEqual([])
    const summary = await importLaunchOffers(prisma, rows)
    expect(summary.created).toBe(1)
    expect(summary.deals).toBe(0)

    const offer = await prisma.offer.findFirst({ where: { merchantId: merchant.id } })
    expect(offer!.priceCheckMethod).toBe('MANUAL')
    expect(offer!.referencePrice).toBeNull()
    expect(offer!.affiliateUrl).toBeNull()
    expect(offer!.destinationUrl).toContain('voorbeeldwinkel.nl')
    // Elke controle levert een meting op, zodat de prijsanalyse historie krijgt.
    expect(await prisma.priceSnapshot.count({ where: { offerId: offer!.id } })).toBe(1)
  })

  it('wordt DEAL zodra er een geldige hogere van-prijs bij staat', async () => {
    const { rows } = parseLaunchOffers(offerCsv(true))
    const summary = await importLaunchOffers(prisma, rows)
    expect(summary.updated).toBe(1)
    expect(summary.deals).toBe(1)

    // Publiek zichtbaar maken vraagt een geldige afbeelding en eigen tekst; die
    // stappen doen de jobs. Voor deze test zetten wij ze zelf, zodat de
    // productpagina met de echte query te lezen is.
    const product = await prisma.product.findUnique({ where: { ean } })
    await prisma.product.update({
      where: { id: product!.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        imageStatus: 'VALID',
        imageCheckedAt: now,
        lastValidImageUrl: product!.imageUrl,
        editorial: {
          create: {
            headline: 'Een koffiemolen die veertig standen echt gebruikt',
            teaser: 'Veertig maalgraden en een kegelmaalwerk van staal, in een behuizing die op het aanrecht blijft staan.',
            longDescription:
              'De molen heeft veertig standen en een kegelmaalwerk van staal. Het bonenreservoir houdt tweehonderdvijftig gram, en met achtenzestig decibel hoor je hem in de ochtend duidelijk.',
            whyItStandsOut: 'Veertig standen is meer dan de meeste molens in deze prijsklasse bieden.',
            bestFor: ['wie filterkoffie en espresso afwisselt'],
            caveat: 'Met achtenzestig decibel is dit geen apparaat voor een stille ochtend.',
            seoTitle: 'Launchtest koffiemolen met veertig maalgraden',
            metaDescription:
              'Een koffiemolen met veertig maalgraden en een kegelmaalwerk van staal, met een gecontroleerde prijs bij de winkel.',
            promptVersion: 'test',
            aiProvider: 'template',
            experienceType: 'NOT_TESTED',
            reviewedAt: now,
            humanReviewedAt: now,
          },
        },
      },
    })

    const view = await getProductBySlug(product!.slug)
    expect(view).not.toBeNull()
    expect(view!.pricing?.kind).toBe('DEAL')
    expect(view!.pricing?.referencePrice).not.toBeNull()
    // De herkomst van de prijs staat in de bronsectie van de pagina.
    expect(view!.sources.priceCheckMethod).toBe('MANUAL')
    expect(view!.sources.imageAttribution).toContain('Open Icecat')
  })
})
