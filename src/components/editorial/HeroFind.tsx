import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DealCta } from '@/components/product/DealCta'
import { PriceBlock } from '@/components/product/PriceBlock'
import { ProductImage } from '@/components/product/ProductImage'
import { SaveButton } from '@/components/product/SaveButton'
import { ImpressionTracker } from '@/components/product/ImpressionTracker'
import { DemoNotice } from '@/components/ui/DemoNotice'
import { formatEditionDate } from '@/lib/deals/edition-date'
import type { ProductCardView } from '@/types'

type Props = {
  product: ProductCardView
  editionDate: Date
  isToday: boolean
}

/**
 * Hero: de vondst van de dag. Twee kolommen op desktop, gestapeld op tablet en
 * mobiel. Bewust niet fullscreen, zodat de eerste producten snel zichtbaar zijn.
 */
export function HeroFind({ product, editionDate, isToday }: Props) {
  return (
    <section aria-labelledby="hero-titel" className="relative">
      <div className="relative overflow-hidden rounded-card border border-line bg-card">
        <ImpressionTracker productId={product.id} surface="home_hero" position={0} />
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="relative bg-canvas p-4 sm:p-6 lg:p-8">
            {/* Bewust geen fullscreenhero: het beeld blijft begrensd zodat de
                eerste productkaarten zonder extreem scrollen in beeld komen. */}
            <div className="mx-auto w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[400px]">
              <ProductImage
                src={product.imageUrl}
                alt={product.imageAlt}
                priority
                rounded="tile"
                sizes="(min-width: 1024px) 400px, (min-width: 640px) 360px, 300px"
              />
            </div>
            <div className="absolute right-7 top-7 z-10 sm:right-9 sm:top-9 lg:right-11 lg:top-11">
              <SaveButton
                productId={product.id}
                productTitle={product.headline}
                saveCount={product.saveCount}
              />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4 p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-pill bg-accent px-2.5 py-1 text-xs font-semibold text-white">
                Vondst van de dag
              </span>
              <Link
                href={`/categorie/${product.categorySlug}`}
                className="text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-accent"
              >
                {product.category}
              </Link>
              {product.isDemo ? <DemoNotice compact /> : null}
            </div>

            <h1 id="hero-titel" className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              <Link href={`/product/${product.slug}`} className="hover:text-accent">
                {product.headline}
              </Link>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-muted">{product.teaser}</p>

            {product.pricing ? (
              <PriceBlock pricing={product.pricing} merchantName={product.merchantName} size="hero" />
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <DealCta
                offerId={product.offerId}
                pricing={product.pricing}
                source="home_hero"
                merchantName={product.merchantName}
                size="large"
              />
              <Link
                href={`/product/${product.slug}`}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                Lees waarom dit opvalt
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>

            <p className="text-xs text-muted">
              {isToday ? 'Editie van' : 'Laatste editie:'} {formatEditionDate(editionDate)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
