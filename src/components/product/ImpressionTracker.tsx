'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics/client'

/**
 * Meldt één keer een product-impressie wanneer de kaart in beeld komt.
 * Bewust een minimale client component, zodat de kaart zelf server-rendered blijft.
 */
export function ImpressionTracker({
  productId,
  surface,
  position,
}: {
  productId: string
  surface: string
  position?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackEvent({ type: 'product_impression', productId, surface, position })
            observer.disconnect()
          }
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [productId, surface, position])

  return <span ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />
}
