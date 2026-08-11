import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { archetypes, editorialPageTypes } from '@/lib/editorial/archetypes'
import { NewPageForm } from '@/components/admin/NewPageForm'
import { BulkPageForm } from '@/components/admin/BulkPageForm'

export const dynamic = 'force-dynamic'

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Overzicht van alle redactionele pagina's, met de bulkacties uit de
 * batchworkflow. Publiceren zit bewust niet in de bulkacties: dat blijft een
 * bewuste, losse keuze per pagina.
 */
export default async function AdminEditorialPages() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const [pages, clusters] = await Promise.all([
    prisma.editorialPage.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        cluster: { select: { title: true } },
        _count: { select: { products: true, sources: true, criteria: true } },
      },
    }),
    prisma.contentCluster.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, title: true } }),
  ])

  const perType = editorialPageTypes.map((type) => ({
    type,
    label: archetypes[type].label,
    count: pages.filter((page) => page.type === type).length,
    published: pages.filter((page) => page.type === type && page.status === 'PUBLISHED').length,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Redactionele pagina&apos;s</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {pages.length} pagina&apos;s, waarvan {pages.filter((page) => page.status === 'PUBLISHED').length}{' '}
          gepubliceerd en {pages.filter((page) => page.indexable).length} indexeerbaar. Of een pagina
          indexeerbaar is, bepaalt de quality gate — dat is geen knop.
        </p>
      </div>

      <NewPageForm clusters={clusters} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold">Per archetype</h2>
        <ul className="grid gap-2 sm:grid-cols-3" role="list">
          {perType.map((entry) => (
            <li key={entry.type} className="rounded-tile border border-line bg-card px-3 py-2 text-sm">
              <span className="font-medium text-ink">{entry.label}</span>
              <span className="ml-2 text-muted">
                {entry.count} totaal · {entry.published} gepubliceerd
              </span>
            </li>
          ))}
        </ul>
      </section>

      <BulkPageForm
        pages={pages.map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          typeLabel: archetypes[page.type].label,
          status: page.status,
          indexable: page.indexable,
          clusterTitle: page.cluster?.title ?? null,
          productCount: page._count.products,
          sourceCount: page._count.sources,
          criterionCount: page._count.criteria,
          reviewed: page.reviewedAt !== null,
          factChecked: page.lastFactCheckedAt !== null,
          scheduledLabel: page.scheduledPublishAt ? dateFormat.format(page.scheduledPublishAt) : null,
          reasons: Array.isArray(page.indexabilityReasons)
            ? (page.indexabilityReasons as unknown[]).filter(
                (reason): reason is string => typeof reason === 'string',
              )
            : [],
        }))}
      />

      <p className="text-xs text-muted">
        Nieuwe pagina nodig die op een bestaande lijkt? De overlapcontrole blokkeert dat en stelt samenvoegen
        of een canonical voor. Zie <Link href="/admin/lancering" className="underline">Lancering</Link> voor de
        overlappende pagina&apos;s.
      </p>
    </div>
  )
}
