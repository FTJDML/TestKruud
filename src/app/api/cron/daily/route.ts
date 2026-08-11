import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/client'
import { serverEnv } from '@/lib/env'
import { runDailyPipeline } from '@/jobs/lib/daily-pipeline'
import { errorMessage, logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET
  if (secret.length === 0) return false
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  return bearer === secret || request.headers.get('x-cron-secret') === secret
}

/**
 * Beveiligde cron-endpoint voor de dagelijkse pipeline. Zie de README voor het
 * crontab-voorbeeld op een Linux-VPS.
 */
async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  }
  try {
    const result = await runDailyPipeline(prisma)
    return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 })
  } catch (error) {
    const reason = errorMessage(error)
    logger.error('Cronrun mislukt', { reason })
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
