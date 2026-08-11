import type { Metadata } from 'next'
import Link from 'next/link'
import { TextPage } from '@/components/ui/TextPage'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Privacy',
  description:
    'Welke gegevens HomeAndLivingDeals.nl verwerkt: een anoniem bezoekers-ID voor bewaarde producten, en niets meer dan nodig.',
  path: '/privacy',
})

export default function PrivacyPage() {
  return (
    <TextPage
      title="Privacy"
      intro="Wij houden het simpel: geen accounts, geen externe trackers en zo weinig gegevens als mogelijk."
      path="/privacy"
    >
      <h2>Wat wij opslaan</h2>
      <ul>
        <li>
          <strong>Een anoniem bezoekers-ID.</strong> Dit is een willekeurige code in een first-party cookie
          (<code>hald_vid</code>), zodat je bewaarde producten na een refresh nog kloppen. Er zit geen naam,
          e-mailadres of profiel aan vast.
        </li>
        <li>
          <strong>Bewaarde producten.</strong> Welke producten bij dat anonieme ID horen.
        </li>
        <li>
          <strong>Uitgaande kliks.</strong> Welk product en welke aanbieder is aangeklikt, met datum en tijd.
        </li>
      </ul>

      <h2>Wat wij niet doen</h2>
      <ul>
        <li>Geen accounts, geen wachtwoorden, geen betaalgegevens.</li>
        <li>Geen externe analytics- of advertentietrackers in deze versie van de site.</li>
        <li>Geen verkoop of doorgifte van gegevens aan derden.</li>
      </ul>

      <h2>Bewaartermijn en verwijderen</h2>
      <p>
        Het cookie verloopt na een jaar. Wil je je bewaarde producten wissen, verwijder dan het cookie in je
        browser of vraag het ons via de <Link href="/contact">contactpagina</Link>.
      </p>

      <h2>Advertenties</h2>
      <p>
        Advertentieposities zijn in deze versie uitgeschakeld. Zetten wij advertenties aan, dan werken wij dit
        beleid en de <Link href="/cookies">cookiepagina</Link> bij voordat er iets van een advertentiepartij wordt
        geladen.
      </p>
    </TextPage>
  )
}
