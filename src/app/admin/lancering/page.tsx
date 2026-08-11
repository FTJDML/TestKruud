import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { collectLaunchDashboard, type LaunchMetric } from '@/lib/editorial/launch-metrics'
import { loadHomepage } from '@/lib/editorial/homepage-data'
import { homepagePlacementsFromEnv, launchTargetsFromEnv } from '@/lib/env'
import { refreshLinkSuggestionsAction, seedClustersAction } from '@/app/admin/editorial-actions'

export const dynamic = 'force-dynamic'

/**
 * Launchdashboard.
 *
 * Elk getal is een meting op echte rijen. Er wordt niets bijgeschat om een
 * vakje groen te maken: rood betekent dat er werk ligt.
 */
const toneClasses: Record<LaunchMetric['tone'], string> = {
  groen: 'border-deal/40 bg-deal-soft text-deal',
  oranje: 'border-line bg-accent-soft text-ink',
  rood: 'border-accent/50 bg-card text-accent',
}

function MetricCard({ metric }: { metric: LaunchMetric }) {
  return (
    <div className={`rounded-card border p-4 ${toneClasses[metric.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{metric.label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">
        {metric.value}
        {metric.target !== null ? (
          <span className="ml-1 text-base font-semibold text-muted">/ {metric.target}</span>
        ) : null}
      </p>
      {metric.detail ? <p className="mt-1 text-xs text-muted">{metric.detail}</p> : null}
    </div>
  )
}

export default async function AdminLaunchDashboard() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const placements = homepagePlacementsFromEnv()
  // Exact dezelfde samenstelling als de homepage; geen schatting.
  const { homepage } = await loadHomepage()
  const dashboard = await collectLaunchDashboard(prisma, {
    homepagePlacements: homepage.placements,
    homepageMinimum: placements.min,
  })
  const targets = launchTargetsFromEnv()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Lancering</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Alle cijfers hieronder zijn metingen op echte rijen in de database. Er wordt niets gegenereerd om
            een doel te halen: staat een vakje rood, dan ligt daar werk. Doelen zijn instelbaar met de
            <code className="mx-1">LAUNCH_TARGET_*</code>-variabelen (nu {targets.publishedProducts} producten en{' '}
            {targets.publishedPages} pagina&apos;s).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={seedClustersAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
            >
              Standaardclusters aanmaken
            </button>
          </form>
          <form action={refreshLinkSuggestionsAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
            >
              Linksuggesties verversen
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold">Clusters</h2>
        <div className="overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Cluster</th>
                <th className="px-4 py-3">Producten</th>
                <th className="px-4 py-3">Pagina&apos;s</th>
                <th className="px-4 py-3">In navigatie</th>
                <th className="px-4 py-3">Wat er nog ontbreekt</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.clusters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-muted">
                    Nog geen clusters. Gebruik &quot;Standaardclusters aanmaken&quot; hierboven.
                  </td>
                </tr>
              ) : (
                dashboard.clusters.map((cluster) => (
                  <tr key={cluster.slug} className="border-b border-line/70 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Link href={`/thema/${cluster.slug}`} className="font-medium hover:text-accent">
                        {cluster.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{cluster.productCount}</td>
                    <td className="px-4 py-3 tabular-nums">{cluster.editorialPageCount}</td>
                    <td className="px-4 py-3">
                      {cluster.prominent ? (
                        <span className="text-deal">ja</span>
                      ) : (
                        <span className="text-accent">nee</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {cluster.reasons.length > 0 ? cluster.reasons.join('; ') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="font-display text-base font-extrabold">Overlappende pagina&apos;s</h2>
          {dashboard.overlaps.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Geen pagina&apos;s die met elkaar concurreren.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm" role="list">
              {dashboard.overlaps.map((group) => (
                <li key={group.titles.join('|')}>
                  <span className="font-medium text-ink">{Math.round(group.score * 100)}%</span>{' '}
                  {group.titles.join(' ↔ ')}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="font-display text-base font-extrabold">Lege categorieën</h2>
          {dashboard.emptyCategories.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Elke categorie heeft minimaal één zichtbaar product.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm" role="list">
              {dashboard.emptyCategories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/categorie/${category.slug}`} className="hover:text-accent">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="font-display text-base font-extrabold">Pagina&apos;s met werk</h2>
          <dl className="mt-2 space-y-2 text-sm">
            {(
              [
                ['zonder bronnen', dashboard.problemPages.withoutSources],
                ['zonder fact-check', dashboard.problemPages.withoutFactCheck],
                ['verouderde prijzen', dashboard.problemPages.stalePrices],
                ['verweesd', dashboard.problemPages.orphans],
              ] as const
            ).map(([label, pages]) => (
              <div key={label}>
                <dt className="font-medium text-ink">
                  {label} ({pages.length})
                </dt>
                <dd className="text-xs text-muted">
                  {pages.length === 0
                    ? '—'
                    : pages
                        .slice(0, 5)
                        .map((page) => page.slug)
                        .join(', ')}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-card border border-line bg-card p-5">
          <h2 className="font-display text-base font-extrabold">Ongeldige afbeeldingen</h2>
          {dashboard.invalidImages.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Geen producten met een afgekeurde afbeelding.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm" role="list">
              {dashboard.invalidImages.slice(0, 8).map((product) => (
                <li key={product.slug}>
                  {product.title}
                  <span className="text-xs text-muted">: {product.reason ?? 'geen reden vastgelegd'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
