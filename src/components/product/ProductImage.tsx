import Image from 'next/image'
import { cn } from '@/lib/utils'

type Props = {
  src: string
  alt: string
  /** Boven de eerste viewport: hero en de eerste kaarten. */
  priority?: boolean
  sizes?: string
  className?: string
  rounded?: 'tile' | 'card'
}

/**
 * Vierkante afbeeldingcontainer met vaste aspect ratio, zodat er geen layout
 * shift ontstaat. Alles buiten de eerste viewport laadt lazy.
 */
export function ProductImage({
  src,
  alt,
  priority = false,
  sizes = '(min-width: 1280px) 320px, (min-width: 768px) 33vw, 90vw',
  className,
  rounded = 'tile',
}: Props) {
  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden bg-canvas',
        rounded === 'card' ? 'rounded-card' : 'rounded-tile',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className="object-cover"
      />
    </div>
  )
}
