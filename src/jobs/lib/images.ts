import type { Prisma, PrismaClient } from '@prisma/client'
import { validateImage, DEFAULT_MIN_DIMENSION } from '@/lib/images/validate'
import { allowedImageHosts } from '@/merchants/image-hosts'
import { withConcurrency } from '@/lib/scraping/rate-limit'
import { errorMessage, logger } from '@/lib/logger'

/**
 * Afbeeldingcontroles. Draaien uitsluitend in jobs: een paginaweergave haalt
 * nooit een externe afbeelding op om haar te valideren.
 *
 * Twee stappen:
 *
 * - `validatePendingImages` — nieuwe of gewijzigde afbeeldingen goedkeuren.
 *   Slaagt de nieuwe URL niet, dan blijft de laatst bekende geldige afbeelding
 *   staan. Is er geen enkele geldige afbeelding, dan wordt het product INVALID
 *   en daarmee publiek onzichtbaar.
 * - `runImageHealthCheck` — dagelijks opnieuw controleren of de afbeeldingen van
 *   gepubliceerde producten nog bestaan.
 */
export type ImageJobSummary = {
  checked: number
  valid: number
  invalid: number
  keptPrevious: number
  failed: number
}

const HEALTH_INTERVAL_HOURS = 24
const CONCURRENCY = 4

function emptySummary(): ImageJobSummary {
  return { checked: 0, valid: 0, invalid: 0, keptPrevious: 0, failed: 0 }
}

type ProductForImageCheck = {
  id: string
  slug: string
  imageUrl: string
  imageSourceUrl: string | null
  lastValidImageUrl: string | null
  offers: Array<{ merchant: { imageHosts: string[] } }>
}

const productSelect = {
  id: true,
  slug: true,
  imageUrl: true,
  imageSourceUrl: true,
  lastValidImageUrl: true,
  offers: { select: { merchant: { select: { imageHosts: true } } } },
} satisfies Prisma.ProductSelect

/** Toegestane hosts: de centrale lijst plus wat de merchants zelf opgeven. */
function hostsFor(product: ProductForImageCheck): string[] {
  const perMerchant = product.offers.flatMap((offer) => offer.merchant.imageHosts)
  return [...new Set([...allowedImageHosts(), ...perMerchant.map((host) => host.toLowerCase())])]
}

async function checkOne(
  prisma: PrismaClient,
  product: ProductForImageCheck,
  candidate: string,
  now: Date,
  summary: ImageJobSummary,
  minDimension: number,
): Promise<void> {
  summary.checked += 1
  try {
    const result = await validateImage(candidate, {
      minWidth: minDimension,
      minHeight: minDimension,
      allowedHosts: hostsFor(product),
    })

    if (result.ok) {
      summary.valid += 1
      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: candidate,
          lastValidImageUrl: candidate,
          imageStatus: 'VALID',
          imageCheckedAt: now,
          imageContentType: result.contentType,
          imageWidth: result.width,
          imageHeight: result.height,
          imageFailureReason: null,
        },
      })
      return
    }

    const fallback = product.lastValidImageUrl
    if (fallback && fallback !== candidate) {
      // Nieuwe afbeelding geweigerd; de laatst bekende goede blijft in gebruik.
      summary.keptPrevious += 1
      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: fallback,
          imageStatus: 'VALID',
          imageCheckedAt: now,
          imageFailureReason: `nieuwe afbeelding geweigerd: ${result.reason}`,
        },
      })
      logger.warn('Nieuwe afbeelding geweigerd, vorige blijft staan', {
        product: product.slug,
        reason: result.reason,
      })
      return
    }

    summary.invalid += 1
    await prisma.product.update({
      where: { id: product.id },
      data: {
        imageStatus: 'INVALID',
        imageCheckedAt: now,
        imageFailureReason: result.reason,
      },
    })
    logger.warn('Afbeelding ongeldig', { product: product.slug, reason: result.reason })
  } catch (error) {
    // Een onverwachte fout mag de status niet stilletjes op VALID laten staan,
    // maar ook niet de hele job stoppen.
    summary.failed += 1
    logger.error('Afbeeldingcontrole mislukt', {
      product: product.slug,
      reason: errorMessage(error),
    })
  }
}

/** Valideert nieuwe en gewijzigde afbeeldingen (imageStatus PENDING of een nieuwe bron-URL). */
export async function validatePendingImages(
  prisma: PrismaClient,
  options: { now?: Date; limit?: number; minDimension?: number } = {},
): Promise<ImageJobSummary> {
  const now = options.now ?? new Date()
  const summary = emptySummary()

  const products = await prisma.product.findMany({
    where: {
      status: { notIn: ['REJECTED', 'ARCHIVED'] },
      OR: [{ imageStatus: 'PENDING' }, { imageSourceUrl: { not: null } }],
    },
    select: productSelect,
    take: options.limit,
  })

  const work = products.filter(
    (product) =>
      product.imageSourceUrl === null ||
      product.imageSourceUrl !== product.imageUrl ||
      product.lastValidImageUrl !== product.imageUrl,
  )

  await withConcurrency(work, CONCURRENCY, (product) =>
    checkOne(
      prisma,
      product,
      product.imageSourceUrl ?? product.imageUrl,
      now,
      summary,
      options.minDimension ?? DEFAULT_MIN_DIMENSION,
    ),
  )

  logger.info('Afbeeldingen gecontroleerd', { ...summary })
  return summary
}

/**
 * Dagelijkse health check van gepubliceerde producten: bestaat de afbeelding nog?
 * Alleen producten die langer dan een dag niet zijn gecontroleerd.
 */
export async function runImageHealthCheck(
  prisma: PrismaClient,
  options: { now?: Date; limit?: number; minDimension?: number; intervalHours?: number } = {},
): Promise<ImageJobSummary> {
  const now = options.now ?? new Date()
  const interval = options.intervalHours ?? HEALTH_INTERVAL_HOURS
  const threshold = new Date(now.getTime() - interval * 60 * 60 * 1000)
  const summary = emptySummary()

  const products = await prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [{ imageCheckedAt: null }, { imageCheckedAt: { lt: threshold } }],
    },
    select: productSelect,
    orderBy: { imageCheckedAt: { sort: 'asc', nulls: 'first' } },
    take: options.limit ?? 200,
  })

  await withConcurrency(products, CONCURRENCY, (product) =>
    checkOne(
      prisma,
      product,
      product.imageSourceUrl ?? product.imageUrl,
      now,
      summary,
      options.minDimension ?? DEFAULT_MIN_DIMENSION,
    ),
  )

  logger.info('Image-health afgerond', { ...summary })
  return summary
}
