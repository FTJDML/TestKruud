import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { launchTargetsFromEnv } from '@/lib/env'
import { setPlanEntryStatusAction, upsertPlanEntryAction } from '@/app/admin/editorial-actions'

export const dynamic = 'force-dynamic'

const dateFormat = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function inputDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ''
}

/**
 * Redactiekalender. Eén regel per gepland product of geplande pagina, met de
 * momenten waarop een fact-check, prijscontrole of update nodig is. Plannen is
 * geen publiceren: een regel hier zet niets online.
 */
export default async function AdminCalendar() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const now = new Date()
  const [entries, pages, clusters, products] = await Promise.all([
    prisma.contentPlanEntry.findMany({
      orderBy: [{ scheduledFor: 'asc' }],
      include: {
        editorialPage: { select: { slug: true, title: true, status: true } },
        product: { select: { slug: true, title: true, status: true } },
        cluster: { select: { title: true } },
      },
      take: 200,
    }),
    prisma.editorialPage.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    prisma.contentCluster.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, title: true } }),
    prisma.product.findMany({
      where: { status: { in: ['CANDIDATE', 'DRAFT', 'NEEDS_REVIEW', 'PUBLISHED'] } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
      take: 300,
    }),
  ])

  const targets = launchTargetsFromEnv()
  const upcoming = entries.filter(
    (entry) => entry.scheduledFor >= now && ['PLANNED', 'IN_PROGRESS'].includes(entry.status),
  )
  const lastPlanned = upcoming.at(-1)?.scheduledFor ?? null
  const plannedDays = lastPlanned
    ? Math.max(0, Math.ceil((lastPlanned.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Redactiekalender</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {upcoming.length} regels vooruit gepland, tot {plannedDays} dagen ({targets.plannedDays} is het doel).
          Plannen zet niets online: een geplande pagina wordt gepubliceerd door de dagelijkse job, en alleen
          wanneer de review is afgerond.
        </p>
      </div>

      <form action={upsertPlanEntryAction} className="grid gap-3 rounded-card border border-line bg-card p-5 sm:grid-cols-2">
        <h2 className="font-display text-lg font-extrabold sm:col-span-2">Nieuwe regel</h2>
        <label className="text-sm">
          <span className="font-medium text-ink">Type</span>
          <select name="type" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm">
            <option value="EDITORIAL_PAGE">redactionele pagina</option>
            <option value="PRODUCT">product</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Titel</span>
          <input name="title" required className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Gekoppelde pagina</span>
          <select name="editorialPageId" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm">
            <option value="">geen</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Gekoppeld product</span>
          <select name="productId" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm">
            <option value="">geen</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Cluster</span>
          <select name="clusterId" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm">
            <option value="">geen</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Publicatiedatum</span>
          <input type="date" name="scheduledFor" required className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Fact-check uiterlijk</span>
          <input type="date" name="factCheckDueAt" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Prijscontrole uiterlijk</span>
          <input type="date" name="priceCheckDueAt" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Update-herinnering</span>
          <input type="date" name="updateReminderAt" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Seizoensperiode</span>
          <input name="season" placeholder="sinterklaas-2026" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="text-sm">
          <span className="font-medium text-ink">Homepageplaatsing</span>
          <input name="homepagePlacement" placeholder="home_best_deals" className="mt-1 min-h-11 w-full rounded-tile border border-line bg-canvas px-3 text-sm" />
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" name="republishOnPriceDrop" className="size-4" />
          <span>Opnieuw publiceren bij een gemeten prijsdaling</span>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-ink">Notities</span>
          <textarea name="notes" rows={2} className="mt-1 w-full rounded-tile border border-line bg-canvas p-3 text-sm" />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent sm:col-span-2"
        >
          Regel opslaan
        </button>
      </form>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Wat</th>
              <th className="px-4 py-3">Fact-check</th>
              <th className="px-4 py-3">Prijscontrole</th>
              <th className="px-4 py-3">Seizoen</th>
              <th className="px-4 py-3">Homepage</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-muted">
                  Nog niets gepland.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b border-line/70 align-top last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{dateFormat.format(entry.scheduledFor)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{entry.title}</p>
                    <p className="text-xs text-muted">
                      {entry.type === 'EDITORIAL_PAGE' ? 'pagina' : 'product'}
                      {entry.editorialPage ? (
                        <>
                          {' · '}
                          <Link href={`/gids/${entry.editorialPage.slug}`} className="hover:text-accent">
                            {entry.editorialPage.title}
                          </Link>
                          {` (${entry.editorialPage.status})`}
                        </>
                      ) : null}
                      {entry.product ? ` · ${entry.product.title} (${entry.product.status})` : ''}
                      {entry.cluster ? ` · ${entry.cluster.title}` : ''}
                      {entry.republishOnPriceDrop ? ' · herpublicatie bij prijsdaling' : ''}
                    </p>
                    {entry.notes ? <p className="mt-1 text-xs text-muted">{entry.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs">{inputDate(entry.factCheckDueAt) || '—'}</td>
                  <td className="px-4 py-3 text-xs">{inputDate(entry.priceCheckDueAt) || '—'}</td>
                  <td className="px-4 py-3 text-xs">{entry.season ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">{entry.homepagePlacement ?? '—'}</td>
                  <td className="px-4 py-3">
                    <form action={setPlanEntryStatusAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <select
                        name="status"
                        defaultValue={entry.status}
                        className="min-h-11 rounded-tile border border-line bg-canvas px-2 text-xs"
                      >
                        <option value="PLANNED">gepland</option>
                        <option value="IN_PROGRESS">bezig</option>
                        <option value="DONE">klaar</option>
                        <option value="CANCELLED">geschrapt</option>
                      </select>
                      <button type="submit" className="text-xs font-semibold hover:text-accent">
                        Opslaan
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
