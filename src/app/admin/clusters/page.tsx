import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { categories } from '@/lib/categories'
import { checkClusterProminence } from '@/lib/editorial/clusters'
import { categoryNamesFor } from '@/lib/database/editorial-queries'
import { publicProductFilter } from '@/lib/products/visibility'
import { clusterThresholdsFromEnv } from '@/lib/env'
import { seedClustersAction, updateClusterAction } from '@/app/admin/editorial-actions'

export const dynamic = 'force-dynamic'

/**
 * Clusterbeheer. Een cluster komt pas prominent in de navigatie wanneer het
 * genoeg gepubliceerde producten én genoeg redactionele pagina's heeft; die
 * drempels staan per cluster en zijn hier aan te passen.
 */
export default async function AdminClusters() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const thresholds = clusterThresholdsFromEnv()
  const clusters = await prisma.contentCluster.findMany({
    orderBy: { displayOrder: 'asc' },
    include: { editorialPages: { where: { status: 'PUBLISHED' }, select: { id: true } } },
  })

  const rows = []
  for (const cluster of clusters) {
    const productCount = await prisma.product.count({
      where: publicProductFilter({ primaryCategory: { in: categoryNamesFor(cluster.categorySlugs) } }),
    })
    rows.push({
      cluster,
      productCount,
      verdict: checkClusterProminence({
        status: cluster.status,
        visible: cluster.visible,
        minProducts: cluster.minProducts,
        minEditorialPages: cluster.minEditorialPages,
        publishedProductCount: productCount,
        publishedEditorialPageCount: cluster.editorialPages.length,
      }),
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Contentclusters</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Standaarddrempels uit de environment: {thresholds.minProducts} gepubliceerde producten en{' '}
            {thresholds.minEditorialPages} redactionele pagina&apos;s. Per cluster te overschrijven.
          </p>
        </div>
        <form action={seedClustersAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
          >
            Standaardclusters aanmaken
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nog geen clusters aangemaakt.</p>
      ) : null}

      {rows.map(({ cluster, productCount, verdict }) => (
        <form
          key={cluster.id}
          action={updateClusterAction}
          className="space-y-4 rounded-card border border-line bg-card p-5"
        >
          <input type="hidden" name="clusterId" value={cluster.id} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold">{cluster.title}</h2>
              <p className="text-xs text-muted">
                /thema/{cluster.slug} · {productCount} producten · {cluster.editorialPages.length} pagina&apos;s ·{' '}
                {verdict.prominent ? 'in de navigatie' : 'nog niet in de navigatie'}
              </p>
              {!verdict.prominent ? (
                <p className="mt-1 text-xs text-accent">{verdict.reasons.join('; ')}</p>
              ) : null}
            </div>
            <Link
              href={`/thema/${cluster.slug}`}
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
            >
              Bekijk pagina
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-ink">Titel</span>
              <input
                name="title"
                defaultValue={cluster.title}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Hoofdafbeelding</span>
              <input
                name="heroImage"
                defaultValue={cluster.heroImage ?? ''}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-ink">Redactionele introductie</span>
              <textarea
                name="introduction"
                rows={3}
                defaultValue={cluster.introduction}
                className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">SEO-title</span>
              <input
                name="seoTitle"
                defaultValue={cluster.seoTitle}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Meta description</span>
              <input
                name="metaDescription"
                defaultValue={cluster.metaDescription}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Primaire onderwerpen (komma-gescheiden)</span>
              <input
                name="primaryTopics"
                defaultValue={cluster.primaryTopics.join(', ')}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Categorieën (slugs, komma-gescheiden)</span>
              <input
                name="categorySlugs"
                defaultValue={cluster.categorySlugs.join(', ')}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
              <span className="mt-1 block text-xs text-muted">
                Beschikbaar: {categories.map((category) => category.slug).join(', ')}
              </span>
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Minimaal producten</span>
              <input
                name="minProducts"
                type="number"
                min={1}
                defaultValue={cluster.minProducts}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Minimaal redactionele pagina&apos;s</span>
              <input
                name="minEditorialPages"
                type="number"
                min={0}
                defaultValue={cluster.minEditorialPages}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Status</span>
              <select
                name="status"
                defaultValue={cluster.status}
                className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm"
              >
                <option value="DRAFT">concept</option>
                <option value="PUBLISHED">gepubliceerd</option>
              </select>
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input type="checkbox" name="visible" defaultChecked={cluster.visible} className="size-4" />
              <span>Zichtbaar (de drempels blijven ook gelden)</span>
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
          >
            Cluster opslaan
          </button>
        </form>
      ))}
    </div>
  )
}
