import type { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

export type PromotionSummary = {
  promoted: number
  waitingForImage: number
  waitingForContent: number
}

/**
 * Promoveert `DRAFT`-producten naar `PUBLISHED` zodra alle controles klaar zijn:
 * een gevalideerde afbeelding én redactionele content.
 *
 * `DRAFT` betekent "bedoeld om te publiceren, wacht nog op controles".
 * `CANDIDATE` blijft staan tot een mens het product in /admin goedkeurt, en
 * `NEEDS_REVIEW` wacht op een redactionele beoordeling; die twee worden hier
 * bewust niet aangeraakt.
 */
export async function promotePublishableProducts(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<PromotionSummary> {
  const drafts = await prisma.product.findMany({
    where: { status: 'DRAFT' },
    select: {
      id: true,
      slug: true,
      imageStatus: true,
      publishedAt: true,
      editorial: { select: { id: true } },
    },
  })

  const summary: PromotionSummary = { promoted: 0, waitingForImage: 0, waitingForContent: 0 }
  const ready: Array<{ id: string; publishedAt: Date | null }> = []

  for (const product of drafts) {
    if (product.imageStatus !== 'VALID') {
      summary.waitingForImage += 1
      continue
    }
    if (!product.editorial) {
      summary.waitingForContent += 1
      continue
    }
    ready.push({ id: product.id, publishedAt: product.publishedAt })
  }

  for (const product of ready) {
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'PUBLISHED', publishedAt: product.publishedAt ?? now },
    })
    summary.promoted += 1
  }

  logger.info('Producten gepromoveerd naar PUBLISHED', { ...summary })
  return summary
}
