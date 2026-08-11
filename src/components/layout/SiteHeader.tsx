import Link from 'next/link'
import { Heart, LayoutGrid } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { Logo } from '@/components/layout/Logo'
import { SearchForm } from '@/components/layout/SearchForm'
import { MobileNav } from '@/components/layout/MobileNav'
import { CategoryBar } from '@/components/layout/CategoryBar'
import { SavedCountBadge } from '@/components/product/SavedCountBadge'

/** Smalle informatiebalk; bewust statisch, geen bewegende ticker. */
function TopBar() {
  return (
    <div className="border-b border-line bg-card">
      <Container>
        <p className="py-2 text-center text-[11px] font-medium tracking-wide text-muted sm:text-xs">
          Elke dag nieuwe vondsten · Prijzen dagelijks gecontroleerd
        </p>
      </Container>
    </div>
  )
}

/** Compacte, sticky header: logo, zoekbalk, categorieën en bewaarde producten. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <TopBar />
      <div className="border-b border-line bg-card">
        <Container>
          <div className="flex h-16 items-center gap-3 sm:gap-6">
            <MobileNav />
            <Logo className="shrink-0" />
            <div className="hidden flex-1 md:block">
              <SearchForm />
            </div>
            <nav aria-label="Hoofdnavigatie" className="ml-auto flex items-center gap-1 sm:gap-2">
              <Link
                href="/categorieen"
                className="hidden min-h-11 items-center gap-2 rounded-pill px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas sm:inline-flex"
              >
                <LayoutGrid aria-hidden className="size-4" />
                Categorieën
              </Link>
              <Link
                href="/nieuw"
                className="hidden min-h-11 items-center rounded-pill px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas lg:inline-flex"
              >
                Nieuw
              </Link>
              <Link
                href="/bewaard"
                className="inline-flex min-h-11 items-center gap-2 rounded-pill px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas"
              >
                <span className="relative inline-flex">
                  <Heart aria-hidden className="size-5" />
                  <SavedCountBadge />
                </span>
                <span className="hidden sm:inline">Bewaard</span>
              </Link>
            </nav>
          </div>
          <div className="pb-3 md:hidden">
            <SearchForm id="zoekveld-mobiel" />
          </div>
        </Container>
      </div>
      <CategoryBar />
    </header>
  )
}
