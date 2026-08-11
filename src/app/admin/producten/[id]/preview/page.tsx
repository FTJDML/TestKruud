import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { computeDealPricing } from '@/lib/pricing/deal'
import { checkPublicVisibility } from '@/lib/products/visibility'
import { ProductImage } from '@/components/product/ProductImage'
import { PriceBlock } from '@/components/product/PriceBlock'

export const dynamic = 'force-dynamic'

/**
 * Beveiligde preview van een concept. Hier mogen `CANDIDATE`, `DRAFT` en
 * `NEEDS_REVIEW` wél bekeken worden: dat is precies waarvoor een redactie een
 * preview nodig heeft. Publiek geven diezelfde producten een echte 404.
 *
 * Deze route staat onder /admin en is daarmee altijd `noindex` (zie de
 * adminlayout en de proxy).
 */
export default async function AdminProductPreview({ params }: { params: Promise<{ id: string }> }) {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      editorial: true,
      analysis: true,
      offers: {
        orderBy: { currentPrice: 'asc' },
        include: { merchant: { select: { name: true, enabled: true } } },
      },
    },
  })
  if (!product) notFound()

  const now = new Date()
  const usable = product.offers.filter((offer) => offer.merchant.enabled)
  const best = usable[0]
  const pricing = best ? computeDealPricing(best, now) : null
  const verdict = checkPublicVisibility({
    status: product.status,
    imageStatus: product.imageStatus,
    isDemo: product.isDemo,
    hasEditorial: product.editorial !== null,
  })

  const bestFor = Array.isArray(product.editorial?.bestFor)
    ? (product.editorial?.bestFor as unknown[]).filter((entry): entry is string => typeof entry === 'string')
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Preview</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold">
            {product.editorial?.headline ?? product.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {product.title} · status {product.status} · afbeelding {product.imageStatus}
          </p>
        </div>
        <Link
          href={`/admin/producten/${product.id}`}
          className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
        >
          Terug naar beheer
        </Link>
      </div>

      <p
        className={
          verdict.visible
            ? 'rounded-tile border border-line bg-deal-soft px-4 py-3 text-sm text-deal'
            : 'rounded-tile border border-line bg-accent-soft px-4 py-3 text-sm text-ink'
        }
      >
        {verdict.visible
          ? 'Dit product is publiek zichtbaar op de website.'
          : `Nog niet publiek: ${verdict.reason}. Publiek geeft deze pagina een 404.`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-card border border-line bg-card p-4">
          <ProductImage src={product.imageUrl} alt={product.imageAlt} sizes="(min-width: 1024px) 480px, 92vw" />
          {product.imageFailureReason ? (
            <p className="mt-3 text-xs text-muted">Laatste afbeeldingsprobleem: {product.imageFailureReason}</p>
          ) : null}
        </div>

        <div className="space-y-4">
          {pricing ? (
            <div className="rounded-card border border-line bg-card p-4">
              <PriceBlock pricing={pricing} merchantName={best?.merchant.name ?? 'onbekend'} size="detail" />
            </div>
          ) : (
            <p className="text-sm text-muted">Nog geen actieve aanbieding.</p>
          )}

          <div className="space-y-3 text-sm leading-relaxed">
            <p className="font-medium text-ink">{product.editorial?.teaser ?? 'Nog geen teaser.'}</p>
            <p className="whitespace-pre-line text-muted">
              {product.editorial?.longDescription ?? 'Nog geen beschrijving.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-card border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Waarom dit opvalt</h2>
          <p className="mt-2 text-sm text-muted">{product.editorial?.whyItStandsOut ?? '—'}</p>
        </section>
        <section className="rounded-card border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Voor wie</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted" role="list">
            {bestFor.length > 0 ? bestFor.map((entry) => <li key={entry}>{entry}</li>) : <li>—</li>}
          </ul>
        </section>
        <section className="rounded-card border border-line bg-card p-4">
          <h2 className="text-sm font-semibold">Goed om te weten</h2>
          <p className="mt-2 text-sm text-muted">{product.editorial?.caveat ?? '—'}</p>
        </section>
      </div>

      <section className="rounded-card border border-line bg-canvas p-4 text-sm text-muted">
        <h2 className="text-sm font-semibold text-ink">Herkomst van deze tekst</h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-ink">Provider</dt>
            <dd>
              {product.editorial?.generationProvider ?? product.editorial?.aiProvider ?? '—'}
              {product.editorial?.generationModel ? ` (${product.editorial.generationModel})` : ''}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Beoordeeld</dt>
            <dd>
              {product.editorial?.reviewedAt
                ? product.editorial.reviewedAt.toISOString().slice(0, 16).replace('T', ' ')
                : 'nog niet beoordeeld'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Ervaring</dt>
            <dd>{product.experienceType}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Analyseversie</dt>
            <dd>{product.editorial?.analysisVersion ?? '—'}</dd>
          </div>
        </dl>
        {product.editorial?.evidenceSummary ? (
          <p className="mt-3">Gebaseerd op: {product.editorial.evidenceSummary}</p>
        ) : null}
      </section>
    </div>
  )
}
