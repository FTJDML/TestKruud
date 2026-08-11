import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ProductImage } from '@/components/product/ProductImage'
import type { EditorialPageCardView } from '@/types'

/**
 * Kaarten voor redactionele pagina's. De kaart noemt het archetype en het aantal
 * vergeleken producten, zodat een bezoeker weet wat hij krijgt voordat hij klikt.
 */
export function EditorialPageCards({
  pages,
  columns = 3,
}: {
  pages: readonly EditorialPageCardView[]
  columns?: 2 | 3
}) {
  if (pages.length === 0) return null
  return (
    <ul
      className={
        columns === 2
          ? 'grid grid-cols-1 gap-5 sm:grid-cols-2'
          : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'
      }
      role="list"
    >
      {pages.map((page) => (
        <li key={page.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-card">
          {page.heroImage ? (
            <ProductImage src={page.heroImage} alt={page.title} sizes="(min-width: 640px) 33vw, 92vw" />
          ) : null}
          <div className="flex flex-1 flex-col gap-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {page.typeLabel}
              {page.budgetLabel ? ` · ${page.budgetLabel}` : ''}
            </p>
            <h3 className="font-display text-lg font-extrabold leading-snug">
              <Link href={`/gids/${page.slug}`} className="hover:text-accent">
                {page.title}
              </Link>
            </h3>
            <p className="line-clamp-3 text-sm text-muted">{page.introduction}</p>
            <p className="mt-auto pt-2 text-xs text-muted">{page.productCount} producten vergeleken</p>
            <Link
              href={`/gids/${page.slug}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink hover:text-accent"
            >
              Bekijk de gids
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
