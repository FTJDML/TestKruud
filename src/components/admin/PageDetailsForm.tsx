'use client'

import type { ReactNode } from 'react'
import { useActionState } from 'react'
import { updateEditorialPageAction, type EditorialActionState } from '@/app/admin/editorial-actions'

export type PageDetails = {
  id: string
  title: string
  primaryQuery: string
  searchIntent: string
  seoTitle: string
  metaDescription: string
  introduction: string
  methodology: string
  selectionCriteria: string
  conclusion: string
  heroImage: string
  canonicalUrl: string
  reviewerNotes: string
  clusterId: string
  featuredProductId: string
  featuredReason: string
  featuredCaveat: string
  featuredAlternativeNote: string
  faqText: string
}

/**
 * Redactionele velden van een pagina. De archetype-specifieke velden komen als
 * `archetypeFields` binnen, zodat elke editor zijn eigen vragen kan stellen
 * zonder dit formulier te dupliceren.
 */
export function PageDetailsForm({
  page,
  clusters,
  selectedProducts,
  requiresMethodology,
  archetypeFields,
  featuredLabelField,
}: {
  page: PageDetails
  clusters: ReadonlyArray<{ id: string; title: string }>
  selectedProducts: ReadonlyArray<{ id: string; title: string }>
  requiresMethodology: boolean
  archetypeFields: ReactNode
  featuredLabelField: ReactNode
}) {
  const [state, action, pending] = useActionState<EditorialActionState, FormData>(
    updateEditorialPageAction,
    null,
  )

  return (
    <form action={action} className="space-y-5 rounded-card border border-line bg-card p-5">
      <input type="hidden" name="pageId" value={page.id} />

      {archetypeFields}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Titel (H1)</span>
          <input
            name="title"
            defaultValue={page.title}
            required
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">primaryQuery</span>
          <input
            name="primaryQuery"
            defaultValue={page.primaryQuery}
            required
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Gebruik deze vraag natuurlijk in de titel, de intro, één tussenkop en de meta description — niet
            als opsomming van zoekwoorden.
          </span>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Zoekintentie</span>
          <select
            name="searchIntent"
            defaultValue={page.searchIntent}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          >
            <option value="INFORMATIONAL">informatief</option>
            <option value="COMMERCIAL_INVESTIGATION">oriënterend</option>
            <option value="TRANSACTIONAL">kopen</option>
            <option value="INSPIRATIONAL">inspiratie</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Cluster</span>
          <select
            name="clusterId"
            defaultValue={page.clusterId}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          >
            <option value="">geen cluster</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.title}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Een cluster geeft de pagina een inkomende link; zonder cluster is een goedgekeurde interne link
            nodig.
          </span>
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Hero-afbeelding (pad of URL)</span>
          <input
            name="heroImage"
            defaultValue={page.heroImage}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">SEO-title</span>
          <input
            name="seoTitle"
            defaultValue={page.seoTitle}
            required
            maxLength={70}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-ink">Canonical (optioneel pad)</span>
          <input
            name="canonicalUrl"
            defaultValue={page.canonicalUrl}
            placeholder="/gids/andere-pagina"
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Meta description</span>
          <input
            name="metaDescription"
            defaultValue={page.metaDescription}
            required
            minLength={50}
            maxLength={170}
            className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Introductie</span>
          <textarea
            name="introduction"
            rows={6}
            defaultValue={page.introduction}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">
            Methodologie {requiresMethodology ? '(verplicht voor indexering)' : '(optioneel)'}
          </span>
          <textarea
            name="methodology"
            rows={4}
            defaultValue={page.methodology}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Selectiecriteria (in woorden)</span>
          <textarea
            name="selectionCriteria"
            rows={3}
            defaultValue={page.selectionCriteria}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Conclusie</span>
          <textarea
            name="conclusion"
            rows={3}
            defaultValue={page.conclusion}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Veelgestelde vragen — één per regel: vraag | antwoord</span>
          <textarea
            name="faqs"
            rows={4}
            defaultValue={page.faqText}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Alleen vragen die met de inhoud van deze pagina te beantwoorden zijn.
          </span>
        </label>
      </div>

      <fieldset className="space-y-3 rounded-tile border border-line bg-canvas p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Uitgelichte keuze</legend>
        <p className="text-xs text-muted">
          Een affiliateproduct mag uitgelicht worden, maar de reden moet naar de vergelijkingscriteria
          verwijzen. Een aandachtspunt is verplicht, en bij alternatieven ook een notitie wanneer een
          alternatief beter past. Commissie speelt geen rol in de score.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium text-ink">Product</span>
            <select
              name="featuredProductId"
              defaultValue={page.featuredProductId}
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-card px-3 text-sm"
            >
              <option value="">geen uitgelicht product</option>
              {selectedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
          </label>
          {featuredLabelField}
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-ink">Waarom deze keuze (verwijs naar criteria)</span>
            <textarea
              name="featuredReason"
              rows={2}
              defaultValue={page.featuredReason}
              className="mt-1 w-full rounded-tile border border-line bg-card p-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">Aandachtspunt (verplicht)</span>
            <input
              name="featuredCaveat"
              defaultValue={page.featuredCaveat}
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-card px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">Wanneer is een alternatief beter?</span>
            <input
              name="featuredAlternativeNote"
              defaultValue={page.featuredAlternativeNote}
              className="mt-1 min-h-11 w-full rounded-tile border border-line bg-card px-3 text-sm"
            />
          </label>
        </div>
      </fieldset>

      <label className="text-sm">
        <span className="font-medium text-ink">Notities van de reviewer</span>
        <textarea
          name="reviewerNotes"
          rows={2}
          defaultValue={page.reviewerNotes}
          className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
        />
      </label>

      {state ? (
        <p className={state.ok ? 'text-sm text-deal' : 'text-sm text-accent'}>{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-60"
      >
        {pending ? 'Opslaan…' : 'Opslaan'}
      </button>
    </form>
  )
}
