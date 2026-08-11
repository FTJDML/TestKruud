'use client'

import { useSaves } from '@/components/product/SavesProvider'

/** Klein aantal naast het harticoon in de header; alleen eigen bewaarde items. */
export function SavedCountBadge() {
  const { savedIds, ready } = useSaves()
  if (!ready || savedIds.size === 0) return null
  return (
    <span
      className="absolute -right-2 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold leading-4 text-white"
      aria-hidden
    >
      {savedIds.size}
    </span>
  )
}
