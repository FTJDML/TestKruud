import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { Container } from '@/components/ui/Container'
import { JsonLd } from '@/components/seo/JsonLd'
import { categories } from '@/lib/categories'
import { collections } from '@/lib/collections'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Alle categorieën',
  description:
    'Alle tien categorieën van HomeAndLivingDeals: van wonen en keuken tot gaming, tuin, onderweg en volstrekt overbodig.',
  path: '/categorieen',
})

export default function CategoriesPage() {
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Alle categorieën', path: '/categorieen' },
  ]

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-2xl">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Alle categorieën</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Eén product heeft altijd één primaire categorie, maar kan in meerdere redactionele collecties staan.
          </p>
        </header>
      </Container>

      <Container className="pt-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/categorie/${category.slug}`}
                className="flex h-full flex-col rounded-card border border-line bg-card p-5 transition-colors hover:border-ink/20 hover:bg-accent-soft"
              >
                <span className="font-display text-lg font-bold text-ink">{category.name}</span>
                <span className="mt-2 text-sm leading-relaxed text-muted">{category.intro}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <Container className="pt-12">
        <h2 className="text-2xl font-semibold">Redactionele collecties</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3" role="list">
          {collections.map((collection) => (
            <li key={collection.slug}>
              <Link
                href={`/collectie/${collection.slug}`}
                className="flex h-full flex-col rounded-card border border-line bg-card p-5 transition-colors hover:border-ink/20 hover:bg-accent-soft"
              >
                <span className="font-display text-base font-bold text-ink">{collection.name}</span>
                <span className="mt-1 text-sm font-medium text-accent">{collection.tagline}</span>
                <span className="mt-2 text-sm leading-relaxed text-muted">{collection.intro}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  )
}
