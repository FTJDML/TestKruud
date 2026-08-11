import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { ClusterNav } from '@/components/editorial/ClusterNav'
import { EditorialPageCards } from '@/components/editorial/EditorialPageCards'
import { categories } from '@/lib/categories'
import {
  categoryNamesFor,
  getClusterBySlug,
  getPublishedEditorialPages,
} from '@/lib/database/editorial-queries'
import { getProductsForCategories } from '@/lib/database/queries'
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cluster = await getClusterBySlug(slug)
  if (!cluster) notFound()

  return buildMetadata({
    title: cluster.seoTitle,
    description: cluster.metaDescription,
    path: `/thema/${cluster.slug}`,
    // Een cluster dat de drempels nog niet haalt blijft bereikbaar, maar hoort
    // niet in de index: er staat dan te weinig op.
    noindex: !cluster.prominent,
    followWhenNoindex: true,
    ...(cluster.heroImage ? { image: cluster.heroImage } : {}),
  })
}

export default async function ClusterPage({ params }: Props) {
  const { slug } = await params
  const cluster = await getClusterBySlug(slug)
  if (!cluster) notFound()

  const [pages, products] = await Promise.all([
    getPublishedEditorialPages({ clusterSlug: cluster.slug, limit: 12 }),
    getProductsForCategories(categoryNamesFor(cluster.categorySlugs), 24),
  ])

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: cluster.title, path: `/thema/${cluster.slug}` },
  ]
  const clusterCategories = categories.filter((category) => cluster.categorySlugs.includes(category.slug))

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemListJsonLd(products, cluster.title)]} />

      <ClusterNav activeSlug={cluster.slug} />

      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Thema</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{cluster.title}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{cluster.introduction}</p>
          {cluster.primaryTopics.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Onderwerpen: {cluster.primaryTopics.join(' · ')}
            </p>
          ) : null}
          {clusterCategories.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" role="list">
              {clusterCategories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categorie/${category.slug}`}
                    className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium hover:border-ink"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </header>
      </Container>

      {pages.length > 0 ? (
        <Container className="pt-12">
          <SectionHeader
            title="Vergelijkingen en koopgidsen"
            description="Redactionele pagina's binnen dit thema, met gecontroleerde criteria en onze eigen prijsmetingen."
          />
          <EditorialPageCards pages={pages} />
        </Container>
      ) : null}

      <Container className="pt-12">
        <SectionHeader
          title="Producten in dit thema"
          description="Alles wat wij binnen dit thema volgen, met de laatst gemeten prijs."
        />
        {products.length === 0 ? (
          <EmptyState
            title="Nog geen producten in dit thema"
            description="Dit thema wordt gevuld zodra er passende producten zijn gepubliceerd."
          />
        ) : (
          <ProductGrid products={products} surface={`cluster_${cluster.slug}`} priorityCount={2} />
        )}
      </Container>
    </>
  )
}
