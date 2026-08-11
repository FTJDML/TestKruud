import type { PrismaClient } from '@prisma/client'
import { demoContentEnabled, serverEnv } from '@/lib/env'
import { errorMessage, logger } from '@/lib/logger'
import { withConcurrency } from '@/lib/scraping/rate-limit'
import { isDemoMerchant } from '@/merchants/sources/live-sources'
import { generateMissingContent, type ContentSummary } from '@/jobs/lib/content'
import { ingestMerchant, markStaleOffers, type IngestSummary } from '@/jobs/lib/ingest'
import { publishDailyEdition, type EditionSummary } from '@/jobs/lib/publish-edition'

export type DailyPipelineResult = {
  startedAt: string
  finishedAt: string
  ingest: IngestSummary[]
  staleOffers: number
  content: ContentSummary
  edition: EditionSummary
  errors: string[]
}

/**
 * De dagelijkse pipeline. Draait via `pnpm job:daily` of via de beveiligde
 * cron-endpoint. Een fout in één stap laat bestaande content en de vorige
 * editie intact.
 */
export async function runDailyPipeline(
  prisma: PrismaClient,
  options: { now?: Date; skipContent?: boolean } = {},
): Promise<DailyPipelineResult> {
  const startedAt = options.now ?? new Date()
  const errors: string[] = []

  const all = await prisma.merchant.findMany({ where: { enabled: true }, orderBy: { slug: 'asc' } })
  // Demo- en fixturebronnen worden in productie niet ingelezen.
  const merchants = demoContentEnabled() ? all : all.filter((merchant) => !isDemoMerchant(merchant))
  const skippedDemoSources = all.length - merchants.length
  logger.info('Dagelijkse pipeline gestart', {
    merchants: merchants.length,
    skippedDemoSources,
  })

  const ingest = await withConcurrency(
    merchants,
    serverEnv().SCRAPER_MAX_CONCURRENCY,
    async (merchant) => {
      try {
        return await ingestMerchant(prisma, merchant, { now: startedAt })
      } catch (error) {
        const reason = errorMessage(error)
        errors.push(`${merchant.slug}: ${reason}`)
        return {
          merchantSlug: merchant.slug,
          productsFound: 0,
          productsCreated: 0,
          offersUpdated: 0,
          warnings: [],
          error: reason,
        } satisfies IngestSummary
      }
    },
  )
  for (const summary of ingest) {
    if (summary.error) errors.push(`${summary.merchantSlug}: ${summary.error}`)
  }

  const staleOffers = await markStaleOffers(prisma, startedAt)

  let content: ContentSummary = { generated: 0, skipped: 0, needsReview: 0, blocked: 0, failed: 0 }
  if (!options.skipContent) {
    try {
      content = await generateMissingContent(prisma)
    } catch (error) {
      const reason = errorMessage(error)
      errors.push(`content: ${reason}`)
      logger.error('Contentstap mislukt', { reason })
    }
  }

  let edition: EditionSummary = {
    editionDate: '',
    published: false,
    heroProductId: null,
    itemCount: 0,
    candidateCount: 0,
    reason: 'niet uitgevoerd',
  }
  try {
    edition = await publishDailyEdition(prisma, startedAt)
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`editie: ${reason}`)
    logger.error('Publiceren van de editie mislukt', { reason })
  }

  const result: DailyPipelineResult = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    ingest,
    staleOffers,
    content,
    edition,
    errors,
  }
  logger.info('Dagelijkse pipeline klaar', {
    edition: result.edition.editionDate,
    published: result.edition.published,
    items: result.edition.itemCount,
    contentGenerated: result.content.generated,
    contentBlocked: result.content.blocked,
    staleOffers,
    errors: errors.length,
  })
  return result
}
