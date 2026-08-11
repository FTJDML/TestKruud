'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { bulkEditorialAction, type EditorialActionState } from '@/app/admin/editorial-actions'

export type BulkPageRow = {
  id: string
  title: string
  slug: string
  typeLabel: string
  status: string
  indexable: boolean
  clusterTitle: string | null
  productCount: number
  sourceCount: number
  criterionCount: number
  reviewed: boolean
  factChecked: boolean
  scheduledLabel: string | null
  reasons: string[]
}

/**
 * Bulkacties uit de batchworkflow: selecteren, drafts laten maken, fact-check
 * zetten, inplannen of archiveren. **Direct publiceren zit hier bewust niet
 * tussen**: dat blijft per pagina een bewuste keuze, na review.
 */
export function BulkPageForm({ pages }: { pages: readonly BulkPageRow[] }) {
  const [state, action, pending] = useActionState<EditorialActionState, FormData>(bulkEditorialAction, null)

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4">
        <label className="text-sm">
          <span className="font-medium text-ink">Bulkactie</span>
          <select
            name="bulkAction"
            defaultValue="draft"
            className="mt-1 min-h-11 rounded-tile border border-line bg-canvas px-3 text-sm"
          >
            <option value="draft">Concept laten schrijven (wordt NEEDS_REVIEW)</option>
            <option value="factCheck">Fact-check afvinken</option>
            <option value="schedule">Inplannen (alleen na review)</option>
            <option value="archive">Archiveren</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Publicatiedatum</span>
          <input
            type="date"
            name="scheduledPublishAt"
            className="mt-1 min-h-11 rounded-tile border border-line bg-canvas px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink disabled:opacity-60"
        >
          {pending ? 'Bezig…' : 'Uitvoeren op selectie'}
        </button>
        <p className="text-xs text-muted">Bulk publiceren bestaat niet: elke publicatie is een losse keuze.</p>
      </div>

      {state ? (
        <p className={state.ok ? 'text-sm text-deal' : 'text-sm text-accent'}>{state.message}</p>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">
                <span className="sr-only">Selecteren</span>
              </th>
              <th className="px-4 py-3">Pagina</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Index</th>
              <th className="px-4 py-3">Producten</th>
              <th className="px-4 py-3">Criteria</th>
              <th className="px-4 py-3">Bronnen</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Wat ontbreekt</th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-muted">
                  Nog geen redactionele pagina&apos;s.
                </td>
              </tr>
            ) : (
              pages.map((page) => (
                <tr key={page.id} className="border-b border-line/70 align-top last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="pageIds"
                      value={page.id}
                      aria-label={`Selecteer ${page.title}`}
                      className="size-4"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/redactie/${page.id}`} className="font-medium hover:text-accent">
                      {page.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {page.typeLabel}
                      {page.clusterTitle ? ` · ${page.clusterTitle}` : ''} · /gids/{page.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {page.status}
                    {page.scheduledLabel ? (
                      <span className="block text-xs text-muted">gepland {page.scheduledLabel}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {page.indexable ? (
                      <span className="text-deal">ja</span>
                    ) : (
                      <span className="text-muted">noindex</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{page.productCount}</td>
                  <td className="px-4 py-3 tabular-nums">{page.criterionCount}</td>
                  <td className="px-4 py-3 tabular-nums">{page.sourceCount}</td>
                  <td className="px-4 py-3 text-xs">
                    {page.reviewed ? 'review ✓' : 'review –'}
                    <br />
                    {page.factChecked ? 'fact-check ✓' : 'fact-check –'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {page.reasons.length > 0 ? page.reasons.slice(0, 2).join('; ') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </form>
  )
}
