import type { Metadata } from 'next'
import Link from 'next/link'
import { TextPage } from '@/components/ui/TextPage'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Hoe wij selecteren',
  description:
    'Onze selectieregels: welke producten wel en niet op HomeAndLivingDeals komen, en hoe wij prijzen en kortingen controleren.',
  path: '/hoe-wij-selecteren',
})

export default function SelectionPage() {
  return (
    <TextPage
      title="Hoe wij selecteren"
      intro="Een product komt hier alleen op de site als het opvalt én als de prijsinformatie klopt. Dit zijn onze regels."
      path="/hoe-wij-selecteren"
    >
      <h2>Wanneer een product geschikt is</h2>
      <p>Een product moet minimaal twee van deze eigenschappen hebben:</p>
      <ul>
        <li>visueel opvallend;</li>
        <li>slim of technisch vernieuwend;</li>
        <li>het lost een herkenbaar probleem op;</li>
        <li>het is sterk cadeauwaardig;</li>
        <li>het zorgt voor comfort of plezier;</li>
        <li>er valt iets over te vertellen;</li>
        <li>het is een upgrade van een alledaags product;</li>
        <li>het is aantoonbaar aantrekkelijk geprijsd;</li>
        <li>het roept direct nieuwsgierigheid op.</li>
      </ul>

      <h2>Wat wij niet publiceren</h2>
      <ul>
        <li>generieke dagelijkse producten zonder onderscheidend element;</li>
        <li>losse kabels, adapters en verbruiksartikelen;</li>
        <li>losse videogames en digitale codes;</li>
        <li>standaard computer- en auto-onderdelen;</li>
        <li>producten zonder bruikbare afbeelding of betrouwbare prijs;</li>
        <li>producten met een verzonnen of niet-controleerbare korting;</li>
        <li>producten die alleen interessant zijn vanwege een hoge commissie.</li>
      </ul>

      <h2>Prijzen en kortingen</h2>
      <p>
        Wij tonen de huidige prijs van de aanbieder. Een korting laten wij alleen zien als er een geldige
        vergelijkingsprijs is die hoger is dan de huidige prijs, en wij vermelden altijd om wat voor
        vergelijkingsprijs het gaat: een van-prijs van de aanbieder, een adviesprijs, of een prijs die wij zelf
        eerder hebben gezien. Percentages en bespaarde bedragen rekent onze applicatie uit, nooit een taalmodel.
      </p>
      <p>
        Het woord “tijdelijk” gebruiken wij alleen als er een echte einddatum bekend is. Hebben wij een prijs meer
        dan 24 uur niet kunnen controleren, dan verbergen wij de dealknop tot de volgende controle.
      </p>

      <h2>Teksten</h2>
      <p>
        Onze koppen en beschrijvingen worden door de redactie geschreven, deels met behulp van taalmodellen die
        alleen gecontroleerde productfeiten van de aanbieder krijgen. Bij elk product staat minimaal één eerlijk
        aandachtspunt. Wij verzinnen geen materialen, afmetingen of functies, en wij beweren nooit dat wij een
        product zelf hebben getest. Zie ook onze <Link href="/affiliateverklaring">affiliateverklaring</Link>.
      </p>

      <h2>Demo-inhoud</h2>
      <p>
        Zolang er nog geen echte aanbieder is aangesloten, staat er demo-inhoud op de site. Die is duidelijk
        gemarkeerd met het label “Demo”, wordt niet geïndexeerd en verwijst niet naar een echte winkel.
      </p>
    </TextPage>
  )
}
