import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { getClusters } from '@/lib/database/editorial-queries'

/**
 * Themabalk met de contentclusters.
 *
 * Alleen clusters die hun drempels halen (genoeg gepubliceerde producten én
 * genoeg redactionele pagina's) staan hierin: een leeg thema in de navigatie
 * belooft iets wat er niet is.
 *
 * Deze balk staat bewust niet in `SiteHeader`: die wordt op élke route gerenderd,
 * ook op de statische pagina's die tijdens de build zonder database worden
 * voorgerenderd. Daarom staat de balk op de pagina's die al per request draaien.
 */
export async function ClusterNav({ activeSlug }: { activeSlug?: string } = {}) {
  const clusters = await getClusters({ onlyProminent: true })
  if (clusters.length === 0) return null

  return (
    <div className="border-y border-line bg-card/60">
      <Container>
        <nav aria-label="Thema's">
          <ul className="scroll-row flex items-center gap-1 py-1.5" role="list">
            <li className="shrink-0 pr-1 text-[13px] font-semibold text-muted">Thema&apos;s</li>
            {clusters.map((cluster) => {
              const isActive = cluster.slug === activeSlug
              return (
                <li key={cluster.slug} className="shrink-0">
                  <Link
                    href={`/thema/${cluster.slug}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={
                      isActive
                        ? 'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill bg-ink px-3 text-[13px] font-medium text-white'
                        : 'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-[13px] font-medium text-muted transition-colors hover:bg-canvas hover:text-ink'
                    }
                  >
                    {cluster.title}
                  </Link>
                </li>
              )
            })}
            <li className="shrink-0">
              <Link
                href="/gidsen"
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft"
              >
                Alle gidsen
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </div>
  )
}
