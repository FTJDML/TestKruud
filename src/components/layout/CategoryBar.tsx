'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { categories } from '@/lib/categories'
import { Container } from '@/components/ui/Container'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/client'

/**
 * Compacte categoriebalk. Op mobiel horizontaal scrollbaar met zichtbare
 * focusstates; elk item is een gewone link, dus bruikbaar met toetsenbord.
 */
export function CategoryBar() {
  const pathname = usePathname()
  return (
    <div className="border-b border-line bg-card/60">
      <Container>
        <ul className="scroll-row flex items-center gap-1 py-1.5" role="list">
          {categories.map((category) => {
            const href = `/categorie/${category.slug}`
            const isActive = pathname === href
            return (
              <li key={category.slug} className="shrink-0">
                <Link
                  href={href}
                  onClick={() => trackEvent({ type: 'category_click', categorySlug: category.slug })}
                  className={cn(
                    'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-[13px] font-medium transition-colors',
                    isActive ? 'bg-ink text-white' : 'text-muted hover:bg-canvas hover:text-ink',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {category.shortName}
                </Link>
              </li>
            )
          })}
          <li className="shrink-0">
            <Link
              href="/categorieen"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft"
            >
              Alle categorieën
            </Link>
          </li>
        </ul>
      </Container>
    </div>
  )
}
