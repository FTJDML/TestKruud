import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  title: string
  description?: string
  href?: string
  linkLabel?: string
  as?: 'h2' | 'h3'
  children?: ReactNode
}

/** Kop boven een sectie, met optionele link naar een overzichtspagina. */
export function SectionHeader({ title, description, href, linkLabel, as = 'h2', children }: Props) {
  const Heading = as
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <Heading className="text-2xl font-semibold text-ink sm:text-3xl">{title}</Heading>
        {description ? <p className="mt-2 text-sm text-muted sm:text-base">{description}</p> : null}
        {children}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          {linkLabel ?? 'Bekijk alles'}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </div>
  )
}
