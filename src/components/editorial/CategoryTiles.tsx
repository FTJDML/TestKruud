import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { primaryCategories } from '@/lib/categories'

/**
 * Eenvoudige rij categoriekaarten: maximaal acht primaire categorieën plus
 * "Alle categorieën". Geen muur met tientallen ronde iconen.
 */
export function CategoryTiles() {
  return (
    <nav aria-label="Categorieoverzicht">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="list">
        {primaryCategories().map((category) => (
          <li key={category.slug}>
            <Link
              href={`/categorie/${category.slug}`}
              className="flex h-full min-h-20 flex-col justify-between rounded-tile border border-line bg-card px-4 py-3 transition-colors hover:border-ink/20 hover:bg-accent-soft"
            >
              <span className="text-sm font-semibold text-ink">{category.name}</span>
              <span className="mt-2 text-xs text-muted">Bekijk vondsten</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/categorieen"
            className="flex h-full min-h-20 flex-col justify-between rounded-tile border border-ink bg-ink px-4 py-3 text-white transition-colors hover:bg-accent"
          >
            <span className="text-sm font-semibold">Alle categorieën</span>
            <ArrowRight aria-hidden className="mt-2 size-4" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
