import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { getSavedProducts } from '@/lib/database/queries'
import { readVisitorId } from '@/lib/saves/visitor'
import { buildMetadata } from '@/lib/seo/metadata'

/** Bewaarde producten zijn persoonlijk en nooit indexeerbaar. */
export const metadata: Metadata = buildMetadata({
  title: 'Bewaard',
  description: 'De producten die je hebt bewaard.',
  path: '/bewaard',
  noindex: true,
})

export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const visitorId = await readVisitorId()
  const products = visitorId ? await getSavedProducts(visitorId) : []

  return (
    <Container className="pt-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Bewaard</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Producten die je met het hartje hebt bewaard. Dit werkt zonder account: wij bewaren alleen een anoniem
          bezoekers-ID in een cookie. Een bewaring is geen beoordeling.
        </p>
      </header>

      <div className="pt-8">
        {products.length === 0 ? (
          <EmptyState
            title="Je hebt nog niets bewaard"
            description="Klik op het hartje bij een product om het hier terug te vinden. Je bewaarde producten blijven na een refresh staan."
          >
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
            >
              Naar de vondsten van vandaag
            </Link>
          </EmptyState>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              {products.length} {products.length === 1 ? 'bewaard product' : 'bewaarde producten'}
            </p>
            <ProductGrid products={products} surface="saved" priorityCount={2} />
          </>
        )}
      </div>
    </Container>
  )
}
