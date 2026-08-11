import Link from 'next/link'
import { ProductImage } from '@/components/product/ProductImage'
import { DealCta } from '@/components/product/DealCta'
import { PriceBlock } from '@/components/product/PriceBlock'
import type { EditorialPageView } from '@/types'

/**
 * Uitgelichte keuze. Het label benoemt altijd een doelgroep, use case of grens —
 * geen algemene rangorde — en er staat verplicht een aandachtspunt bij. Of een
 * product affiliate is, speelt hier geen rol: de reden verwijst naar de
 * vergelijkingscriteria.
 */
export function FeaturedChoice({ featured }: { featured: NonNullable<EditorialPageView['featured']> }) {
  const { product } = featured
  return (
    <section
      aria-labelledby="uitgelichte-keuze"
      className="grid gap-6 rounded-card border border-line bg-card p-5 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
    >
      <div>
        <ProductImage
          src={product.imageUrl}
          alt={product.imageAlt}
          productId={product.id}
          rounded="card"
          sizes="(min-width: 640px) 320px, 92vw"
        />
      </div>
      <div className="space-y-3">
        {featured.label ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{featured.label}</p>
        ) : null}
        <h2 id="uitgelichte-keuze" className="font-display text-xl font-extrabold sm:text-2xl">
          <Link href={`/product/${product.slug}`} className="hover:text-accent">
            {product.headline}
          </Link>
        </h2>
        {product.pricing ? (
          <PriceBlock pricing={product.pricing} merchantName={product.merchantName} size="detail" />
        ) : null}
        {featured.reason ? <p className="text-sm leading-relaxed text-ink">{featured.reason}</p> : null}
        {featured.caveat ? (
          <p className="rounded-tile border border-line bg-canvas px-3 py-2 text-sm text-muted">
            <span className="font-medium text-ink">Let op:</span> {featured.caveat}
          </p>
        ) : null}
        {featured.alternativeNote ? (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">Wanneer een alternatief beter past:</span>{' '}
            {featured.alternativeNote}
          </p>
        ) : null}
        <DealCta
          offerId={product.offerId}
          pricing={product.pricing}
          merchantName={product.merchantName}
          source="editorial_featured"
          position={0}
          size="large"
        />
      </div>
    </section>
  )
}
