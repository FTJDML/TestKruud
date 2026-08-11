'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/client'

/** Meldt één keer een product-detailweergave. */
export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    trackEvent({ type: 'product_detail_view', productId })
  }, [productId])
  return null
}
