'use client'

import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/client'

type Props = {
  defaultValue?: string
  className?: string
  id?: string
  autoFocus?: boolean
}

/**
 * Zoekformulier. De query komt in de URL terecht (/zoeken?q=...), zodat
 * resultaten server-side worden gerenderd en deelbaar zijn.
 */
export function SearchForm({ defaultValue = '', className, id = 'zoekveld', autoFocus }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = value.trim()
    if (query.length === 0) return
    trackEvent({ type: 'search', query })
    router.push(`/zoeken?q=${encodeURIComponent(query)}`)
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn('relative w-full', className)}>
      <label htmlFor={id} className="sr-only">
        Zoek naar producten, merken of categorieën
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        id={id}
        name="q"
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Zoek een vondst, merk of categorie"
        className="h-11 w-full rounded-pill border border-line bg-card pl-11 pr-24 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center rounded-pill bg-ink px-4 text-xs font-semibold text-white transition-colors hover:bg-accent"
      >
        Zoeken
      </button>
    </form>
  )
}
