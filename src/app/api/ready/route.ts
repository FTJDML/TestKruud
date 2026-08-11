import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database/client'
import { productionConfigProblems, serverEnv } from '@/lib/env'
import { logger, errorMessage } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Check = 'ok' | 'fout'

/**
 * Readiness: is de database bereikbaar en is de configuratie compleet?
 *
 * Het antwoord bevat alleen statuswoorden — geen verbindingsgegevens, geen
 * secretnamen met waarden, geen databasefouten. Details staan in de log van de
 * container, niet in het HTTP-antwoord.
 */
export async function GET() {
  const env = serverEnv()
  let database: Check = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    database = 'fout'
    logger.error('Readinesscheck: database onbereikbaar', { reason: errorMessage(error) })
  }

  const problems = productionConfigProblems(env)
  if (problems.length > 0) {
    logger.error('Readinesscheck: configuratie incompleet', { problems: problems.length })
  }

  const ready = database === 'ok' && problems.length === 0
  return NextResponse.json(
    {
      status: ready ? 'ready' : 'niet-gereed',
      appEnv: env.APP_ENV,
      database,
      configuration: problems.length === 0 ? 'ok' : 'incompleet',
    },
    { status: ready ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  )
}
