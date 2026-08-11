import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { assertProductionEnv } from '@/lib/env'
import { analyseAllPrices } from '@/jobs/lib/analyze-prices'

/**
 * `pnpm job:analyze-prices` — berekent de eigen prijsanalyse uit de
 * prijssnapshots. Verandert niets aan producten of aan de editie.
 */
async function main(): Promise<void> {
  assertProductionEnv()
  const summary = await analyseAllPrices(prisma)
  console.info(JSON.stringify(summary))
  await prisma.$disconnect()
}

main().catch(async (error: unknown) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
