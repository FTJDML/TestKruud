import { affiliateLinksEnabled } from '@/lib/env'
import { cn } from '@/lib/utils'

/**
 * Eén compacte affiliate-disclosure voor de hele site. Staat er alleen wanneer
 * `AFFILIATE_LINKS_ENABLED=true`: zolang er geen affiliateprogramma loopt, is de
 * mededeling niet waar en hoort zij er niet te staan.
 */
export function AffiliateDisclosure({ className }: { className?: string }) {
  if (!affiliateLinksEnabled()) return null

  return (
    <p className={cn('text-xs text-muted', className)}>
      Sommige links zijn affiliatelinks. Bij een aankoop kunnen wij een commissie ontvangen.
    </p>
  )
}
