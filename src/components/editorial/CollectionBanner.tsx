import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ProductImage } from '@/components/product/ProductImage'
import type { Collection } from '@/lib/collections'
import { cn } from '@/lib/utils'
import type { ProductCardView } from '@/types'

const tones: Record<Collection['tone'], string> = {
  coral: 'bg-accent-soft',
  sand: 'bg-sand',
  mint: 'bg-mint',
}

/**
 * Breed redactioneel promotieblok dat naar een collectiepagina linkt. Loopt over
 * de volledige gridbreedte en gebruikt een zachte accentachtergrond.
 */
export function CollectionBanner({
  collection,
  products,
}: {
  collection: Collection
  products: readonly ProductCardView[]
}) {
  const preview = products.slice(0, 3)
  return (
    <section
      aria-labelledby={`collectie-${collection.slug}`}
      className={cn('overflow-hidden rounded-card border border-line', tones[collection.tone])}
    >
      <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Collectie</p>
          <h2 id={`collectie-${collection.slug}`} className="mt-2 text-2xl font-bold sm:text-3xl">
            {collection.name}
          </h2>
          <p className="mt-1 font-display text-base font-semibold text-accent">{collection.tagline}</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{collection.intro}</p>
          <Link
            href={`/collectie/${collection.slug}`}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-pill bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-accent"
          >
            Bekijk de collectie
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        <ul className="grid grid-cols-3 gap-3 sm:gap-4" role="list">
          {preview.map((product) => (
            <li key={product.id} className="rounded-tile bg-card/80 p-2.5">
              <Link href={`/product/${product.slug}`} className="group block">
                <ProductImage
                  src={product.imageUrl}
                  alt={product.imageAlt}
                  sizes="(min-width: 1024px) 180px, 30vw"
                />
                <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-ink group-hover:text-accent">
                  {product.headline}
                </p>
                {product.pricing ? (
                  <p className="mt-1 text-xs font-bold text-ink">{product.pricing.currentPrice}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
