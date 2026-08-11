import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { STALE_AFTER_MS } from '@/lib/pricing/deal'
import { formatMoney, toCents } from '@/lib/pricing/money'

export const dynamic = 'force-dynamic'

const dateTime = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Amsterdam',
})

export default async function AdminRunsPage() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const now = new Date()
  const staleThreshold = new Date(now.getTime() - STALE_AFTER_MS)
  const [runs, staleOffers] = await Promise.all([
    prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { merchant: { select: { name: true } } },
    }),
    prisma.offer.findMany({
      where: { checkedAt: { lt: staleThreshold } },
      orderBy: { checkedAt: 'asc' },
      take: 50,
      include: {
        merchant: { select: { name: true } },
        product: { select: { id: true, title: true } },
      },
    }),
  ])

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-extrabold">Scrapehistorie</h1>
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Resultaat</th>
                <th className="px-4 py-3">Gestart</th>
                <th className="px-4 py-3">Melding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 font-medium">{run.merchant.name}</td>
                  <td className="px-4 py-3">{run.status}</td>
                  <td className="px-4 py-3 text-muted">
                    {run.productsFound} gevonden · {run.productsCreated} nieuw · {run.offersUpdated} aanbiedingen
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{dateTime.format(run.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-muted">{run.errorMessage ?? '—'}</td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    Nog geen runs.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Stale aanbiedingen</h2>
        <p className="mt-1 text-sm text-muted">
          Langer dan 24 uur niet gecontroleerd. Bij deze producten staat de dealknop uit tot de volgende run.
        </p>
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Prijs</th>
                <th className="px-4 py-3">Laatst gecontroleerd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staleOffers.map((offer) => (
                <tr key={offer.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/producten/${offer.product.id}`} className="hover:text-accent">
                      {offer.product.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{offer.merchant.name}</td>
                  <td className="px-4 py-3">{formatMoney(toCents(offer.currentPrice) ?? 0)}</td>
                  <td className="px-4 py-3 text-xs text-muted">{dateTime.format(offer.checkedAt)}</td>
                </tr>
              ))}
              {staleOffers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    Geen stale aanbiedingen.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
