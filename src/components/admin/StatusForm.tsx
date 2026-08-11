'use client'

import { useActionState } from 'react'
import { setEditorialStatusAction, type EditorialActionState } from '@/app/admin/editorial-actions'

/**
 * Status van een pagina. Publiceren kan alleen na een afgeronde review, en wordt
 * geweigerd bij sterke overlap met bestaande content.
 */
export function StatusForm({
  pageId,
  status,
  scheduledPublishAt,
  reviewed,
}: {
  pageId: string
  status: string
  scheduledPublishAt: string
  reviewed: boolean
}) {
  const [state, action, pending] = useActionState<EditorialActionState, FormData>(
    setEditorialStatusAction,
    null,
  )

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4">
      <input type="hidden" name="pageId" value={pageId} />
      <label className="text-sm">
        <span className="font-medium text-ink">Status</span>
        <select
          name="status"
          defaultValue={status}
          className="mt-1 min-h-11 rounded-tile border border-line bg-canvas px-3 text-sm"
        >
          <option value="DRAFT">concept</option>
          <option value="NEEDS_REVIEW">review nodig</option>
          <option value="SCHEDULED">ingepland</option>
          <option value="PUBLISHED">gepubliceerd</option>
          <option value="ARCHIVED">gearchiveerd</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="font-medium text-ink">Publicatiedatum</span>
        <input
          type="date"
          name="scheduledPublishAt"
          defaultValue={scheduledPublishAt}
          className="mt-1 min-h-11 rounded-tile border border-line bg-canvas px-3 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink disabled:opacity-60"
      >
        {pending ? 'Bezig…' : 'Status opslaan'}
      </button>
      {!reviewed ? (
        <p className="text-xs text-muted">Publiceren kan pas nadat de review is afgerond.</p>
      ) : null}
      {state ? (
        <p className={state.ok ? 'text-sm text-deal' : 'text-sm text-accent'}>{state.message}</p>
      ) : null}
    </form>
  )
}
