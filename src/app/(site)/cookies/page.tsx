import type { Metadata } from 'next'
import Link from 'next/link'
import { TextPage } from '@/components/ui/TextPage'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Cookies',
  description: 'Welke cookies HomeAndLivingDeals.nl gebruikt en waarvoor.',
  path: '/cookies',
})

export default function CookiesPage() {
  return (
    <TextPage
      title="Cookies"
      intro="Eén functionele cookie en wat lokale opslag in je browser. Meer is er niet."
      path="/cookies"
    >
      <h2>Functionele cookie</h2>
      <ul>
        <li>
          <strong>hald_vid</strong>: een willekeurig, anoniem bezoekers-ID. Nodig om bewaarde producten aan jouw
          browser te koppelen zonder account. httpOnly, first-party, één jaar geldig.
        </li>
      </ul>

      <h2>Lokale opslag</h2>
      <ul>
        <li>
          <strong>hald.saves.v1</strong>: een lijstje met de product-ID’s die je hebt bewaard, zodat het hartje
          direct de juiste status laat zien. Deze lijst blijft in je browser.
        </li>
      </ul>

      <h2>Wat er niet staat</h2>
      <p>
        Geen advertentiecookies, geen trackingpixels en geen cookies van derden. Zodra advertenties worden
        ingeschakeld, passen wij deze pagina en het <Link href="/privacy">privacybeleid</Link> eerst aan.
      </p>
    </TextPage>
  )
}
