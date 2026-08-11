'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Lokale, altijd beschikbare fallback in de huisstijl. */
export const IMAGE_FALLBACK_SRC = '/image-unavailable.svg'

type Props = {
  src: string
  alt: string
  /** Boven de eerste viewport: hero en de eerste kaarten. */
  priority?: boolean
  sizes?: string
  className?: string
  rounded?: 'tile' | 'card'
  /** Voor de image-healthmelding; zonder id wordt er niets gemeld. */
  productId?: string
}

/**
 * Vierkante afbeeldingcontainer met vaste aspect ratio, zodat er geen layout
 * shift ontstaat. Alles buiten de eerste viewport laadt lazy.
 *
 * Mislukt het laden alsnog in de browser, dan valt de afbeelding terug op een
 * lokale placeholder in dezelfde verhoudingen en wordt dat één keer gemeld bij
 * `/api/image-issue`. Die melding verandert de database niet: de dagelijkse
 * image-healthjob controleert het product opnieuw en zet pas dan de status.
 */
export function ProductImage({
  src,
  alt,
  priority = false,
  sizes = '(min-width: 1280px) 320px, (min-width: 768px) 33vw, 90vw',
  className,
  rounded = 'tile',
  productId,
}: Props) {
  const [failed, setFailed] = useState(false)

  const report = () => {
    if (failed) return
    setFailed(true)
    if (!productId) return
    // Alleen het product-ID; geen URL, geen bezoekersgegevens.
    void fetch('/api/image-issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, reason: 'browser-load-failed' }),
      keepalive: true,
    }).catch(() => undefined)
  }

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden bg-canvas',
        rounded === 'card' ? 'rounded-card' : 'rounded-tile',
        className,
      )}
    >
      <Image
        src={failed ? IMAGE_FALLBACK_SRC : src}
        alt={failed ? `${alt} (afbeelding niet beschikbaar)` : alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        onError={report}
        // De placeholder is een lokale SVG; die hoeft niet geoptimaliseerd.
        unoptimized={failed}
        className="object-cover"
      />
    </div>
  )
}
