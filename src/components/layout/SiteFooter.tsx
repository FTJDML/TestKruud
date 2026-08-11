import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Logo } from '@/components/layout/Logo'
import { categories } from '@/lib/categories'
import { collections } from '@/lib/collections'

const informationLinks = [
  { href: '/over', label: 'Over ons' },
  { href: '/hoe-wij-selecteren', label: 'Hoe wij selecteren' },
  { href: '/affiliateverklaring', label: 'Affiliateverklaring' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/contact', label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-card">
      <Container>
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted">
              Een Nederlands magazine voor spullen waarvan je vijf minuten geleden nog niet wist dat je ze wilde.
              Wij verkopen zelf niets.
            </p>
          </div>

          <nav aria-label="Categorieën in de footer">
            <h2 className="text-sm font-semibold text-ink">Categorieën</h2>
            <ul className="mt-3 space-y-2" role="list">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categorie/${category.slug}`}
                    className="text-sm text-muted transition-colors hover:text-accent"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Collecties in de footer">
            <h2 className="text-sm font-semibold text-ink">Collecties</h2>
            <ul className="mt-3 space-y-2" role="list">
              {collections.map((collection) => (
                <li key={collection.slug}>
                  <Link
                    href={`/collectie/${collection.slug}`}
                    className="text-sm text-muted transition-colors hover:text-accent"
                  >
                    {collection.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/nieuw" className="text-sm text-muted transition-colors hover:text-accent">
                  Nieuw ontdekt
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Informatie">
            <h2 className="text-sm font-semibold text-ink">Informatie</h2>
            <ul className="mt-3 space-y-2" role="list">
              {informationLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-line py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HomeAndLivingDeals.nl — alle prijzen onder voorbehoud.</p>
          <p>
            Prijzen komen van de aanbieder en worden dagelijks gecontroleerd. Wij verkopen zelf geen producten.
          </p>
        </div>
      </Container>
    </footer>
  )
}
