import type { PrismaClient } from '@prisma/client'
import { demoContentEnabled, serverEnv } from '@/lib/env'
import { errorMessage, logger } from '@/lib/logger'
import { withConcurrency } from '@/lib/scraping/rate-limit'
import { isDemoMerchant } from '@/merchants/sources/live-sources'
import { generateMissingContent, type ContentSummary } from '@/jobs/lib/content'
import { analyseAllPrices, type AnalysisSummary } from '@/jobs/lib/analyze-prices'
import { runImageHealthCheck, validatePendingImages, type ImageJobSummary } from '@/jobs/lib/images'
import { promotePublishableProducts, type PromotionSummary } from '@/jobs/lib/publish-products'
import { ingestMerchant, markStaleOffers, type IngestSummary } from '@/jobs/lib/ingest'
import { publishDailyEdition, type EditionSummary } from '@/jobs/lib/publish-edition'
import { publishScheduledPages, refreshAllIndexability } from '@/lib/editorial/service'

export type DailyPipelineResult = {
  startedAt: string
  finishedAt: string
  ingest: IngestSummary[]
  staleOffers: number
  images: ImageJobSummary
  imageHealth: ImageJobSummary
  analysis: AnalysisSummary
  content: ContentSummary
  promotion: PromotionSummary
  /** Geplande redactionele pagina's die vandaag live gaan. */
  editorialPages: { published: number; blocked: number }
  /** Herberekende indexeerbaarheid van alle redactionele pagina's. */
  indexability: { checked: number; indexable: number; blocked: number }
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

  // Afbeeldingen eerst: een product zonder geldige afbeelding wordt niet
  // gepubliceerd en hoort dus ook niet in de analyse of de editie thuis.
  let images: ImageJobSummary = { checked: 0, valid: 0, invalid: 0, keptPrevious: 0, failed: 0 }
  try {
    images = await validatePendingImages(prisma, { now: startedAt })
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`afbeeldingen: ${reason}`)
    logger.error('Afbeeldingcontrole mislukt', { reason })
  }

  let imageHealth: ImageJobSummary = { checked: 0, valid: 0, invalid: 0, keptPrevious: 0, failed: 0 }
  try {
    imageHealth = await runImageHealthCheck(prisma, { now: startedAt })
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`image-health: ${reason}`)
    logger.error('Image-health mislukt', { reason })
  }

  // Prijsanalyse na de import en vóór de selectie: de editie kiest met verse
  // cijfers, inclusief verse prijsdalingen.
  let analysis: AnalysisSummary = { analysed: 0, skipped: 0, failed: 0 }
  try {
    analysis = await analyseAllPrices(prisma, { now: startedAt })
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`prijsanalyse: ${reason}`)
    logger.error('Prijsanalyse mislukt', { reason })
  }

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

  // Pas nu kan een concept publiek worden: geldige afbeelding én content.
  let promotion: PromotionSummary = { promoted: 0, waitingForImage: 0, waitingForContent: 0 }
  try {
    promotion = await promotePublishableProducts(prisma, startedAt)
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`publiceren: ${reason}`)
    logger.error('Promoveren van producten mislukt', { reason })
  }

  // Geplande redactionele pagina's publiceren, en daarna de indexeringspoort
  // opnieuw langs alle pagina's: prijzen en producten zijn net gewijzigd.
  let editorialPages = { published: 0, blocked: 0 }
  try {
    editorialPages = await publishScheduledPages(prisma, startedAt)
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`redactionele publicatie: ${reason}`)
    logger.error('Publiceren van geplande pagina\'s mislukt', { reason })
  }

  let indexability = { checked: 0, indexable: 0, blocked: 0 }
  try {
    indexability = await refreshAllIndexability(prisma, startedAt)
  } catch (error) {
    const reason = errorMessage(error)
    errors.push(`indexeerbaarheid: ${reason}`)
    logger.error('Herberekenen van indexeerbaarheid mislukt', { reason })
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
    images,
    imageHealth,
    analysis,
    content,
    promotion,
    editorialPages,
    indexability,
    edition,
    errors,
  }
  logger.info('Dagelijkse pipeline klaar', {
    edition: result.edition.editionDate,
    published: result.edition.published,
    items: result.edition.itemCount,
    contentGenerated: result.content.generated,
    contentBlocked: result.content.blocked,
    imagesValid: result.images.valid,
    imagesInvalid: result.images.invalid,
    analysed: result.analysis.analysed,
    promoted: result.promotion.promoted,
    editorialPublished: result.editorialPages.published,
    indexablePages: result.indexability.indexable,
    staleOffers,
    errors: errors.length,
  })
  return result
}
