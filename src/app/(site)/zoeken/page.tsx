import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SearchForm } from '@/components/layout/SearchForm'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { searchProducts } from '@/lib/database/queries'
import { buildMetadata } from '@/lib/seo/metadata'

/** Zoekresultaten zijn nooit indexeerbaar. */
export const metadata: Metadata = buildMetadata({
  title: 'Zoeken',
  description: 'Zoek in alle vondsten op HomeAndLivingDeals.nl.',
  path: '/zoeken',
  noindex: true,
})

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const results = query.length >= 2 ? await searchProducts(query) : []

  return (
    <Container className="pt-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold">Zoeken</h1>
        <p className="mt-2 text-sm text-muted">
          Zoek op titel, merk, model, categorie of onze eigen kop. Twee tekens zijn genoeg om te beginnen.
        </p>
        <div className="mt-5">
          <SearchForm defaultValue={query} autoFocus />
        </div>
      </header>

      <div className="pt-8">
        {query.length < 2 ? (
          <EmptyState
            title="Waar ben je naar op zoek?"
            description="Typ bijvoorbeeld “projector”, “pizzaoven” of “cadeau” en druk op zoeken."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title={`Geen resultaten voor “${query}”`}
            description="Probeer een kortere zoekterm of bekijk de categorieën. Wij publiceren alleen producten met een bruikbare afbeelding en een betrouwbare prijs."
          >
            <Link
              href="/categorieen"
              className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
            >
              Bekijk alle categorieën
            </Link>
          </EmptyState>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              {results.length} {results.length === 1 ? 'resultaat' : 'resultaten'} voor “{query}”
            </p>
            <ProductGrid products={results} surface="search" priorityCount={2} />
          </>
        )}
      </div>
    </Container>
  )
}
