import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ProductStatus } from '@prisma/client'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { formatMoney, toCents } from '@/lib/pricing/money'
import { setProductStatusAction } from '@/app/admin/actions'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const statuses: Array<{ value: ProductStatus | 'ALLE'; label: string }> = [
  { value: 'ALLE', label: 'Alle' },
  { value: 'CANDIDATE', label: 'Kandidaten' },
  { value: 'NEEDS_REVIEW', label: 'Review nodig' },
  { value: 'DRAFT', label: 'Concept' },
  { value: 'PUBLISHED', label: 'Gepubliceerd' },
  { value: 'REJECTED', label: 'Afgewezen' },
  { value: 'ARCHIVED', label: 'Gearchiveerd' },
]

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')

  const { status } = await searchParams
  const active = statuses.find((entry) => entry.value === status)?.value ?? 'ALLE'

  const products = await prisma.product.findMany({
    where: active === 'ALLE' ? {} : { status: active },
    include: {
      editorial: { select: { headline: true, reviewedAt: true, aiProvider: true } },
      offers: {
        orderBy: { currentPrice: 'asc' },
        take: 1,
        include: { merchant: { select: { name: true } } },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Producten</h1>
        <p className="mt-1 text-sm text-muted">{products.length} producten in deze weergave.</p>
      </div>

      <ul className="scroll-row flex gap-2" role="list">
        {statuses.map((entry) => (
          <li key={entry.value} className="shrink-0">
            <Link
              href={entry.value === 'ALLE' ? '/admin/producten' : `/admin/producten?status=${entry.value}`}
              className={cn(
                'inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-medium',
                active === entry.value ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink',
              )}
            >
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3">Prijs</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Content</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((product) => {
              const offer = product.offers[0]
              const priceCents = offer ? (toCents(offer.currentPrice) ?? 0) : 0
              return (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/producten/${product.id}`} className="font-medium hover:text-accent">
                      {product.editorial?.headline ?? product.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {product.title}
                      {product.isDemo ? ' · demo' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{product.primaryCategory}</td>
                  <td className="px-4 py-3">
                    {offer ? (
                      <>
                        {formatMoney(priceCents)}
                        <p className="text-xs text-muted">{offer.merchant.name}</p>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-pill border border-line px-2 py-0.5 text-xs">{product.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {product.editorial
                      ? `${product.editorial.aiProvider}${product.editorial.reviewedAt ? ' · beoordeeld' : ' · nog beoordelen'}`
                      : 'geen content'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {product.status !== 'PUBLISHED' ? (
                        <form action={setProductStatusAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="status" value="PUBLISHED" />
                          <button
                            type="submit"
                            className="rounded-pill bg-deal-soft px-3 py-1.5 text-xs font-semibold text-deal"
                          >
                            Publiceren
                          </button>
                        </form>
                      ) : (
                        <form action={setProductStatusAction}>
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="status" value="DRAFT" />
                          <button
                            type="submit"
                            className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold"
                          >
                            Offline halen
                          </button>
                        </form>
                      )}
                      <form action={setProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value="REJECTED" />
                        <button
                          type="submit"
                          className="rounded-pill bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent"
                        >
                          Afwijzen
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Geen producten met deze status.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
