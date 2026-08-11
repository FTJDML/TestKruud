import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdSlot } from '@/components/ads/AdSlot'
import { Breadcrumbs } from '@/components/product/Breadcrumbs'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { JsonLd } from '@/components/seo/JsonLd'
import { categoryBySlug } from '@/lib/categories'
import { getCategoryProducts } from '@/lib/database/queries'
import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import type { SortOption } from '@/types'
import { cn } from '@/lib/utils'

// Per request gerenderd: actuele prijzen, en een build zonder database.
export const dynamic = 'force-dynamic'

const PER_PAGE = 12

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'nieuwste', label: 'Nieuwste' },
  { value: 'korting', label: 'Hoogste korting' },
  { value: 'populair', label: 'Populair' },
  { value: 'prijs-laag', label: 'Prijs: laag naar hoog' },
]

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sorteer?: string; max?: string; deals?: string; pagina?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = categoryBySlug(slug)
  // In generateMetadata, want na de eerste flush kan de statuscode niet meer op
  // 404 worden gezet (zie (site)/loading.tsx).
  if (!category) notFound()

  return buildMetadata({
    title: `${category.name}: bijzondere vondsten`,
    description: category.intro.slice(0, 155),
    path: `/categorie/${category.slug}`,
  })
}

function parseSort(value: string | undefined): SortOption {
  return sortOptions.some((option) => option.value === value) ? (value as SortOption) : 'nieuwste'
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const category = categoryBySlug(slug)
  if (!category) notFound()
  const categorySlug = category.slug

  const sort = parseSort(query.sorteer)
  const onlyDeals = query.deals === '1'
  const maxPriceCents = query.max === '100' ? 100_00 : query.max === '250' ? 250_00 : undefined
  const page = Math.max(1, Number.parseInt(query.pagina ?? '1', 10) || 1)

  const result = await getCategoryProducts(category.name, {
    sort,
    onlyDeals,
    maxPriceCents,
    page,
    perPage: PER_PAGE,
  })

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: category.name, path: `/categorie/${category.slug}` },
  ]

  function buildHref(overrides: Record<string, string | undefined>) {
    const parameters = new URLSearchParams()
    const merged = {
      sorteer: sort === 'nieuwste' ? undefined : sort,
      deals: onlyDeals ? '1' : undefined,
      max: query.max,
      pagina: page > 1 ? String(page) : undefined,
      ...overrides,
    }
    for (const [key, value] of Object.entries(merged)) {
      if (value) parameters.set(key, value)
    }
    const search = parameters.toString()
    return `/categorie/${categorySlug}${search ? `?${search}` : ''}`
  }

  // Filtercombinaties zijn niet interessant voor zoekmachines.
  const isFiltered = sort !== 'nieuwste' || onlyDeals || maxPriceCents !== undefined || page > 1

  return (
    <>
      <JsonLd
        data={[breadcrumbJsonLd(crumbs), itemListJsonLd(result.items, `${category.name} op HomeAndLivingDeals`)]}
      />
      {isFiltered ? <meta name="robots" content="noindex, follow" /> : null}

      <Container className="pt-6">
        <Breadcrumbs items={crumbs} />
        <header className="mt-4 max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{category.name}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{category.intro}</p>
          <p className="mt-2 text-sm text-muted">
            {result.total} {result.total === 1 ? 'vondst' : 'vondsten'} in deze categorie.
          </p>
        </header>
      </Container>

      <Container className="pt-8">
        <div className="flex flex-col gap-4 rounded-card border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sorteren</p>
            <ul className="scroll-row mt-2 flex gap-2" role="list">
              {sortOptions.map((option) => (
                <li key={option.value} className="shrink-0">
                  <Link
                    href={buildHref({ sorteer: option.value === 'nieuwste' ? undefined : option.value, pagina: undefined })}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-pill border px-3 text-sm font-medium transition-colors',
                      sort === option.value
                        ? 'border-ink bg-ink text-white'
                        : 'border-line text-muted hover:border-ink hover:text-ink',
                    )}
                    aria-current={sort === option.value ? 'true' : undefined}
                  >
                    {option.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Filters</p>
            <ul className="mt-2 flex flex-wrap gap-2" role="list">
              <li>
                <Link
                  href={buildHref({ deals: onlyDeals ? undefined : '1', pagina: undefined })}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-pill border px-3 text-sm font-medium transition-colors',
                    onlyDeals
                      ? 'border-deal bg-deal-soft text-deal'
                      : 'border-line text-muted hover:border-ink hover:text-ink',
                  )}
                >
                  Alleen actuele deals
                </Link>
              </li>
              <li>
                <Link
                  href={buildHref({ max: query.max === '100' ? undefined : '100', pagina: undefined })}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-pill border px-3 text-sm font-medium transition-colors',
                    query.max === '100'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line text-muted hover:border-ink hover:text-ink',
                  )}
                >
                  Onder €100
                </Link>
              </li>
              <li>
                <Link
                  href={buildHref({ max: query.max === '250' ? undefined : '250', pagina: undefined })}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-pill border px-3 text-sm font-medium transition-colors',
                    query.max === '250'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line text-muted hover:border-ink hover:text-ink',
                  )}
                >
                  Onder €250
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>

      <Container className="pt-8">
        {result.items.length === 0 ? (
          <EmptyState
            title="Geen producten met deze filters"
            description="Pas de filters aan of bekijk de hele categorie. Wij publiceren alleen producten met een betrouwbare prijs."
          >
            <Link
              href={`/categorie/${category.slug}`}
              className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
            >
              Filters wissen
            </Link>
          </EmptyState>
        ) : (
          <ProductGrid products={result.items} surface={`category_${category.slug}`} priorityCount={2} />
        )}
      </Container>

      {result.items.length >= 8 ? (
        <Container className="pt-12">
          <AdSlot slot={`categorie-${category.slug}-in-feed`} variant="in-feed" />
        </Container>
      ) : null}

      {result.total > PER_PAGE ? (
        <Container className="pt-10">
          <nav aria-label="Paginering" className="flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link
                href={buildHref({ pagina: page - 1 === 1 ? undefined : String(page - 1) })}
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-5 text-sm font-semibold hover:border-ink"
                rel="prev"
              >
                Vorige
              </Link>
            ) : (
              <span />
            )}
            <p className="text-sm text-muted">
              Pagina {page} van {Math.ceil(result.total / PER_PAGE)}
            </p>
            {result.hasMore ? (
              <Link
                href={buildHref({ pagina: String(page + 1) })}
                className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
                rel="next"
              >
                Meer laden
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </Container>
      ) : null}
    </>
  )
}
