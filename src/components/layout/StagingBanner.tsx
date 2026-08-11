import { stagingMode } from '@/lib/env'

/**
 * Melding bovenaan een stagingomgeving. Staat er alleen wanneer
 * `STAGING_MODE=true`, en dus nooit in productie: daar zou de melding onwaar zijn.
 *
 * De tekst is bewust kort en feitelijk. Een bezoeker van de staging moet in één
 * regel weten dat de prijzen voorbeelddata zijn en dat er geen affiliatelinks
 * onder de knoppen zitten.
 */
export function StagingBanner() {
  if (!stagingMode()) return null

  return (
    <div className="border-b border-accent/40 bg-accent-soft">
      <p className="container-page py-2 text-center text-[11px] font-semibold tracking-wide text-ink sm:text-xs">
        Stagingomgeving · Voorbeelddata · Geen echte prijzen of affiliatelinks
      </p>
    </div>
  )
}
