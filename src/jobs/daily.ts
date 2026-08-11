import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { runDailyPipeline } from '@/jobs/lib/daily-pipeline'

/** Entrypoint voor `pnpm job:daily`. */
async function main(): Promise<void> {
  const result = await runDailyPipeline(prisma)
  console.info(JSON.stringify(result, null, 2))
  if (!result.edition.published) {
    console.warn('Let op: er is vandaag geen nieuwe editie gepubliceerd; de vorige editie blijft zichtbaar.')
  }
  await prisma.$disconnect()
  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch(async (error: unknown) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
