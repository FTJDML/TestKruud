import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Sparkles, Users } from 'lucide-react'
import { AdSlot } from '@/components/ads/AdSlot'
import { Breadcrumbs, type Crumb } from '@/components/product/Breadcrumbs'
import { DealCta } from '@/components/product/DealCta'
import { PriceBlock } from '@/components/product/PriceBlock'
import { ProductGrid } from '@/components/product/ProductGrid'
import { ProductImage } from '@/components/product/ProductImage'
import { ProductViewTracker } from '@/components/product/ProductViewTracker'
import { SaveButton } from '@/components/product/SaveButton'
import { StickyDealBar } from '@/components/product/StickyDealBar'
import { Badge } from '@/components/ui/Badge'
import { Container } from '@/components/ui/Container'
import { DemoNotice } from '@/components/ui/DemoNotice'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { categoryBySlug, categorySlugForName } from '@/lib/categories'
import { getProductBySlug, getRelatedProducts } from '@/lib/database/queries'
import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

// Per request gerenderd: actuele prijzen, en een build zonder database.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) {
    return buildMetadata({
      title: 'Product niet gevonden',
      description: 'Deze productpagina bestaat niet of is verwijderd.',
      path: `/product/${slug}`,
      noindex: true,
    })
  }
  return buildMetadata({
    title: product.seoTitle,
    description: product.metaDescription,
    path: `/product/${product.slug}`,
    // Demo-producten worden nooit geïndexeerd.
    noindex: product.isDemo,
    image: product.imageUrl,
    type: 'article',
  })
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const related = await getRelatedProducts(product, 4)
  const category = categoryBySlug(categorySlugForName(product.category))
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: product.category, path: `/categorie/${product.categorySlug}` },
    { name: product.headline, path: `/product/${product.slug}` },
  ]

  return (
    <>
      <JsonLd data={[productJsonLd(product), breadcrumbJsonLd(crumbs)]} />
      <ProductViewTracker productId={product.id} />

      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
      </Container>

      <Container className="pt-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12">
          <div>
            <div className="rounded-card border border-line bg-card p-4 sm:p-6">
              <ProductImage
                src={product.imageUrl}
                alt={product.imageAlt}
                priority
                sizes="(min-width: 1024px) 640px, 92vw"
              />
            </div>

            {product.isDemo ? (
              <div className="mt-4">
                <DemoNotice origin={product.demoOrigin} sourceName={product.merchantName} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/categorie/${product.categorySlug}`}
                className="text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-accent"
              >
                {product.category}
              </Link>
              {product.badge ? <Badge badge={product.badge} /> : null}
            </div>

            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {product.headline}
            </h1>
            <p className="text-sm text-muted">
              {product.title}
              {product.brand ? ` · ${product.brand}` : ''}
              {product.model ? ` ${product.model}` : ''}
            </p>

            <div className="rounded-card border border-line bg-card p-5">
              {product.pricing ? (
                <PriceBlock pricing={product.pricing} merchantName={product.merchantName} size="detail" />
              ) : (
                <p className="text-sm text-muted">Er is geen actuele prijs bekend bij een aanbieder.</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <DealCta
                  offerId={product.offerId}
                  pricing={product.pricing}
                  source="product-detail"
                  merchantName={product.merchantName}
                  size="large"
                />
                <SaveButton
                  productId={product.id}
                  productTitle={product.headline}
                  saveCount={product.saveCount}
                  variant="detail"
                />
              </div>

              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                Commerciële samenwerking: deze knop gaat naar de website van de aanbieder. Wij verkopen zelf
                niets. Zodra wij affiliate-links gebruiken, vermelden wij dat hier en op onze{' '}
                <Link href="/affiliateverklaring" className="underline hover:text-accent">
                  affiliatepagina
                </Link>
                .
              </p>
            </div>

            {product.pricing && !product.pricing.isActive ? (
              <div className="rounded-card border border-line bg-accent-soft p-5">
                <h2 className="text-sm font-semibold text-ink">Deze aanbieding is niet actief</h2>
                <p className="mt-1 text-sm text-muted">
                  {product.pricing.inStock
                    ? 'Wij hebben de prijs langer dan een dag niet kunnen controleren, dus laten we geen dealknop zien.'
                    : `${product.merchantName} heeft dit product momenteel niet op voorraad.`}{' '}
                  De productpagina blijft bestaan; hieronder staan actuele vondsten uit dezelfde categorie.
                </p>
              </div>
            ) : null}

            <div className="prose-none space-y-4 text-[15px] leading-relaxed text-ink/90">
              <p className="font-medium text-ink">{product.teaser}</p>
              <p className="whitespace-pre-line text-muted">{product.longDescription}</p>
            </div>
          </div>
        </div>
      </Container>

      <Container className="pt-12">
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-card border border-line bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Sparkles aria-hidden className="size-4 text-accent" />
              Waarom dit opvalt
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{product.whyItStandsOut}</p>
          </section>

          <section className="rounded-card border border-line bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users aria-hidden className="size-4 text-accent" />
              Voor wie is dit leuk?
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted" role="list">
              {product.bestFor.map((entry) => (
                <li key={entry} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-accent" />
                  {entry}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-card border border-line bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle aria-hidden className="size-4 text-accent" />
              Goed om te weten
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{product.caveat}</p>
          </section>
        </div>
      </Container>

      {product.specifications.length > 0 ? (
        <Container className="pt-10">
          <section className="rounded-card border border-line bg-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Specificaties volgens de aanbieder</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {product.specifications.map((spec) => (
                <div key={spec.label} className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-sm text-muted">{spec.label}</dt>
                  <dd className="text-sm font-medium text-ink">{spec.value}</dd>
                </div>
              ))}
            </dl>
            {product.shortSourceDescription ? (
              <p className="mt-4 text-xs text-muted">Brondata: {product.shortSourceDescription}</p>
            ) : null}
          </section>
        </Container>
      ) : null}

      <Container className="pt-10">
        <section className="rounded-card border border-line bg-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Prijsinformatie</h2>
          <p className="mt-2 text-sm text-muted">
            {product.pricing
              ? `Wij zagen deze prijs bij ${product.merchantName}. Laatst ${product.pricing.checkedAtLabel}.`
              : 'Er is nog geen prijsinformatie beschikbaar.'}{' '}
            {product.pricing?.referencePriceLabel
              ? `De vergelijkingsprijs is een ${product.pricing.referencePriceLabel.toLowerCase()}.`
              : 'Zonder betrouwbare vergelijkingsprijs tonen wij geen korting.'}
          </p>

          {product.priceHistory.length > 1 ? (
            <ul className="mt-4 flex flex-wrap gap-2" role="list">
              {product.priceHistory.map((point) => (
                <li
                  key={point.capturedAt.toISOString()}
                  className="rounded-pill border border-line px-3 py-1 text-xs text-muted"
                >
                  <span className="font-medium text-ink">{point.priceLabel}</span>{' '}
                  {new Intl.DateTimeFormat('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'Europe/Amsterdam',
                  }).format(point.capturedAt)}
                </li>
              ))}
            </ul>
          ) : null}

          {product.offers.length > 1 ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Alle aanbiedingen</h3>
              <ul className="mt-2 space-y-2" role="list">
                {product.offers.map((offer) => (
                  <li
                    key={offer.offerId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line px-3 py-2"
                  >
                    <span className="text-sm text-ink">{offer.merchantName}</span>
                    <span className="text-sm font-semibold">{offer.pricing.currentPrice}</span>
                    <DealCta
                      offerId={offer.offerId}
                      pricing={offer.pricing}
                      source="product-aanbiedingen"
                      merchantName={offer.merchantName}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Container>

      {/* Advertentie onder de primaire productinformatie, nooit over de CTA. */}
      <Container className="pt-10">
        <AdSlot slot="product-rectangle" variant="rectangle" />
      </Container>

      {related.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="Vergelijkbare vondsten"
            description={`Meer producten uit ${category?.name ?? product.category}.`}
            href={`/categorie/${product.categorySlug}`}
            linkLabel="Naar de categorie"
          />
          <ProductGrid products={related} surface="product-gerelateerd" />
        </Container>
      ) : null}

      <div className="h-20 lg:hidden" aria-hidden />
      <StickyDealBar
        offerId={product.offerId}
        pricing={product.pricing}
        merchantName={product.merchantName}
      />
    </>
  )
}
