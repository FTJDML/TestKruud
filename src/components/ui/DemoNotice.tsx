import { Info } from 'lucide-react'

/**
 * Herkomst van demo-inhoud. `fictief` staat voor zelfbedachte fixtures,
 * `bron` voor producten die echt uit een open democatalogus zijn ingelezen.
 * De tekst moet blijven kloppen: bij `bron` zijn titel, prijs en foto niet
 * verzonnen.
 */
export type DemoOrigin = 'fictief' | 'bron'

type Props = {
  compact?: boolean
  origin?: DemoOrigin
  /** Naam van de bron, alleen gebruikt bij `origin: 'bron'`. */
  sourceName?: string
}

/** Demo-inhoud wordt zichtbaar gemarkeerd; technisch is zij noindex. */
export function DemoNotice({ compact = false, origin = 'fictief', sourceName }: Props) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill border border-line bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
        Demo
      </span>
    )
  }
  return (
    <p className="flex items-start gap-2 rounded-tile border border-line bg-canvas px-4 py-3 text-sm text-muted">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {origin === 'bron' ? (
        <span>
          Dit is <strong className="font-semibold text-ink">demo-inhoud uit een open catalogus</strong>. Titel,
          prijs en foto zijn opgehaald bij {sourceName ?? 'de bron'} en dus niet verzonnen, maar het product is
          hier niet te koop: de knop verwijst naar de bronpagina. Deze pagina wordt niet geïndexeerd.
        </span>
      ) : (
        <span>
          Dit is <strong className="font-semibold text-ink">demo-inhoud</strong>. Merk, prijs en beschrijving zijn
          verzonnen om de site te kunnen bouwen. Deze pagina wordt niet geïndexeerd en de dealknop verwijst niet
          naar een echte winkel.
        </span>
      )}
    </p>
  )
}
