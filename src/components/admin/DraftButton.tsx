'use client'

import { useActionState } from 'react'
import { generateDraftAction, type EditorialActionState } from '@/app/admin/editorial-actions'

/**
 * Vraagt een concept aan. Het resultaat is altijd een draft: de pagina komt op
 * NEEDS_REVIEW en de review wordt teruggezet, ook wanneer die al was afgerond.
 */
export function DraftButton({ pageId }: { pageId: string }) {
  const [state, action, pending] = useActionState<EditorialActionState, FormData>(generateDraftAction, null)
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="pageId" value={pageId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink disabled:opacity-60"
      >
        {pending ? 'Schrijven…' : 'Concept laten schrijven'}
      </button>
      {state ? (
        <span className={state.ok ? 'text-xs text-deal' : 'text-xs text-accent'}>{state.message}</span>
      ) : null}
    </form>
  )
}
