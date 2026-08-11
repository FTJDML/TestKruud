import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { demoContentEnabled } from '@/lib/env'
import { isDemoMerchant } from '@/merchants/sources/live-sources'
import { ingestMerchant, markStaleOffers } from '@/jobs/lib/ingest'

/**
 * Entrypoint voor `pnpm job:ingest [merchant-slug]`. Leest merchantbronnen uit
 * zonder de editie opnieuw te publiceren.
 */
async function main(): Promise<void> {
  const slug = process.argv[2]
  const found = await prisma.merchant.findMany({
    where: slug ? { slug } : { enabled: true },
    orderBy: { slug: 'asc' },
  })
  // Demo- en fixturebronnen worden in productie niet ingelezen.
  const merchants = demoContentEnabled() ? found : found.filter((merchant) => !isDemoMerchant(merchant))
  if (found.length > merchants.length) {
    console.info(`${found.length - merchants.length} demobron(nen) overgeslagen: demo-inhoud staat uit.`)
  }
  if (merchants.length === 0) {
    // Alleen demobronnen over is een geldige toestand, geen fout: dat is
    // precies wat er in productie gebeurt zolang er geen echte merchant is.
    if (found.length > 0) {
      console.info('Niets in te lezen: er zijn alleen demobronnen en die staan uit.')
      await prisma.$disconnect()
      return
    }
    console.error(slug ? `Merchant ${slug} niet gevonden.` : 'Geen ingeschakelde merchants gevonden.')
    process.exit(1)
  }
  for (const merchant of merchants) {
    const summary = await ingestMerchant(prisma, merchant)
    console.info(JSON.stringify(summary))
  }
  const stale = await markStaleOffers(prisma)
  console.info(`${stale} aanbiedingen gemarkeerd als stale.`)
  await prisma.$disconnect()
}

main().catch(async (error: unknown) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
