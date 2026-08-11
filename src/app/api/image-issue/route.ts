import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkSameOrigin } from '@/lib/security/csrf'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  productId: z.string().min(1).max(60),
  reason: z.enum(['browser-load-failed']).default('browser-load-failed'),
})

/**
 * Meldpunt voor een afbeelding die in de browser niet laadt.
 *
 * Deze route **verandert de database niet**. Zij logt alleen het product-ID en
 * de reden, zodat de oorzaak terug te vinden is; de dagelijkse image-healthjob
 * controleert het product opnieuw en zet pas dan `imageStatus` op INVALID. Een
 * bezoeker kan dus niet met een verzoekje een product van de site halen.
 *
 * Er wordt niets over de bezoeker opgeslagen en geen URL doorgegeven.
 */
export async function POST(request: Request) {
  const origin = checkSameOrigin(request)
  if (!origin.ok) return NextResponse.json({ error: 'Ongeldige herkomst.' }, { status: 403 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })

  logger.warn('Afbeelding laadde niet in de browser', {
    productId: parsed.data.productId,
    reason: parsed.data.reason,
  })
  return new NextResponse(null, { status: 204 })
}
