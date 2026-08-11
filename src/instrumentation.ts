import { productionConfigProblems, serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * Draait één keer bij het starten van de server. Ontbreekt er in productie een
 * verplicht secret, dan stopt het proces met exitcode 1: een half opgestarte
 * server mag geen verkeer krijgen. Tijdens `next build` slaan we de controle
 * over, omdat een build geen draaiende omgeving is.
 */
export function register(): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const env = serverEnv()
  const problems = productionConfigProblems(env)
  if (problems.length > 0) {
    logger.error('Productieconfiguratie is niet compleet; de app start niet', {
      problems,
      hint: 'Zie .env.example en README (Productiemodi).',
    })
    // Via een alias, zodat de edge-bundel geen directe process.exit-verwijzing
    // krijgt. In de Node-runtime stopt het proces; elders blijft de throw over.
    const runtime = globalThis.process as { exit?: (code: number) => never } | undefined
    runtime?.exit?.(1)
    throw new Error('Productieconfiguratie is niet compleet')
  }

  logger.info('Applicatie gestart', {
    appEnv: env.APP_ENV,
    demoContent: env.DEMO_CONTENT_ENABLED,
    indexing: env.SEARCH_ENGINE_INDEXING_ENABLED,
    ads: env.ADS_ENABLED,
    affiliateLinks: env.AFFILIATE_LINKS_ENABLED,
    contentProvider: env.CONTENT_PROVIDER,
  })
}
