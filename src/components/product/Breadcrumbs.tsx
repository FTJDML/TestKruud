import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type Crumb = { name: string; path: string }

/** Zichtbare breadcrumbs; identiek aan de BreadcrumbList in de structured data. */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Kruimelpad" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1" role="list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.path} className="flex items-center gap-1">
              {isLast ? (
                <span aria-current="page" className="font-medium text-ink">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.path} className="hover:text-accent">
                    {item.name}
                  </Link>
                  <ChevronRight aria-hidden className="size-3" />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
