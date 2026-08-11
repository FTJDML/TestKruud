import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { assertProductionEnv, serverEnv } from '@/lib/env'
import { editionDate } from '@/lib/deals/edition-date'
import { runDailyPipeline } from '@/jobs/lib/daily-pipeline'
import { errorMessage, logger } from '@/lib/logger'

/**
 * Langlopende worker voor `docker compose`: draait de dagelijkse pipeline één
 * keer per Nederlandse kalenderdag op het ingestelde tijdstip
 * (`WORKER_DAILY_HOUR` / `WORKER_DAILY_MINUTE`, standaard 06:15).
 *
 * Er wordt elke minuut gekeken of het tijd is, in plaats van vooruit te rekenen:
 * dat is DST-proof en het overslaan van een run door een herstart is zichtbaar
 * in de log. Op een VPS zonder Docker kan in plaats hiervan crontab de
 * cron-endpoint aanroepen; zie de README.
 */
const CHECK_INTERVAL_MS = 60_000

const clock = new Intl.DateTimeFormat('nl-NL', {
  timeZone: 'Europe/Amsterdam',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function amsterdamTime(now: Date): { hour: number; minute: number } {
  const [hour = '0', minute = '0'] = clock.format(now).split(':')
  return { hour: Number.parseInt(hour, 10), minute: Number.parseInt(minute, 10) }
}

function editionKey(now: Date): string {
  return editionDate(now).toISOString().slice(0, 10)
}

async function runOnce(reason: string): Promise<void> {
  logger.info('Worker start dagelijkse pipeline', { reason })
  try {
    const result = await runDailyPipeline(prisma)
    logger.info('Worker klaar', {
      edition: result.edition.editionDate,
      published: result.edition.published,
      items: result.edition.itemCount,
      errors: result.errors.length,
    })
  } catch (error) {
    // Een mislukte run mag de worker niet stoppen: morgen is er een nieuwe kans
    // en de vorige editie blijft staan.
    logger.error('Worker: pipeline mislukt', { reason: errorMessage(error) })
  }
}

async function main(): Promise<void> {
  const env = serverEnv()
  assertProductionEnv(env)

  const targetHour = env.WORKER_DAILY_HOUR
  const targetMinute = env.WORKER_DAILY_MINUTE
  logger.info('Worker gestart', {
    appEnv: env.APP_ENV,
    schedule: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')} Europe/Amsterdam`,
  })

  if (process.env.WORKER_RUN_ON_START === 'true') {
    await runOnce('WORKER_RUN_ON_START')
  }

  let lastRunKey = process.env.WORKER_RUN_ON_START === 'true' ? editionKey(new Date()) : ''

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS))
    const now = new Date()
    const { hour, minute } = amsterdamTime(now)
    const key = editionKey(now)
    if (key === lastRunKey) continue
    if (hour < targetHour || (hour === targetHour && minute < targetMinute)) continue
    lastRunKey = key
    await runOnce('dagelijks schema')
  }
}

main().catch(async (error: unknown) => {
  logger.error('Worker gestopt', { reason: errorMessage(error) })
  await prisma.$disconnect()
  process.exit(1)
})
