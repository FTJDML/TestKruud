import type { ReactNode } from 'react'
import { SearchX } from 'lucide-react'

/** Duidelijke lege state met een suggestie om verder te kijken. */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-card border border-line bg-card px-6 py-14 text-center">
      <SearchX aria-hidden className="mx-auto size-8 text-muted" />
      <h2 className="mt-4 text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {children ? <div className="mt-6 flex justify-center">{children}</div> : null}
    </div>
  )
}
