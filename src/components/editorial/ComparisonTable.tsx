import Link from 'next/link'
import { ProductImage } from '@/components/product/ProductImage'
import type { ComparisonCriterionView, EditorialProductView } from '@/types'

/** Wat er staat wanneer een bron de waarde niet levert. Nooit een gok. */
export const NOT_PROVIDED_LABEL = 'Niet opgegeven'

type Props = {
  criteria: readonly ComparisonCriterionView[]
  products: readonly EditorialProductView[]
  /** Id van het uitgelichte product, voor een rustige markering. */
  featuredProductId?: string | null
}

function cellText(product: EditorialProductView, criterionName: string): string {
  const cell = product.cells.find((entry) => entry.criterionName === criterionName)
  const value = cell?.value?.trim() ?? ''
  return value.length > 0 ? value : NOT_PROVIDED_LABEL
}

/**
 * Vergelijkingstabel.
 *
 * Op brede schermen één tabel met de producten als kolommen; op mobiel dezelfde
 * gegevens per product onder elkaar, zodat er niets weggelaten hoeft te worden.
 * Beide varianten staan in de HTML — de mobiele lijst is een `dl` per product,
 * wat voor een screenreader beter voorleest dan een horizontaal geschoven tabel.
 *
 * Ontbrekende waarden blijven zichtbaar leeg met "Niet opgegeven": een lege cel
 * zou als "onbekend maar misschien goed" gelezen kunnen worden.
 */
export function ComparisonTable({ criteria, products, featuredProductId }: Props) {
  if (criteria.length === 0 || products.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Brede schermen: één tabel, horizontaal schuifbaar binnen de eigen kaart. */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-card md:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="px-4 pt-4 text-left text-xs text-muted">
            Alle waarden komen uit gecontroleerde brondata. Staat er &quot;{NOT_PROVIDED_LABEL}&quot;,
            dan levert de bron dit gegeven niet en vullen wij het niet zelf in.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3 text-xs uppercase tracking-wide text-muted">
                Criterium
              </th>
              {products.map((entry) => (
                <th key={entry.product.id} scope="col" className="px-4 py-3 align-bottom">
                  <Link href={`/product/${entry.product.slug}`} className="font-semibold text-ink hover:text-accent">
                    {entry.product.title}
                  </Link>
                  {entry.product.id === featuredProductId ? (
                    <span className="mt-1 block text-xs font-medium text-accent">uitgelicht</span>
                  ) : null}
                  {entry.label ? (
                    <span className="mt-1 block text-xs text-muted">{entry.label}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/70">
              <th scope="row" className="px-4 py-3 font-medium text-ink">
                Actuele prijs
              </th>
              {products.map((entry) => (
                <td key={entry.product.id} className="px-4 py-3 tabular-nums">
                  {entry.product.pricing ? entry.product.pricing.currentPrice : NOT_PROVIDED_LABEL}
                  {entry.exceedsBudget ? (
                    <span className="mt-1 block text-xs text-accent">boven het budget</span>
                  ) : null}
                </td>
              ))}
            </tr>
            {criteria.map((criterion) => (
              <tr key={criterion.name} className="border-b border-line/70 last:border-0">
                <th scope="row" className="px-4 py-3 align-top font-medium text-ink">
                  {criterion.label}
                  {criterion.unit ? <span className="text-muted"> ({criterion.unit})</span> : null}
                  <span className="mt-1 block text-xs font-normal text-muted">{criterion.explanation}</span>
                </th>
                {products.map((entry) => {
                  const text = cellText(entry, criterion.name)
                  const missing = text === NOT_PROVIDED_LABEL
                  return (
                    <td
                      key={entry.product.id}
                      className={missing ? 'px-4 py-3 align-top text-muted' : 'px-4 py-3 align-top'}
                    >
                      {text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobiel: product voor product, met dezelfde waarden. */}
      <div className="space-y-4 md:hidden">
        {products.map((entry) => (
          <article key={entry.product.id} className="rounded-card border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="w-20 shrink-0">
                <ProductImage
                  src={entry.product.imageUrl}
                  alt={entry.product.imageAlt}
                  productId={entry.product.id}
                  sizes="80px"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">
                  <Link href={`/product/${entry.product.slug}`} className="hover:text-accent">
                    {entry.product.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm tabular-nums text-ink">
                  {entry.product.pricing ? entry.product.pricing.currentPrice : NOT_PROVIDED_LABEL}
                </p>
                {entry.label ? <p className="text-xs text-muted">{entry.label}</p> : null}
              </div>
            </div>
            <dl className="mt-3 divide-y divide-line/70 text-sm">
              {criteria.map((criterion) => {
                const text = cellText(entry, criterion.name)
                return (
                  <div key={criterion.name} className="flex justify-between gap-3 py-2">
                    <dt className="text-muted">
                      {criterion.label}
                      {criterion.unit ? ` (${criterion.unit})` : ''}
                    </dt>
                    <dd className={text === NOT_PROVIDED_LABEL ? 'text-right text-muted' : 'text-right text-ink'}>
                      {text}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
