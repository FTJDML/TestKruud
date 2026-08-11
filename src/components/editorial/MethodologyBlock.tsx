import Link from 'next/link'
import { Eye, RefreshCcw, ShoppingBag, Tag } from 'lucide-react'

const points = [
  {
    icon: Eye,
    title: 'Geselecteerd op originaliteit',
    body: 'Wij kiezen producten die opvallen, iets slim oplossen of een verhaal hebben. Generieke dagelijkse spullen laten we staan.',
  },
  {
    icon: RefreshCcw,
    title: 'Prijzen worden gecontroleerd',
    body: 'Elke dag halen wij de actuele prijs bij de aanbieder op. Bij elk product staat wanneer wij die het laatst zagen.',
  },
  {
    icon: ShoppingBag,
    title: 'Wij verkopen zelf niets',
    body: 'Je koopt altijd bij de aanbieder. Wij hebben geen winkelwagen, geen kassa en geen accounts.',
  },
  {
    icon: Tag,
    title: 'Affiliate-links melden wij',
    body: 'Zodra wij met affiliateprogramma’s werken, staat dat duidelijk bij elke link en op onze affiliatepagina.',
  },
]

/** Korte, rustige uitleg over onze werkwijze. */
export function MethodologyBlock() {
  return (
    <section aria-labelledby="methode-titel" className="rounded-card border border-line bg-card p-6 sm:p-8">
      <h2 id="methode-titel" className="text-2xl font-semibold">
        Hoe deze site werkt
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Geen kortingsbombardement en geen verzonnen aftellers. Wij zoeken bijzondere producten, controleren de
        prijs en schrijven op wat er goed en minder goed aan is.
      </p>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {points.map((point) => (
          <li key={point.title}>
            <point.icon aria-hidden className="size-5 text-accent" />
            <h3 className="mt-2 text-sm font-semibold text-ink">{point.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{point.body}</p>
          </li>
        ))}
      </ul>
      <Link
        href="/hoe-wij-selecteren"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:text-accent hover:decoration-accent"
      >
        Lees hoe wij selecteren
      </Link>
    </section>
  )
}
