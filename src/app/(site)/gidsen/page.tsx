import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { ClusterNav } from '@/components/editorial/ClusterNav'
import { EditorialPageCards } from '@/components/editorial/EditorialPageCards'
import { getClusters, getPublishedEditorialPages } from '@/lib/database/editorial-queries'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

const description =
  'Alle vergelijkingen, koopgidsen en collecties van de redactie: gecontroleerde criteria, eigen prijsmetingen en een eerlijke reden waarom een product er wel of niet bij hoort.'

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: 'Vergelijkingen en koopgidsen',
    description,
    path: '/gidsen',
  })
}

/**
 * Overzicht van alle redactionele pagina's. Deze pagina bestaat ook om
 * verweesde pagina's te voorkomen: elke gepubliceerde gids is hiervandaan
 * bereikbaar, ook wanneer zij nog niet in een cluster staat.
 */
export default async function GuidesPage() {
  const [pages, clusters] = await Promise.all([
    getPublishedEditorialPages({ limit: 60 }),
    getClusters(),
  ])
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Vergelijkingen en koopgidsen', path: '/gidsen' },
  ]

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />

      <ClusterNav />

      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            Vergelijkingen en koopgidsen
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{description}</p>
        </header>
      </Container>

      {clusters.length > 0 ? (
        <Container className="pt-10">
          <SectionHeader title="Thema's" description="Elk thema bundelt categorieën, producten en gidsen." />
          <ul className="flex flex-wrap gap-2" role="list">
            {clusters.map((cluster) => (
              <li key={cluster.slug}>
                <Link
                  href={`/thema/${cluster.slug}`}
                  className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-medium hover:border-ink"
                >
                  {cluster.title}
                  <span className="ml-2 text-xs text-muted">{cluster.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      ) : null}

      <Container className="pb-4 pt-12">
        {pages.length === 0 ? (
          <EmptyState
            title="Nog geen gepubliceerde gidsen"
            description="De redactie werkt aan de eerste vergelijkingen. Bekijk in de tussentijd de nieuwste vondsten."
          />
        ) : (
          <EditorialPageCards pages={pages} />
        )}
      </Container>
    </>
  )
}
