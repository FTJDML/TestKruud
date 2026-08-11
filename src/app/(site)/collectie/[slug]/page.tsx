import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { JsonLd } from '@/components/seo/JsonLd'
import { collectionBySlug } from '@/lib/collections'
import { getCollectionProducts } from '@/lib/database/queries'
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

// Per request gerenderd: actuele prijzen, en een build zonder database.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  // In generateMetadata, want na de eerste flush kan de statuscode niet meer op
  // 404 worden gezet (zie (site)/loading.tsx).
  if (!collection) notFound()

  return buildMetadata({
    title: collection.name,
    description: collection.intro.slice(0, 155),
    path: `/collectie/${collection.slug}`,
  })
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  if (!collection) notFound()

  const products = await getCollectionProducts(collection.slug, 24)
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: collection.name, path: `/collectie/${collection.slug}` },
  ]

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemListJsonLd(products, collection.name)]} />

      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Collectie</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{collection.name}</h1>
          <p className="mt-2 font-display text-lg font-semibold text-accent">{collection.tagline}</p>
          <p className="mt-3 text-base leading-relaxed text-muted">{collection.intro}</p>
        </header>
      </Container>

      <Container className="pt-8">
        {products.length === 0 ? (
          <EmptyState
            title="Nog niets in deze collectie"
            description="Deze collectie wordt gevuld zodra er passende producten voorbijkomen."
          />
        ) : (
          <ProductGrid products={products} surface={`collectie-${collection.slug}`} priorityCount={2} />
        )}
      </Container>
    </>
  )
}
