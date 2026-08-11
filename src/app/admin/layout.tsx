import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { readAdminSession } from '@/lib/admin/auth'
import { logoutAction } from '@/app/admin/actions'

/** Adminroutes zijn altijd noindex. */
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

const navigation = [
  { href: '/admin', label: 'Overzicht' },
  { href: '/admin/producten', label: 'Producten' },
  { href: '/admin/merchants', label: 'Merchants' },
  { href: '/admin/integraties', label: 'Integraties' },
  { href: '/admin/runs', label: 'Runs & stale' },
  { href: '/admin/activiteit', label: 'Kliks & saves' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readAdminSession()

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#adminhoofd"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-pill focus:bg-ink focus:px-5 focus:text-sm focus:font-semibold focus:text-white"
      >
        Ga direct naar de inhoud
      </a>
      <Container className="py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="font-display text-lg font-extrabold">
              Adminpaneel <span className="text-accent">·</span> HomeAndLivingDeals
            </p>
            <p className="text-xs text-muted">
              Niet geïndexeerd. Nieuwe echte merchantproducten vragen standaard handmatige goedkeuring.
            </p>
          </div>
          {session ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold hover:border-ink"
              >
                Uitloggen ({session.username})
              </button>
            </form>
          ) : null}
        </div>

        {session ? (
          <nav aria-label="Adminnavigatie" className="scroll-row mt-4 flex gap-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-pill border border-line bg-card px-4 text-sm font-medium hover:border-ink"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/"
              className="inline-flex min-h-11 shrink-0 items-center rounded-pill px-4 text-sm font-medium text-muted hover:text-ink"
            >
              Naar de site
            </Link>
          </nav>
        ) : null}

        <div id="adminhoofd" className="mt-6">
          {children}
        </div>
      </Container>
    </div>
  )
}
