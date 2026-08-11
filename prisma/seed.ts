import '../src/lib/load-env'
import { prisma } from '../src/lib/database/client'
import { serverEnv } from '../src/lib/env'
import { demoMerchants } from '../src/merchants/fixtures/demo-merchants'
import { generateMissingContent } from '../src/jobs/lib/content'
import { ingestMerchant } from '../src/jobs/lib/ingest'
import { publishDailyEdition } from '../src/jobs/lib/publish-edition'

/**
 * Seed: demo-merchants, demo-producten (isDemo, noindex), redactionele
 * fixturecontent en één gepubliceerde editie voor vandaag.
 *
 * Testfixtures (saves en clicks) komen hier nooit in; die staan in
 * tests/fixtures en worden alleen door tests gebruikt.
 */
async function main(): Promise<void> {
  const env = serverEnv()
  if (!env.SEED_DEMO_CONTENT) {
    console.info('SEED_DEMO_CONTENT staat op false; er wordt geen demo-inhoud geplaatst.')
    return
  }

  for (const merchant of demoMerchants) {
    await prisma.merchant.upsert({
      where: { slug: merchant.slug },
      create: {
        slug: merchant.slug,
        name: merchant.name,
        domain: merchant.domain,
        sourceType: merchant.sourceType,
        enabled: true,
        scrapingAllowed: false,
        trustScore: merchant.trustScore,
        configuration: {},
      },
      update: {
        name: merchant.name,
        domain: merchant.domain,
        sourceType: merchant.sourceType,
        trustScore: merchant.trustScore,
        enabled: true,
      },
    })
  }
  console.info(`${demoMerchants.length} demo-merchants klaargezet.`)

  const merchants = await prisma.merchant.findMany({ where: { sourceType: 'FIXTURE' } })
  let created = 0
  for (const merchant of merchants) {
    const summary = await ingestMerchant(prisma, merchant)
    created += summary.productsCreated
    if (summary.error) console.warn(`Let op (${merchant.slug}): ${summary.error}`)
  }
  console.info(`${created} demo-producten aangemaakt.`)

  const content = await generateMissingContent(prisma)
  console.info(
    `Redactionele content: ${content.generated} gegenereerd, ${content.skipped} onveranderd, ${content.needsReview} met review nodig.`,
  )

  const edition = await publishDailyEdition(prisma)
  console.info(
    edition.published
      ? `Editie ${edition.editionDate} gepubliceerd met hero en ${edition.itemCount} extra producten.`
      : `Geen editie gepubliceerd: ${edition.reason ?? 'onbekende reden'}`,
  )
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
