import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { archetypeFor, searchIntentLabels } from '@/lib/editorial/archetypes'
import { evaluatePage } from '@/lib/editorial/service'
import { publicProductFilter } from '@/lib/products/visibility'
import { formatMoney } from '@/lib/pricing/money'
import { ArchetypeEditor, FeaturedLabelSelect } from '@/components/admin/editors'
import { PageDetailsForm } from '@/components/admin/PageDetailsForm'
import { DraftButton } from '@/components/admin/DraftButton'
import { StatusForm } from '@/components/admin/StatusForm'
import {
  addPageCriterionAction,
  addPageProductAction,
  addSourceAction,
  markFactCheckedAction,
  markReviewedAction,
  removePageCriterionAction,
  removePageProductAction,
  removeSourceAction,
  setCriterionValueAction,
  updatePageProductAction,
} from '@/app/admin/editorial-actions'

export const dynamic = 'force-dynamic'

/**
 * Editor voor één redactionele pagina.
 *
 * De archetype-specifieke velden komen uit `ArchetypeEditor`; de gedeelde
 * onderdelen (producten, criteria, criteriumwaarden, bronnen, status) staan
 * hieronder. `indexable` is nergens een invoerveld: dat is altijd de uitkomst
 * van de quality gate, en de redenen staan bovenaan.
 */
export default async function AdminEditorialPageEditor({ params }: { params: Promise<{ id: string }> }) {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const { id } = await params
  const [page, clusters, criteriaLibrary, sources] = await Promise.all([
    prisma.editorialPage.findUnique({
      where: { id },
      include: {
        cluster: { select: { id: true, title: true } },
        criteria: { include: { criterion: true }, orderBy: { displayOrder: 'asc' } },
        criterionValues: true,
        sources: { include: { source: true } },
        products: { include: { product: true }, orderBy: { position: 'asc' } },
      },
    }),
    prisma.contentCluster.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, title: true } }),
    prisma.comparisonCriterion.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.evidenceSource.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ])
  if (!page) notFound()

  const evaluation = await evaluatePage(prisma, page.id)
  const archetype = archetypeFor(page.type)
  const selected = page.products.filter((entry) => entry.role === 'SELECTED')
  const alternatives = page.products.filter((entry) => entry.role === 'ALTERNATIVE')

  // Kandidaten om toe te voegen: alleen publiek zichtbare producten.
  const candidates = await prisma.product.findMany({
    where: publicProductFilter({ id: { notIn: page.products.map((entry) => entry.productId) } }),
    select: { id: true, title: true, primaryCategory: true },
    orderBy: { title: 'asc' },
    take: 200,
  })

  const faqText = Array.isArray(page.frequentlyAskedQuestions)
    ? (page.frequentlyAskedQuestions as unknown[])
        .filter(
          (entry): entry is { question: string; answer: string } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { question?: unknown }).question === 'string' &&
            typeof (entry as { answer?: unknown }).answer === 'string',
        )
        .map((faq) => `${faq.question} | ${faq.answer}`)
        .join('\n')
    : ''

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">{archetype.label}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold">{page.title}</h1>
          <p className="mt-1 text-sm text-muted">
            /gids/{page.slug} · status {page.status} · {searchIntentLabels[page.searchIntent]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/gids/${page.slug}`}
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Bekijk op de site
          </Link>
          <form action={markReviewedAction}>
            <input type="hidden" name="pageId" value={page.id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
            >
              {page.reviewedAt ? 'Review opnieuw afronden' : 'Review afronden'}
            </button>
          </form>
          <form action={markFactCheckedAction}>
            <input type="hidden" name="pageId" value={page.id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
            >
              Fact-check afvinken
            </button>
          </form>
          <DraftButton pageId={page.id} />
        </div>
      </div>

      <section
        className={
          evaluation?.verdict.indexable
            ? 'rounded-card border border-line bg-deal-soft p-4 text-sm text-deal'
            : 'rounded-card border border-line bg-accent-soft p-4 text-sm text-ink'
        }
      >
        <p className="font-semibold">
          {evaluation?.verdict.indexable
            ? 'Deze pagina is indexeerbaar.'
            : 'Nog niet indexeerbaar (de pagina is wél browsebaar, met noindex, follow).'}
        </p>
        {evaluation && !evaluation.verdict.indexable ? (
          <ul className="mt-2 list-inside list-disc space-y-1" role="list">
            {evaluation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        {evaluation && evaluation.overlap.level !== 'ok' ? (
          <p className="mt-2">
            Overlap: {evaluation.overlap.reasons.join('; ')} — voorstel: {evaluation.overlap.recommendation}.
          </p>
        ) : null}
      </section>

      <StatusForm
        pageId={page.id}
        status={page.status}
        scheduledPublishAt={page.scheduledPublishAt?.toISOString().slice(0, 10) ?? ''}
        reviewed={page.reviewedAt !== null}
      />

      <PageDetailsForm
        page={{
          id: page.id,
          title: page.title,
          primaryQuery: page.primaryQuery,
          searchIntent: page.searchIntent,
          seoTitle: page.seoTitle,
          metaDescription: page.metaDescription,
          introduction: page.introduction,
          methodology: page.methodology ?? '',
          selectionCriteria: page.selectionCriteria ?? '',
          conclusion: page.conclusion ?? '',
          heroImage: page.heroImage ?? '',
          canonicalUrl: page.canonicalUrl ?? '',
          reviewerNotes: page.reviewerNotes ?? '',
          clusterId: page.cluster?.id ?? '',
          featuredProductId: page.featuredProductId ?? '',
          featuredReason: page.featuredReason ?? '',
          featuredCaveat: page.featuredCaveat ?? '',
          featuredAlternativeNote: page.featuredAlternativeNote ?? '',
          faqText,
        }}
        clusters={clusters}
        selectedProducts={selected.map((entry) => ({
          id: entry.productId,
          title: entry.product.title,
        }))}
        requiresMethodology={archetype.requiresMethodology}
        archetypeFields={
          <ArchetypeEditor
            type={page.type}
            page={{
              audience: page.audience,
              useCase: page.useCase,
              budgetMinCents: page.budgetMinCents,
              budgetMaxCents: page.budgetMaxCents,
              featuredLabel: page.featuredLabel,
            }}
          />
        }
        featuredLabelField={<FeaturedLabelSelect type={page.type} current={page.featuredLabel} />}
      />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-extrabold">
          Producten ({selected.length} geselecteerd, {alternatives.length} alternatief)
        </h2>
        <p className="text-sm text-muted">
          Minimaal {archetype.minProducts} geselecteerde producten. Alleen publiek zichtbare producten zijn te
          kiezen: een concept of een product met een afgekeurde afbeelding hoort niet in een gids.
        </p>

        <form action={addPageProductAction} className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4">
          <input type="hidden" name="pageId" value={page.id} />
          <label className="text-sm">
            <span className="font-medium text-ink">Product toevoegen</span>
            <select
              name="productId"
              className="mt-1 min-h-11 w-full max-w-md rounded-tile border border-line bg-canvas px-3 text-sm"
            >
              {candidates.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} ({product.primaryCategory})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">Rol</span>
            <select
              name="role"
              className="mt-1 min-h-11 rounded-tile border border-line bg-canvas px-3 text-sm"
            >
              <option value="SELECTED">selectie</option>
              <option value="ALTERNATIVE">alternatief</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Toevoegen
          </button>
        </form>

        {page.products.map((entry) => (
          <form
            key={entry.productId}
            action={updatePageProductAction}
            className="space-y-3 rounded-card border border-line bg-card p-4"
          >
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="productId" value={entry.productId} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-ink">
                {entry.product.title}
                <span className="ml-2 text-xs text-muted">
                  {entry.role === 'ALTERNATIVE' ? 'alternatief' : 'selectie'}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
                >
                  Opslaan
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium text-ink">Positie</span>
                <input
                  name="position"
                  type="number"
                  defaultValue={entry.position}
                  className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-ink">Label</span>
                <input
                  name="label"
                  defaultValue={entry.label ?? ''}
                  placeholder="Beste voor kleine keukens"
                  className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-ink">Beste voor (doelgroep of use case)</span>
                <input
                  name="bestForAudience"
                  defaultValue={entry.bestForAudience ?? ''}
                  className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-ink">
                  Aandachtspunt {archetype.requiresPerProductCaveat ? '(verplicht)' : ''}
                </span>
                <input
                  name="caveat"
                  defaultValue={entry.caveat ?? ''}
                  className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-medium text-ink">Waarom dit product hier past</span>
                <textarea
                  name="recommendation"
                  rows={2}
                  defaultValue={entry.recommendation ?? ''}
                  className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="exceedsBudget"
                  defaultChecked={entry.exceedsBudget}
                  className="size-4"
                />
                <span>Ligt boven het budget</span>
              </label>
              <label className="text-sm">
                <span className="font-medium text-ink">Uitleg bij boven budget</span>
                <input
                  name="budgetNote"
                  defaultValue={entry.budgetNote ?? ''}
                  className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
                />
              </label>
            </div>

            {page.criteria.length > 0 ? (
              <div className="rounded-tile border border-line bg-canvas p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Criteriumwaarden</p>
                <div className="mt-2 space-y-2">
                  {page.criteria.map((criterion) => {
                    const value = page.criterionValues.find(
                      (item) =>
                        item.productId === entry.productId && item.criterionName === criterion.criterionName,
                    )
                    return (
                      <div key={criterion.criterionName} className="flex flex-wrap items-end gap-2 text-sm">
                        <span className="w-40 shrink-0 text-muted">
                          {criterion.criterion.label}
                          {criterion.criterion.unit ? ` (${criterion.criterion.unit})` : ''}
                        </span>
                        <input
                          form={`value-${entry.productId}-${criterion.criterionName}`}
                          name="value"
                          defaultValue={value?.value ?? ''}
                          placeholder="leeg = niet opgegeven"
                          className="min-h-11 w-40 rounded-tile border border-line bg-card px-3 text-sm"
                        />
                        <select
                          form={`value-${entry.productId}-${criterion.criterionName}`}
                          name="sourceId"
                          defaultValue={value?.sourceId ?? ''}
                          className="min-h-11 rounded-tile border border-line bg-card px-2 text-xs"
                        >
                          <option value="">geen bron</option>
                          {page.sources.map((entrySource) => (
                            <option key={entrySource.sourceId} value={entrySource.sourceId}>
                              {entrySource.source.title}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            form={`value-${entry.productId}-${criterion.criterionName}`}
                            type="checkbox"
                            name="verified"
                            defaultChecked={value?.verificationStatus === 'VERIFIED'}
                            className="size-4"
                          />
                          gecontroleerd
                        </label>
                        <button
                          form={`value-${entry.productId}-${criterion.criterionName}`}
                          type="submit"
                          className="inline-flex min-h-11 items-center rounded-pill border border-line px-3 text-xs font-semibold hover:border-ink"
                        >
                          Waarde opslaan
                        </button>
                        <span className="text-xs text-muted">
                          {value?.verificationStatus === 'VERIFIED'
                            ? 'gecontroleerd'
                            : value?.verificationStatus === 'NOT_PROVIDED'
                              ? 'niet opgegeven'
                              : 'nog niet gecontroleerd'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </form>
        ))}

        {/* Losse formulieren voor de criteriumwaarden; zo blijft elke waarde een eigen actie. */}
        {page.products.flatMap((entry) =>
          page.criteria.map((criterion) => (
            <form
              key={`form-${entry.productId}-${criterion.criterionName}`}
              id={`value-${entry.productId}-${criterion.criterionName}`}
              action={setCriterionValueAction}
              className="hidden"
            >
              <input type="hidden" name="pageId" value={page.id} />
              <input type="hidden" name="productId" value={entry.productId} />
              <input type="hidden" name="criterionName" value={criterion.criterionName} />
            </form>
          )),
        )}

        <div className="flex flex-wrap gap-2">
          {page.products.map((entry) => (
            <form key={`remove-${entry.productId}`} action={removePageProductAction}>
              <input type="hidden" name="pageId" value={page.id} />
              <input type="hidden" name="productId" value={entry.productId} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-3 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
              >
                {entry.product.title} verwijderen
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold">
          Vergelijkingscriteria ({page.criteria.length})
        </h2>
        <p className="text-sm text-muted">
          {archetype.minCriteria > 0
            ? `Dit archetype vraagt minimaal ${archetype.minCriteria} criteria.`
            : 'Dit archetype vraagt geen criteria.'}{' '}
          Criteria komen uit de bibliotheek; een nieuw criterium voeg je toe met de seed of via de database,
          zodat de uitleg en de eenheid overal gelijk zijn.
        </p>
        <form action={addPageCriterionAction} className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4">
          <input type="hidden" name="pageId" value={page.id} />
          <label className="text-sm">
            <span className="font-medium text-ink">Criterium toevoegen</span>
            <select
              name="criterionName"
              className="mt-1 min-h-11 w-full max-w-md rounded-tile border border-line bg-canvas px-3 text-sm"
            >
              {criteriaLibrary
                .filter((criterion) => !page.criteria.some((entry) => entry.criterionName === criterion.name))
                .map((criterion) => (
                  <option key={criterion.name} value={criterion.name}>
                    {criterion.label} — {criterion.explanation.slice(0, 60)}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Toevoegen
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {page.criteria.map((entry) => (
            <form key={entry.criterionName} action={removePageCriterionAction}>
              <input type="hidden" name="pageId" value={page.id} />
              <input type="hidden" name="criterionName" value={entry.criterionName} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-3 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
              >
                {entry.criterion.label} verwijderen
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold">Bronnen ({page.sources.length})</h2>
        <p className="text-sm text-muted">
          Zonder bron is een pagina niet indexeerbaar. Gebruik &quot;eigen test&quot; alleen wanneer er echt een
          test is uitgevoerd: die bron zet de claim &quot;zelf getest&quot; op de pagina.
        </p>
        <form action={addSourceAction} className="grid gap-3 rounded-card border border-line bg-card p-4 sm:grid-cols-2">
          <input type="hidden" name="pageId" value={page.id} />
          <label className="text-sm">
            <span className="font-medium text-ink">Type</span>
            <select
              name="sourceType"
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            >
              <option value="MANUFACTURER_DOCUMENTATION">documentatie van de fabrikant</option>
              <option value="MERCHANT_FEED">feed van de aanbieder</option>
              <option value="AFFILIATE_API">API van het affiliatenetwerk</option>
              <option value="MANUAL_PRICE_CHECK">handmatige prijscontrole</option>
              <option value="OWN_PRICE_HISTORY">onze eigen prijshistorie</option>
              <option value="OWN_HANDS_ON_TEST">eigen test door de redactie</option>
              <option value="LICENSED_SOURCE">gelicentieerde bron</option>
              <option value="OTHER_VERIFIED_SOURCE">andere gecontroleerde bron</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">Titel</span>
            <input
              name="title"
              required
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">Uitgever</span>
            <input
              name="publisher"
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">URL</span>
            <input
              name="url"
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">Soorten feiten (komma-gescheiden)</span>
            <input
              name="factTypes"
              placeholder="afmetingen, gewicht, prijs"
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" name="usageAllowed" defaultChecked className="size-4" />
            <span>Mogen wij deze bron gebruiken?</span>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink sm:col-span-2"
          >
            Bron toevoegen
          </button>
        </form>

        <ul className="space-y-2 text-sm" role="list">
          {page.sources.map((entry) => (
            <li key={entry.sourceId} className="flex flex-wrap items-center gap-3 rounded-tile border border-line bg-card px-3 py-2">
              <span className="font-medium text-ink">{entry.source.title}</span>
              <span className="text-xs text-muted">
                {entry.source.sourceType}
                {entry.source.usageAllowed ? '' : ' · gebruik niet toegestaan'}
              </span>
              <form action={removeSourceAction} className="ml-auto">
                <input type="hidden" name="pageId" value={page.id} />
                <input type="hidden" name="sourceId" value={entry.sourceId} />
                <button type="submit" className="text-xs font-semibold text-muted hover:text-accent">
                  Verwijderen
                </button>
              </form>
            </li>
          ))}
        </ul>

        {sources.length > 0 ? (
          <p className="text-xs text-muted">
            {sources.length} bron(nen) in de bibliotheek. Dezelfde bron kan bij meerdere pagina&apos;s horen.
          </p>
        ) : null}
      </section>

      {page.budgetMaxCents !== null ? (
        <p className="text-sm text-muted">
          Budgetgrens: {formatMoney(page.budgetMaxCents)}. Producten daarboven moeten gemarkeerd zijn met een
          uitleg, anders blijft de pagina noindex.
        </p>
      ) : null}
    </div>
  )
}
