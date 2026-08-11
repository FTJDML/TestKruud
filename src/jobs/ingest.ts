import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { ingestMerchant, markStaleOffers } from '@/jobs/lib/ingest'

/**
 * Entrypoint voor `pnpm job:ingest [merchant-slug]`. Leest merchantbronnen uit
 * zonder de editie opnieuw te publiceren.
 */
async function main(): Promise<void> {
  const slug = process.argv[2]
  const merchants = await prisma.merchant.findMany({
    where: slug ? { slug } : { enabled: true },
    orderBy: { slug: 'asc' },
  })
  if (merchants.length === 0) {
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
