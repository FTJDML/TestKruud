import '../src/lib/load-env'
import { prisma } from '../src/lib/database/client'
import { isProductionEnv } from '../src/lib/env'

/**
 * Haalt de fixtureproducten uit de zichtbare catalogus.
 *
 * De acht demo-merchants uit `src/merchants/fixtures` bestaan om de site te
 * kunnen bouwen zonder bron: hun afbeeldingen zijn getekende illustraties met
 * "demo" in de hoek. Voor een launchversie met echte productdata horen zij niet
 * in beeld. Ze worden gearchiveerd, niet verwijderd: zo blijven hun redactionele
 * teksten en de e2e-fixtures bestaan en kun je ze terugzetten met
 * `--restore`.
 *
 *   pnpm launch:hide-fixtures
 *   pnpm launch:hide-fixtures --restore
 */
async function main(): Promise<void> {
  if (isProductionEnv()) {
    console.error('In productie staan fixtureproducten al niet publiek; dit script doet daar niets.')
    process.exitCode = 1
    return
  }

  const restore = process.argv.includes('--restore')
  const fixtureMerchants = await prisma.merchant.findMany({
    where: { sourceType: 'FIXTURE' },
    select: { id: true, slug: true },
  })
  if (fixtureMerchants.length === 0) {
    console.info('Geen fixture-merchants gevonden; niets te doen.')
    return
  }

  const products = await prisma.product.findMany({
    where: {
      offers: { some: { merchantId: { in: fixtureMerchants.map((merchant) => merchant.id) } } },
      status: restore ? 'ARCHIVED' : { in: ['PUBLISHED', 'DRAFT', 'CANDIDATE'] },
    },
    select: { id: true, slug: true },
  })

  const result = await prisma.product.updateMany({
    where: { id: { in: products.map((product) => product.id) } },
    data: restore ? { status: 'PUBLISHED' } : { status: 'ARCHIVED' },
  })

  // Een redactionele pagina die op deze producten leunt, klopt niet meer zodra zij
  // uit beeld zijn. Die gaat terug naar concept in plaats van halfleeg te blijven.
  const affected = await prisma.editorialPage.findMany({
    where: {
      status: 'PUBLISHED',
      products: { some: { productId: { in: products.map((product) => product.id) } } },
    },
    select: { id: true, slug: true },
  })
  if (!restore && affected.length > 0) {
    await prisma.editorialPage.updateMany({
      where: { id: { in: affected.map((page) => page.id) } },
      data: {
        status: 'DRAFT',
        indexable: false,
        reviewerNotes:
          'Terug naar concept: deze pagina was opgebouwd uit demoproducten die niet meer publiek staan. Vul haar opnieuw uit de echte catalogus.',
      },
    })
  }

  console.info(
    restore
      ? `${result.count} fixtureproduct(en) teruggezet op PUBLISHED.`
      : `${result.count} fixtureproduct(en) gearchiveerd; hun illustraties staan niet meer publiek.`,
  )
  if (!restore && affected.length > 0) {
    console.info(
      `${affected.length} redactionele pagina('s) terug naar concept: ${affected.map((page) => page.slug).join(', ')}`,
    )
  }
  console.info('Draai daarna pnpm job:daily, zodat de editie en de clusters de nieuwe stand gebruiken.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
