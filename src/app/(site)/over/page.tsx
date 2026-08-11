import type { Metadata } from 'next'
import Link from 'next/link'
import { TextPage } from '@/components/ui/TextPage'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Over ons',
  description:
    'HomeAndLivingDeals.nl is een Nederlands magazine voor bijzondere producten voor in en om het huis. Wij verkopen zelf niets.',
  path: '/over',
})

export default function AboutPage() {
  return (
    <TextPage
      title="Over ons"
      intro="Wij zoeken spullen waarvan je vijf minuten geleden nog niet wist dat je ze wilde, en schrijven eerlijk op wat eraan opvalt."
      path="/over"
    >
      <h2>Wat dit is</h2>
      <p>
        HomeAndLivingDeals.nl is geen webshop en geen generieke prijsvergelijker. Het is een Nederlands
        discovery-magazine: elke dag stellen wij een selectie samen van producten die het wonen, koken, werken,
        gamen, tuinieren, reizen of ontspannen leuker maken. Soms slim, soms mooi, soms volstrekt overbodig.
      </p>

      <h2>Wat dit niet is</h2>
      <ul>
        <li>Wij verkopen zelf niets: er is geen winkelwagen, geen kassa en geen account.</li>
        <li>Wij schrijven geen reviews en geven geen sterren; wij hebben de producten niet zelf getest.</li>
        <li>Wij verzinnen geen aftellers, geen schaarste en geen kortingen.</li>
      </ul>

      <h2>Prijzen</h2>
      <p>
        Alle prijzen komen van de aanbieder. Wij controleren ze dagelijks en laten zien wanneer wij een prijs voor
        het laatst hebben gezien. Is er geen betrouwbare vergelijkingsprijs, dan tonen wij alleen de huidige prijs
        en geen korting. Lees meer over{' '}
        <Link href="/hoe-wij-selecteren">hoe wij selecteren</Link>.
      </p>

      <h2>Redactie</h2>
      <p>
        Vragen, tips of een product dat hier hoort? Laat het weten via de <Link href="/contact">contactpagina</Link>.
      </p>
    </TextPage>
  )
}
