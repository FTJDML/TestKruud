import { Info } from 'lucide-react'

/** Demo-inhoud wordt zichtbaar gemarkeerd; technisch is zij noindex. */
export function DemoNotice({ compact = false }: { compact?: boolean }) {
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
      <span>
        Dit is <strong className="font-semibold text-ink">demo-inhoud</strong>. Merk, prijs en beschrijving zijn
        verzonnen om de site te kunnen bouwen. Deze pagina wordt niet geïndexeerd en de dealknop verwijst niet
        naar een echte winkel.
      </span>
    </p>
  )
}
