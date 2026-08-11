import type { Metadata } from 'next'
import Link from 'next/link'
import { TextPage } from '@/components/ui/TextPage'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Contact',
  description: 'Neem contact op met de redactie van HomeAndLivingDeals.nl: tips, correcties en samenwerkingen.',
  path: '/contact',
})

export default function ContactPage() {
  return (
    <TextPage
      title="Contact"
      intro="Tip, correctie of een aanbieder die hier hoort? Wij lezen alles."
      path="/contact"
    >
      <h2>Redactie</h2>
      <p>
        Mail naar <a href="mailto:redactie@homeandlivingdeals.nl">redactie@homeandlivingdeals.nl</a>. Zie je een
        prijs die niet klopt of een product dat niet meer bestaat? Stuur de link mee, dan passen wij het aan.
      </p>

      <h2>Aanbieders</h2>
      <p>
        Wil je jouw assortiment aanbieden? Stuur ons de naam van de winkel, het domein, hoe wij de gegevens kunnen
        ophalen (feed, API of een toegestane URL) en welke velden daarin staan voor prijs, vergelijkingsprijs,
        voorraad, afbeelding en product-ID.
      </p>

      <h2>Privacy</h2>
      <p>
        Wil je je bewaarde producten laten verwijderen? Dat kan door het cookie in je browser te wissen, of vraag
        het ons. Zie de <Link href="/privacy">privacypagina</Link>.
      </p>
    </TextPage>
  )
}
