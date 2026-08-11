import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { serverEnv } from '@/lib/env'
import { STALE_AFTER_MS } from '@/lib/pricing/deal'
import { editionDate, formatEditionDate } from '@/lib/deals/edition-date'
import { republishEditionAction, runDailyJobAction } from '@/app/admin/actions'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const now = new Date()
  const staleThreshold = new Date(now.getTime() - STALE_AFTER_MS)
  const [
    products,
    candidates,
    needsReview,
    published,
    rejected,
    merchants,
    enabledMerchants,
    staleOffers,
    saves,
    clicks,
    edition,
    lastRuns,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: 'CANDIDATE' } }),
    prisma.product.count({ where: { status: 'NEEDS_REVIEW' } }),
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.product.count({ where: { status: 'REJECTED' } }),
    prisma.merchant.count(),
    prisma.merchant.count({ where: { enabled: true } }),
    prisma.offer.count({ where: { checkedAt: { lt: staleThreshold } } }),
    prisma.anonymousSave.count(),
    prisma.outboundClick.count(),
    prisma.dailyEdition.findFirst({
      where: { editionDate: editionDate(now) },
      include: { _count: { select: { items: true } } },
    }),
    prisma.scrapeRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5, include: { merchant: true } }),
  ])

  const cards = [
    { label: 'Producten totaal', value: products },
    { label: 'Kandidaten', value: candidates, href: '/admin/producten?status=CANDIDATE' },
    { label: 'Review nodig', value: needsReview, href: '/admin/producten?status=NEEDS_REVIEW' },
    { label: 'Gepubliceerd', value: published, href: '/admin/producten?status=PUBLISHED' },
    { label: 'Afgewezen', value: rejected, href: '/admin/producten?status=REJECTED' },
    { label: 'Merchants (aan/totaal)', value: `${enabledMerchants}/${merchants}`, href: '/admin/merchants' },
    { label: 'Stale aanbiedingen', value: staleOffers, href: '/admin/runs' },
    { label: 'Saves', value: saves, href: '/admin/activiteit' },
    { label: 'Uitgaande kliks', value: clicks, href: '/admin/activiteit' },
  ]

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-extrabold">Overzicht</h1>
        <p className="mt-1 text-sm text-muted">
          Contentprovider: <strong>{serverEnv().CONTENT_PROVIDER}</strong> · tijdzone Europe/Amsterdam
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-card border border-line bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.label}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{card.value}</p>
              {card.href ? (
                <Link href={card.href} className="mt-1 inline-block text-xs text-accent hover:underline">
                  Bekijken
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Editie van vandaag</h2>
        <p className="mt-1 text-sm text-muted">
          {edition
            ? `${formatEditionDate(edition.editionDate)} · status ${edition.status} · ${edition._count.items} items`
            : 'Er is nog geen editie voor vandaag. De vorige editie blijft zichtbaar op de site.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={runDailyJobAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
            >
              Dagelijkse job starten
            </button>
          </form>
          <form action={republishEditionAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-pill border border-line px-5 text-sm font-semibold hover:border-ink"
            >
              Alleen editie opnieuw samenstellen
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-card border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Laatste runs</h2>
          <Link href="/admin/runs" className="text-sm text-accent hover:underline">
            Volledige historie
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-line" role="list">
          {lastRuns.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{run.merchant.name}</span>
              <span className="text-muted">{run.status}</span>
              <span className="text-muted">
                {run.productsFound} gevonden · {run.productsCreated} nieuw · {run.offersUpdated} aanbiedingen
              </span>
              <span className="text-xs text-muted">
                {new Intl.DateTimeFormat('nl-NL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: 'Europe/Amsterdam',
                }).format(run.startedAt)}
              </span>
            </li>
          ))}
          {lastRuns.length === 0 ? <li className="py-2 text-sm text-muted">Nog geen runs.</li> : null}
        </ul>
      </section>
    </div>
  )
}
