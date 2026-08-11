'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/client'

/** Placeholder-event voor advertentie-impressies; nog geen externe dienst. */
export function AdImpression({ slot, variant }: { slot: string; variant: string }) {
  useEffect(() => {
    trackEvent({ type: 'ad_impression', slot, variant })
  }, [slot, variant])
  return null
}
