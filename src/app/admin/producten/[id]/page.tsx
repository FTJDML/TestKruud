import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { computeDealPricing } from '@/lib/pricing/deal'
import { formatMoney, toCents } from '@/lib/pricing/money'
import {
  approveContentAction,
  regenerateContentAction,
  setHeroAction,
  setProductStatusAction,
  updateEditorialAction,
} from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export default async function AdminProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      editorial: true,
      offers: {
        orderBy: { currentPrice: 'asc' },
        include: {
          merchant: true,
          snapshots: { orderBy: { capturedAt: 'desc' }, take: 5 },
        },
      },
    },
  })
  if (!product) notFound()

  const styleWarnings = Array.isArray(product.editorial?.styleWarnings)
    ? (product.editorial?.styleWarnings as unknown[]).filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : []

  const specifications = Object.entries(
    (product.specifications && typeof product.specifications === 'object' && !Array.isArray(product.specifications)
      ? product.specifications
      : {}) as Record<string, unknown>,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{product.editorial?.headline ?? product.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {product.title} · {product.primaryCategory} · status {product.status}
            {product.isDemo ? ' · demo' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/producten/${product.id}/preview`}
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Preview (ook als concept)
          </Link>
          <Link
            href={`/product/${product.slug}`}
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Preview op de site
          </Link>
          {(['PUBLISHED', 'DRAFT', 'REJECTED', 'ARCHIVED'] as const).map((status) => (
            <form key={status} action={setProductStatusAction}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
              >
                {status === 'PUBLISHED'
                  ? 'Publiceren'
                  : status === 'DRAFT'
                    ? 'Offline halen'
                    : status === 'REJECTED'
                      ? 'Afwijzen'
                      : 'Archiveren'}
              </button>
            </form>
          ))}
          <form action={setHeroAction}>
            <input type="hidden" name="productId" value={product.id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Als hero instellen
            </button>
          </form>
          <form action={regenerateContentAction}>
            <input type="hidden" name="productId" value={product.id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
            >
              Content opnieuw genereren
            </button>
          </form>
        </div>
      </div>

      <section className="rounded-card border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Prijsbron</h2>
        <ul className="mt-3 space-y-3" role="list">
          {product.offers.map((offer) => {
            const pricing = computeDealPricing(offer)
            return (
              <li key={offer.id} className="rounded-tile border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{offer.merchant.name}</span>
                  <span>
                    {pricing.currentPrice}
                    {pricing.referencePrice ? ` (van ${pricing.referencePrice})` : ''}
                    {pricing.discountPercentage !== null ? ` · ${pricing.discountPercentage}%` : ''}
                  </span>
                  <span className="text-xs text-muted">
                    {pricing.isStale ? 'stale' : 'actueel'} · {pricing.inStock ? 'op voorraad' : 'uitverkocht'} ·{' '}
                    {pricing.referencePriceType ?? 'geen referentietype'}
                  </span>
                </div>
                <p className="mt-1 break-all text-xs text-muted">
                  {offer.affiliateUrl ? `affiliate: ${offer.affiliateUrl}` : `bestemming: ${offer.destinationUrl}`}
                </p>
                {offer.snapshots.length > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    Snapshots:{' '}
                    {offer.snapshots
                      .map(
                        (snapshot) =>
                          `${formatMoney(toCents(snapshot.price) ?? 0)} (${new Intl.DateTimeFormat('nl-NL', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                            timeZone: 'Europe/Amsterdam',
                          }).format(snapshot.capturedAt)})`,
                      )
                      .join(' · ')}
                  </p>
                ) : null}
              </li>
            )
          })}
          {product.offers.length === 0 ? <li className="text-sm text-muted">Geen aanbiedingen.</li> : null}
        </ul>
      </section>

      <section className="rounded-card border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Brondata</h2>
        <p className="mt-2 text-sm text-muted">{product.shortSourceDescription ?? 'Geen omschrijving.'}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-line pb-1">
            <dt className="text-muted">Extern ID</dt>
            <dd>{product.externalId ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-1">
            <dt className="text-muted">EAN</dt>
            <dd>{product.ean ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-1">
            <dt className="text-muted">Merk / model</dt>
            <dd>
              {product.brand ?? '—'} {product.model ?? ''}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-line pb-1">
            <dt className="text-muted">Scores (u/s/n/c)</dt>
            <dd>
              {product.uniquenessScore}/{product.storyScore}/{product.usefulnessScore}/
              {product.giftabilityScore}
            </dd>
          </div>
          {specifications.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-line pb-1">
              <dt className="text-muted">{label}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {product.editorial ? (
        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Redactionele tekst aanpassen</h2>
          <p className="mt-1 text-xs text-muted">
            Provider: {product.editorial.aiProvider} · prompt {product.editorial.promptVersion} ·{' '}
            {product.editorial.reviewedAt ? 'beoordeeld' : 'nog niet beoordeeld'} ·{' '}
            {product.editorial.humanReviewedAt
              ? `door een mens gecontroleerd op ${product.editorial.humanReviewedAt.toISOString().slice(0, 10)}`
              : 'nog niet door een mens gecontroleerd'}
            {product.editorial.humanEdited ? ' · handmatig aangepast' : ''}
          </p>
          <p className="mt-1 text-xs text-muted">
            Opening: {product.editorial.openingStyle ?? 'niet vastgelegd'}
            {product.editorial.styleVersion ? ` · stijlregels ${product.editorial.styleVersion}` : ''}
          </p>
          {styleWarnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-accent" role="list">
              {styleWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {!product.editorial.humanReviewedAt ? (
            <form action={approveContentAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="productId" value={product.id} />
              <label className="text-xs">
                <span className="font-medium text-ink">Notitie bij de goedkeuring</span>
                <input
                  name="reviewerNotes"
                  defaultValue={product.editorial.reviewerNotes ?? ''}
                  className="mt-1 h-11 w-80 rounded-tile border border-line px-3 text-sm"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
              >
                Tekst inhoudelijk goedkeuren
              </button>
              <span className="text-xs text-muted">
                Zonder deze stap blijft de pagina bereikbaar, maar niet indexeerbaar.
              </span>
            </form>
          ) : null}
          <form action={updateEditorialAction} className="mt-4 space-y-4">
            <input type="hidden" name="productId" value={product.id} />

            <div>
              <label htmlFor="headline" className="block text-sm font-medium">
                Headline (max ±75 tekens)
              </label>
              <input
                id="headline"
                name="headline"
                defaultValue={product.editorial.headline}
                className="mt-1 h-11 w-full rounded-tile border border-line px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="teaser" className="block text-sm font-medium">
                Teaser (45-70 woorden)
              </label>
              <textarea
                id="teaser"
                name="teaser"
                rows={4}
                defaultValue={product.editorial.teaser}
                className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="longDescription" className="block text-sm font-medium">
                Lange omschrijving (120-220 woorden)
              </label>
              <textarea
                id="longDescription"
                name="longDescription"
                rows={8}
                defaultValue={product.editorial.longDescription}
                className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="whyItStandsOut" className="block text-sm font-medium">
                  Waarom dit opvalt
                </label>
                <textarea
                  id="whyItStandsOut"
                  name="whyItStandsOut"
                  rows={3}
                  defaultValue={product.editorial.whyItStandsOut}
                  className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="caveat" className="block text-sm font-medium">
                  Goed om te weten (aandachtspunt)
                </label>
                <textarea
                  id="caveat"
                  name="caveat"
                  rows={3}
                  defaultValue={product.editorial.caveat}
                  className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bestFor" className="block text-sm font-medium">
                  Voor wie (één per regel)
                </label>
                <textarea
                  id="bestFor"
                  name="bestFor"
                  rows={3}
                  defaultValue={asStringArray(product.editorial.bestFor).join('\n')}
                  className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="tags" className="block text-sm font-medium">
                  Tags (één per regel)
                </label>
                <textarea
                  id="tags"
                  name="tags"
                  rows={3}
                  defaultValue={asStringArray(product.editorial.tags).join('\n')}
                  className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="seoTitle" className="block text-sm font-medium">
                  SEO-titel (max 60 tekens)
                </label>
                <input
                  id="seoTitle"
                  name="seoTitle"
                  defaultValue={product.editorial.seoTitle}
                  className="mt-1 h-11 w-full rounded-tile border border-line px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="metaDescription" className="block text-sm font-medium">
                  Meta description (max 155 tekens)
                </label>
                <input
                  id="metaDescription"
                  name="metaDescription"
                  defaultValue={product.editorial.metaDescription}
                  className="mt-1 h-11 w-full rounded-tile border border-line px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reviewerNotes" className="block text-sm font-medium">
                Notities van de reviewer
              </label>
              <textarea
                id="reviewerNotes"
                name="reviewerNotes"
                rows={2}
                defaultValue={product.editorial.reviewerNotes ?? ''}
                className="mt-1 w-full rounded-tile border border-line p-3 text-sm"
              />
              <p className="mt-1 text-xs text-muted">
                Voeg gerust een eigen redactionele zin toe, pas de opening aan of haal overdreven taal weg.
                Opslaan geldt als inhoudelijke controle.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
            >
              Opslaan en als beoordeeld markeren
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">Nog geen redactionele content</h2>
          <p className="mt-1 text-sm text-muted">
            Start de dagelijkse job of gebruik “Content opnieuw genereren” om tekst te maken.
          </p>
        </section>
      )}
    </div>
  )
}
