import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { runScrapeAction, toggleMerchantAction } from '@/app/admin/actions'
import { supportedSourceTypes } from '@/merchants/adapters'

export const dynamic = 'force-dynamic'

export default async function AdminMerchantsPage() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const merchants = await prisma.merchant.findMany({
    orderBy: { slug: 'asc' },
    include: {
      _count: { select: { offers: true } },
      scrapeRuns: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Merchants</h1>
        <p className="mt-1 text-sm text-muted">
          Ondersteunde brontypes: {supportedSourceTypes.join(', ')}. Scraping werkt alleen wanneer een merchant dat
          expliciet toestaat.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Bron</th>
              <th className="px-4 py-3">Aanbiedingen</th>
              <th className="px-4 py-3">Laatste run</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {merchants.map((merchant) => {
              const lastRun = merchant.scrapeRuns[0]
              return (
                <tr key={merchant.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{merchant.name}</p>
                    <p className="text-xs text-muted">
                      {merchant.domain} · trust {merchant.trustScore}
                      {merchant.scrapingAllowed ? ' · scraping toegestaan' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{merchant.sourceType}</td>
                  <td className="px-4 py-3">{merchant._count.offers}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {lastRun
                      ? `${lastRun.status} · ${new Intl.DateTimeFormat('nl-NL', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'Europe/Amsterdam',
                        }).format(lastRun.startedAt)}`
                      : 'nog niet uitgevoerd'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <form action={toggleMerchantAction}>
                        <input type="hidden" name="merchantId" value={merchant.id} />
                        <button
                          type="submit"
                          className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold"
                        >
                          {merchant.enabled ? 'Uitschakelen' : 'Inschakelen'}
                        </button>
                      </form>
                      <form action={runScrapeAction}>
                        <input type="hidden" name="merchantId" value={merchant.id} />
                        <button
                          type="submit"
                          className="rounded-pill bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Nu uitlezen
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
