import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { Container } from '@/components/ui/Container'
import { AffiliateDisclosure } from '@/components/ui/AffiliateDisclosure'
import { JsonLd } from '@/components/seo/JsonLd'
import { EditorialTemplate } from '@/components/editorial/templates'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { getEditorialPageBySlug } from '@/lib/database/editorial-queries'
import { breadcrumbJsonLd, editorialPageJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

// Per request gerenderd: de prijzen op deze pagina moeten actueel zijn.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getEditorialPageBySlug(slug)
  if (!page) notFound()

  return buildMetadata({
    title: page.seoTitle,
    description: page.metaDescription,
    path: `/gids/${page.slug}`,
    // Pagina's die de quality gate niet halen blijven browsebaar en linken door,
    // maar komen niet in de index.
    noindex: !page.indexable,
    followWhenNoindex: true,
    ...(page.canonicalUrl ? { canonicalPath: page.canonicalUrl } : {}),
    ...(page.heroImage ? { image: page.heroImage } : {}),
    type: 'article',
  })
}

export default async function EditorialPageRoute({ params }: Props) {
  const { slug } = await params
  const page = await getEditorialPageBySlug(slug)
  if (!page) notFound()

  const archetype = archetypeFor(page.type)
  const crumbs = [
    { name: 'Home', path: '/' },
    ...(page.cluster ? [{ name: page.cluster.title, path: `/thema/${page.cluster.slug}` }] : []),
    { name: page.title, path: `/gids/${page.slug}` },
  ]

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), editorialPageJsonLd(page)]} />

      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{archetype.label}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{page.title}</h1>
          <p className="mt-3 text-sm text-muted">
            {page.selected.length} producten vergeleken
            {page.budgetLabel ? ` · ${page.budgetLabel}` : ''}
            {page.sources.lastFactCheckedAt
              ? ` · laatst gecontroleerd op ${dateFormat.format(page.sources.lastFactCheckedAt)}`
              : ''}
          </p>
          <AffiliateDisclosure className="mt-3" />
        </header>
      </Container>

      <Container className="pb-4 pt-8">
        <EditorialTemplate page={page} />
      </Container>
    </>
  )
}
