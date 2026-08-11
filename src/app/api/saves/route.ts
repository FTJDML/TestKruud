import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/database/client'
import { getSavedProductIds } from '@/lib/database/queries'
import { RateLimiter } from '@/lib/scraping/rate-limit'
import { readVisitorId } from '@/lib/saves/visitor'
import { trackServerEvent } from '@/lib/analytics/events'
import { errorMessage, logger } from '@/lib/logger'

/** Saves worden per bezoeker gelimiteerd; 60 acties per minuut is ruim genoeg. */
const limiter = new RateLimiter(30, 60)

const bodySchema = z.object({ productId: z.string().min(1).max(60) })

async function requireVisitor(): Promise<
  { visitorId: string } | { response: NextResponse }
> {
  const visitorId = await readVisitorId()
  if (!visitorId) {
    return {
      response: NextResponse.json(
        { error: 'Geen bezoekers-ID gevonden. Sta cookies toe om producten te bewaren.' },
        { status: 400 },
      ),
    }
  }
  if (!limiter.take(visitorId)) {
    return { response: NextResponse.json({ error: 'Te veel verzoeken.' }, { status: 429 }) }
  }
  return { visitorId }
}

export async function GET() {
  const visitorId = await readVisitorId()
  if (!visitorId) return NextResponse.json({ productIds: [] })
  const productIds = await getSavedProductIds(visitorId)
  return NextResponse.json({ productIds }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const guard = await requireVisitor()
  if ('response' in guard) return guard.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, status: true },
    })
    if (!product || product.status === 'REJECTED') {
      return NextResponse.json({ error: 'Product niet gevonden.' }, { status: 404 })
    }

    // De unieke combinatie productId + visitorId voorkomt dubbele saves.
    await prisma.anonymousSave.upsert({
      where: {
        productId_anonymousVisitorId: {
          productId: product.id,
          anonymousVisitorId: guard.visitorId,
        },
      },
      create: { productId: product.id, anonymousVisitorId: guard.visitorId },
      update: {},
    })

    const saveCount = await prisma.anonymousSave.count({ where: { productId: product.id } })
    await trackServerEvent({ type: 'save', productId: product.id }, { visitorId: guard.visitorId })
    return NextResponse.json({ saved: true, saveCount })
  } catch (error) {
    logger.error('Save mislukt', { reason: errorMessage(error) })
    return NextResponse.json({ error: 'Bewaren lukte niet.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const guard = await requireVisitor()
  if ('response' in guard) return guard.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  try {
    await prisma.anonymousSave.deleteMany({
      where: { productId: parsed.data.productId, anonymousVisitorId: guard.visitorId },
    })
    const saveCount = await prisma.anonymousSave.count({ where: { productId: parsed.data.productId } })
    await trackServerEvent(
      { type: 'unsave', productId: parsed.data.productId },
      { visitorId: guard.visitorId },
    )
    return NextResponse.json({ saved: false, saveCount })
  } catch (error) {
    logger.error('Unsave mislukt', { reason: errorMessage(error) })
    return NextResponse.json({ error: 'Verwijderen lukte niet.' }, { status: 500 })
  }
}
