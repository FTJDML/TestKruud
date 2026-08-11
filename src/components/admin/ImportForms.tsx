'use client'

import { useActionState } from 'react'
import {
  importBriefsAction,
  importProductsAction,
  type EditorialActionState,
} from '@/app/admin/editorial-actions'

/**
 * Twee importformulieren met hun sjabloon erbij. Het sjabloon staat in een
 * `textarea` zodat het te kopiëren is zonder download.
 */
export function ImportForms({
  briefTemplate,
  productTemplate,
  briefColumns,
  productColumns,
}: {
  briefTemplate: string
  productTemplate: string
  briefColumns: string[]
  productColumns: string[]
}) {
  const [briefState, briefAction, briefPending] = useActionState<EditorialActionState, FormData>(
    importBriefsAction,
    null,
  )
  const [productState, productAction, productPending] = useActionState<EditorialActionState, FormData>(
    importProductsAction,
    null,
  )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={briefAction} className="space-y-3 rounded-card border border-line bg-card p-5">
        <h2 className="font-display text-lg font-extrabold">Editorial briefs</h2>
        <p className="text-sm text-muted">Kolommen: {briefColumns.join(', ')}</p>
        <label className="text-sm">
          <span className="font-medium text-ink">Sjabloon (kopieer en vul aan)</span>
          <textarea
            readOnly
            rows={4}
            value={briefTemplate}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 font-mono text-xs"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">CSV met briefs</span>
          <textarea
            name="csv"
            rows={8}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 font-mono text-xs"
            placeholder="pageType,workingTitle,primaryQuery,..."
          />
        </label>
        {briefState ? (
          <p className={briefState.ok ? 'text-sm text-deal' : 'text-sm text-accent'}>{briefState.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={briefPending}
          className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-60"
        >
          {briefPending ? 'Importeren…' : 'Briefs importeren als concept'}
        </button>
      </form>

      <form action={productAction} className="space-y-3 rounded-card border border-line bg-card p-5">
        <h2 className="font-display text-lg font-extrabold">Producten</h2>
        <p className="text-sm text-muted">Kolommen: {productColumns.join(', ')}</p>
        <label className="text-sm">
          <span className="font-medium text-ink">Sjabloon (kopieer en vul aan)</span>
          <textarea
            readOnly
            rows={4}
            value={productTemplate}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 font-mono text-xs"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">CSV met producten</span>
          <textarea
            name="csv"
            rows={8}
            className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 font-mono text-xs"
            placeholder="merchantSlug,externalId,title,..."
          />
        </label>
        {productState ? (
          <p className={productState.ok ? 'text-sm text-deal' : 'text-sm text-accent'}>
            {productState.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={productPending}
          className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-60"
        >
          {productPending ? 'Importeren…' : 'Producten importeren als kandidaat'}
        </button>
      </form>
    </div>
  )
}
