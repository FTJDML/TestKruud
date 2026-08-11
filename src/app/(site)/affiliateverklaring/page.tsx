import type { Metadata } from 'next'
import Link from 'next/link'
import { TextPage } from '@/components/ui/TextPage'
import { buildMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildMetadata({
  title: 'Affiliateverklaring',
  description:
    'Hoe HomeAndLivingDeals.nl geld verdient, wat affiliate-links betekenen en wat dat wel en niet met onze selectie doet.',
  path: '/affiliateverklaring',
})

export default function AffiliatePage() {
  return (
    <TextPage
      title="Affiliateverklaring"
      intro="Wij verkopen zelf niets. Op termijn verdienen wij mogelijk een commissie wanneer je via ons doorklikt naar een aanbieder."
      path="/affiliateverklaring"
    >
      <h2>Status</h2>
      <p>
        Op dit moment zijn er nog geen affiliateprogramma’s aangesloten. Alle knoppen op deze site verwijzen naar
        de website van de aanbieder, zonder commissielink.
      </p>

      <h2>Wat verandert er als dat wel zo is</h2>
      <p>
        Zodra wij met een affiliateprogramma werken, lopen dealknoppen via een vaste doorverwijsroute op onze eigen
        site en vermelden wij dat bij elke link. Uitgaande links krijgen het kenmerk
        <code> rel=&quot;sponsored nofollow noopener&quot;</code>. Voor jou verandert de prijs niet: je betaalt bij de
        aanbieder hetzelfde bedrag.
      </p>

      <h2>Wat een commissie niet doet</h2>
      <ul>
        <li>Een hogere commissie geeft een product nooit een betere plek in de dagelijkse editie.</li>
        <li>Wij nemen geen producten op die alleen vanwege een commissie interessant zijn.</li>
        <li>Wij passen prijzen of kortingen nooit aan; die komen rechtstreeks van de aanbieder.</li>
      </ul>

      <p>
        Hoe wij producten kiezen staat op <Link href="/hoe-wij-selecteren">Hoe wij selecteren</Link>.
      </p>
    </TextPage>
  )
}
