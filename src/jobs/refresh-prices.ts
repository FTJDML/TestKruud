import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { assertProductionEnv, demoContentEnabled, serverEnv } from '@/lib/env'
import { isDemoMerchant } from '@/merchants/sources/live-sources'
import { ingestMerchant, markStaleOffers } from '@/jobs/lib/ingest'
import { analyseAllPrices } from '@/jobs/lib/analyze-prices'
import { withConcurrency } from '@/lib/scraping/rate-limit'
import { errorMessage, logger } from '@/lib/logger'

/**
 * `pnpm job:refresh-prices` — alleen prijs en voorraad bijwerken.
 *
 * Mag meerdere keren per dag draaien: er komen geen nieuwe producten bij, er
 * wordt geen content gegenereerd en de dagelijkse editie blijft ongemoeid. Wat
 * wél gebeurt, is de eigen prijsanalyse opnieuw berekenen, zodat een prijsdaling
 * meteen zichtbaar is op de productpagina.
 */
async function main(): Promise<void> {
  const env = serverEnv()
  assertProductionEnv(env)
  const now = new Date()

  const found = await prisma.merchant.findMany({ where: { enabled: true }, orderBy: { slug: 'asc' } })
  const merchants = demoContentEnabled() ? found : found.filter((merchant) => !isDemoMerchant(merchant))
  if (merchants.length === 0) {
    console.info('Geen bronnen om te verversen.')
    await prisma.$disconnect()
    return
  }

  const summaries = await withConcurrency(merchants, env.SCRAPER_MAX_CONCURRENCY, async (merchant) => {
    try {
      return await ingestMerchant(prisma, merchant, { now, pricesOnly: true })
    } catch (error) {
      const reason = errorMessage(error)
      logger.error('Prijsverversing mislukt', { merchant: merchant.slug, reason })
      return {
        merchantSlug: merchant.slug,
        productsFound: 0,
        productsCreated: 0,
        offersUpdated: 0,
        warnings: [],
        error: reason,
      }
    }
  })

  const stale = await markStaleOffers(prisma, now)
  const analysis = await analyseAllPrices(prisma, { now })

  console.info(
    JSON.stringify({
      merchants: summaries.length,
      offersUpdated: summaries.reduce((sum, entry) => sum + entry.offersUpdated, 0),
      staleOffers: stale,
      analysed: analysis.analysed,
      errors: summaries.filter((entry) => entry.error).map((entry) => entry.merchantSlug),
    }),
  )
  await prisma.$disconnect()
}

main().catch(async (error: unknown) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
