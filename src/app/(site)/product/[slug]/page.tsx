import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Database, LineChart, Sparkles, Users } from 'lucide-react'
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
import { AffiliateDisclosure } from '@/components/ui/AffiliateDisclosure'
import { DemoNotice } from '@/components/ui/DemoNotice'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { categoryBySlug, categorySlugForName } from '@/lib/categories'
import { getComparableProducts, getProductBySlug } from '@/lib/database/queries'
import { getEditorialPagesForProduct } from '@/lib/database/editorial-queries'
import { EditorialPageCards } from '@/components/editorial/EditorialPageCards'
import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

// Per request gerenderd: actuele prijzen, en een build zonder database.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  // Bewust hier en niet pas in de pagina: `(site)/loading.tsx` maakt een
  // Suspense-grens, en na de eerste flush kan de statuscode niet meer op 404
  // worden gezet. Dat zou een soft 404 opleveren.
  if (!product) notFound()

  return buildMetadata({
    title: product.seoTitle,
    description: product.metaDescription,
    path: `/product/${product.slug}`,
    // Demo-inhoud én pagina's die de indexeringspoort niet halen: browsebaar,
    // maar niet in de index. Zij linken wel door (`noindex, follow`).
    noindex: product.isDemo || !product.indexable,
    followWhenNoindex: true,
    image: product.imageUrl,
    type: 'article',
  })
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const [related, editorialPages] = await Promise.all([
    getComparableProducts(product, 4),
    getEditorialPagesForProduct(product.id, 3),
  ])
  const category = categoryBySlug(categorySlugForName(product.category))
  const crumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: product.category, path: `/categorie/${product.categorySlug}` },
    { name: product.headline, path: `/product/${product.slug}` },
  ]

  return (
    <>
      {/*
        productJsonLd levert null bij demo-inhoud of zonder geldige prijs; een
        pagina die niet indexeerbaar is krijgt ook geen Product-markup.
      */}
      <JsonLd
        data={[product.indexable ? productJsonLd(product) : null, breadcrumbJsonLd(crumbs)]}
      />
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
                  source="product_detail"
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

              <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
                <p>
                  Deze knop gaat naar {product.merchantName}; daar rond je de aankoop af. Meer over onze
                  werkwijze staat op de{' '}
                  <Link href="/affiliateverklaring" className="underline hover:text-accent">
                    affiliatepagina
                  </Link>
                  .
                </p>
                {/* Alleen zichtbaar met AFFILIATE_LINKS_ENABLED=true. */}
                <AffiliateDisclosure />
              </div>
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
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Prijzen bij aanbieders</h3>
              <p className="mt-1 text-xs text-muted">
                {product.priceAnalysis?.comparisonBasis === 'prijs-en-verzending'
                  ? 'Vergeleken op prijs inclusief verzendkosten.'
                  : 'Vergeleken op productprijs; verzendkosten zijn niet bij elke aanbieder bekend.'}
              </p>
              <ul className="mt-3 space-y-2" role="list">
                {product.offers.map((offer, index) => (
                  <li
                    key={offer.offerId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                        <span className="font-medium">{offer.merchantName}</span>
                        {offer.isCheapest ? (
                          <span className="rounded-pill bg-deal-soft px-2 py-0.5 text-[11px] font-semibold text-deal">
                            Goedkoopst
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {offer.pricing.inStock ? 'Op voorraad' : 'Niet op voorraad'}
                        {offer.availabilityLabel ? ` · ${offer.availabilityLabel}` : ''} · Laatst{' '}
                        {offer.pricing.checkedAtLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{offer.pricing.currentPrice}</p>
                      {offer.shippingLabel ? (
                        <p className="text-xs text-muted">{offer.shippingLabel}</p>
                      ) : null}
                    </div>
                    <DealCta
                      offerId={offer.offerId}
                      pricing={offer.pricing}
                      source="product_offers"
                      position={index + 1}
                      merchantName={offer.merchantName}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Container>

      {product.priceAnalysis ? (
        <Container className="pt-8">
          <section className="rounded-card border border-line bg-card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <LineChart aria-hidden className="size-4 text-accent" />
              Onze prijsanalyse
            </h2>
            <p className="mt-1 text-xs text-muted">
              Berekend uit onze eigen prijsmetingen. Wat de data niet draagt, staat er niet.
            </p>
            <ul className="mt-4 space-y-2" role="list">
              {product.priceAnalysis.statements.map((statement) => (
                <li
                  key={statement.key}
                  className={
                    statement.tone === 'deal'
                      ? 'text-sm font-medium text-deal'
                      : 'text-sm text-muted'
                  }
                >
                  {statement.text}
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-xs text-muted sm:grid-cols-4">
              <div>
                <dt className="font-semibold text-ink">Metingen</dt>
                <dd>{product.priceAnalysis.numberOfObservedPrices}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Historie</dt>
                <dd>
                  {product.priceAnalysis.historyDays === 0
                    ? 'minder dan een dag'
                    : `${product.priceAnalysis.historyDays} dag(en)`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Aanbieders</dt>
                <dd>{product.priceAnalysis.numberOfComparedMerchants}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Betrouwbaarheid</dt>
                <dd>
                  {product.priceAnalysis.confidenceLevel === 'HIGH'
                    ? 'hoog'
                    : product.priceAnalysis.confidenceLevel === 'MEDIUM'
                      ? 'gemiddeld'
                      : 'laag'}
                </dd>
              </div>
            </dl>
          </section>
        </Container>
      ) : null}

      <Container className="pt-8">
        <section className="rounded-card border border-line bg-canvas p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Database aria-hidden className="size-4 text-muted" />
            Waar deze gegevens vandaan komen
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted" role="list">
            <li>
              Productgegevens: {product.sources.labels.length > 0 ? product.sources.labels.join(', ') : 'brondata van de aanbieder'}
            </li>
            {product.sources.imageAttribution ? (
              <li>Afbeelding: {product.sources.imageAttribution}</li>
            ) : null}
            {product.sources.priceCheckMethod !== null ? (
              <li>
                Prijscontrole:{' '}
                {product.sources.priceCheckMethod === 'MANUAL'
                  ? 'handmatig nagekeken op de winkelpagina, met datum en tijd hieronder'
                  : 'automatisch uit de bron van de aanbieder'}
              </li>
            ) : null}
            <li>
              Prijzen laatst gecontroleerd:{' '}
              {product.sources.lastCheckedAt
                ? new Intl.DateTimeFormat('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Amsterdam',
                  }).format(product.sources.lastCheckedAt)
                : 'nog niet gecontroleerd'}
            </li>
            <li>
              Prijsdata beschikbaar sinds:{' '}
              {product.sources.priceDataSince
                ? new Intl.DateTimeFormat('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Europe/Amsterdam',
                  }).format(product.sources.priceDataSince)
                : 'nog geen historie'}
            </li>
            <li>Aantal vergeleken aanbieders: {product.sources.merchantCount}</li>
            <li>
              {product.sources.experienceType === 'HANDS_ON_TESTED'
                ? 'Dit product is door onze redactie zelf gebruikt.'
                : product.sources.experienceType === 'DESK_RESEARCHED'
                  ? 'Dit product is niet door ons getest; wij baseren ons op brondata en eigen prijsmetingen.'
                  : 'Dit product is niet door ons getest.'}
            </li>
          </ul>
        </section>
      </Container>

      {/* Advertentie onder de primaire productinformatie, nooit over de CTA. */}
      <Container className="pt-10">
        <AdSlot slot="product-rectangle" variant="rectangle" />
      </Container>

      {editorialPages.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="In onze vergelijkingen"
            description="Redactionele pagina's waarin dit product naast andere producten staat."
            href="/gidsen"
            linkLabel="Alle gidsen"
          />
          <EditorialPageCards pages={editorialPages} />
        </Container>
      ) : null}

      {related.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="Vergelijkbare vondsten"
            description={`Meer producten uit ${category?.name ?? product.category}.`}
            href={`/categorie/${product.categorySlug}`}
            linkLabel="Naar de categorie"
          />
          <ProductGrid products={related} surface="product_related" />
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
