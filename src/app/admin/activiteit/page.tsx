import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

const dateTime = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Amsterdam',
})

export default async function AdminActivityPage() {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const [clicks, savesPerProduct, totalSaves] = await Promise.all([
    prisma.outboundClick.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        product: { select: { id: true, title: true } },
        merchant: { select: { name: true } },
      },
    }),
    prisma.anonymousSave.groupBy({
      by: ['productId'],
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 25,
    }),
    prisma.anonymousSave.count(),
  ])

  const products = await prisma.product.findMany({
    where: { id: { in: savesPerProduct.map((entry) => entry.productId) } },
    select: { id: true, title: true },
  })
  const titles = new Map(products.map((product) => [product.id, product.title]))

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-extrabold">Kliks en saves</h1>
        <p className="mt-1 text-sm text-muted">
          Echte bezoekersdata. Publiek tonen wij een save-aantal pas vanaf tien echte saves, en nooit als
          beoordeling. Totaal aantal saves: {totalSaves}.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Meest bewaard</h2>
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Saves</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {savesPerProduct.map((entry) => (
                <tr key={entry.productId}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/producten/${entry.productId}`} className="hover:text-accent">
                      {titles.get(entry.productId) ?? entry.productId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{entry._count.productId}</td>
                </tr>
              ))}
              {savesPerProduct.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted">
                    Nog geen saves.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Laatste uitgaande kliks</h2>
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Bron</th>
                <th className="px-4 py-3">Moment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clicks.map((click) => (
                <tr key={click.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/producten/${click.product.id}`} className="hover:text-accent">
                      {click.product.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{click.merchant.name}</td>
                  <td className="px-4 py-3 text-muted">{click.source}</td>
                  <td className="px-4 py-3 text-xs text-muted">{dateTime.format(click.createdAt)}</td>
                </tr>
              ))}
              {clicks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    Nog geen kliks.
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
