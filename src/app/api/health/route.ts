import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/client'
import { editionDate } from '@/lib/deals/edition-date'
import { errorMessage } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Healthcheck voor Docker Compose en monitoring: is de database bereikbaar en
 * is er een editie voor vandaag? Geeft geen gevoelige gegevens terug.
 */
export async function GET() {
  try {
    const [products, edition] = await Promise.all([
      prisma.product.count({ where: { status: 'PUBLISHED' } }),
      prisma.dailyEdition.findFirst({
        where: { editionDate: editionDate(), status: 'PUBLISHED' },
        select: { editionDate: true },
      }),
    ])
    return NextResponse.json(
      {
        status: 'ok',
        database: 'up',
        publishedProducts: products,
        editionToday: edition ? edition.editionDate.toISOString().slice(0, 10) : null,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { status: 'error', database: 'down', message: errorMessage(error) },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
