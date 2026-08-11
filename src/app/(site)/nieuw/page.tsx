import type { Metadata } from 'next'
import { AdSlot } from '@/components/ads/AdSlot'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { JsonLd } from '@/components/seo/JsonLd'
import { getNewProducts } from '@/lib/database/queries'
import { itemListJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

// Per request gerenderd: actuele prijzen, en een build zonder database.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildMetadata({
  title: 'Nieuw ontdekt',
  description:
    'De laatste vondsten die wij hebben toegevoegd: verrassende, slimme en soms overbodige producten voor in en om het huis.',
  path: '/nieuw',
})

export default async function NewPage() {
  const products = await getNewProducts(24)

  return (
    <>
      <JsonLd data={itemListJsonLd(products, 'Nieuw ontdekt')} />
      <Container className="pt-8">
        <header className="max-w-2xl">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Nieuw ontdekt</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Alles wat recent aan onze lijst is toegevoegd, ongeacht de editie van vandaag. Nieuwste bovenaan.
          </p>
        </header>
      </Container>

      <Container className="pt-8">
        {products.length === 0 ? (
          <EmptyState
            title="Nog geen producten"
            description="Zodra de dagelijkse job heeft gelopen, staan hier de nieuwste vondsten."
          />
        ) : (
          <ProductGrid products={products} surface="new_products" priorityCount={2} />
        )}
      </Container>

      {products.length >= 8 ? (
        <Container className="pt-12">
          <AdSlot slot="nieuw-in-feed" variant="in-feed" />
        </Container>
      ) : null}
    </>
  )
}
