import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { DemoNotice } from '@/components/ui/DemoNotice'
import { DealCta } from '@/components/product/DealCta'
import { ImpressionTracker } from '@/components/product/ImpressionTracker'
import { PriceBlock } from '@/components/product/PriceBlock'
import { ProductImage } from '@/components/product/ProductImage'
import { SaveButton } from '@/components/product/SaveButton'
import { cn } from '@/lib/utils'
import type { ProductCardView } from '@/types'

type Props = {
  product: ProductCardView
  /** Waar de kaart staat; gebruikt voor impressies en klikbron. */
  surface: string
  position?: number
  priority?: boolean
  className?: string
}

/**
 * De productkaart. Eén herbruikbaar component voor alle grids.
 * De kaart is geen enkele grote link: afbeelding en kop linken naar de
 * productpagina, het hartje bewaart en de CTA gaat naar de aanbieder.
 */
export function ProductCard({ product, surface, position, priority = false, className }: Props) {
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-card border border-line bg-card p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-card-hover',
        className,
      )}
    >
      <ImpressionTracker productId={product.id} surface={surface} position={position} />

      <div className="relative">
        <Link
          href={`/product/${product.slug}`}
          tabIndex={-1}
          aria-hidden
          className="block focus:outline-none"
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.imageAlt}
            productId={product.id}
            priority={priority}
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          />
        </Link>

        {product.badge ? (
          <div className="absolute left-3 top-3 z-10">
            <Badge badge={product.badge} />
          </div>
        ) : null}

        <div className="absolute right-3 top-3 z-10">
          <SaveButton productId={product.id} productTitle={product.headline} saveCount={product.saveCount} />
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Link href={`/categorie/${product.categorySlug}`} className="hover:text-accent">
            {product.category}
          </Link>
          {product.isDemo ? <DemoNotice compact /> : null}
        </p>

        <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-ink">
          <Link href={`/product/${product.slug}`} className="line-clamp-2 hover:text-accent">
            {product.headline}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted sm:line-clamp-4">
          {product.teaser}
        </p>

        {/* mt-auto lijnt prijs en CTA onderaan alle kaarten in een rij uit. */}
        <div className="mt-auto pt-4">
          {product.pricing ? (
            <PriceBlock pricing={product.pricing} merchantName={product.merchantName} />
          ) : (
            <p className="text-sm text-muted">Geen prijs bekend bij een aanbieder.</p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <DealCta
              offerId={product.offerId}
              pricing={product.pricing}
              source={surface}
              position={position}
              merchantName={product.merchantName}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </article>
  )
}
