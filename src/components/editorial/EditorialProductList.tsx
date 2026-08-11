import Link from 'next/link'
import { ProductImage } from '@/components/product/ProductImage'
import { PriceBlock } from '@/components/product/PriceBlock'
import { DealCta } from '@/components/product/DealCta'
import { NOT_PROVIDED_LABEL } from '@/components/editorial/ComparisonTable'
import type { ComparisonCriterionView, EditorialProductView } from '@/types'

type Props = {
  products: readonly EditorialProductView[]
  criteria: readonly ComparisonCriterionView[]
  surface: string
  /** Bij een cadeaugids of collectie is een nummer misleidend. */
  numbered?: boolean
  /** Toon per product de gecontroleerde criteria onder de tekst. */
  showCriteria?: boolean
}

/**
 * Producten op een redactionele pagina, met per product de doelgroep, de reden
 * en het aandachtspunt. Wat de bron niet levert blijft leeg met
 * "Niet opgegeven"; er wordt nooit een waarde bij bedacht.
 */
export function EditorialProductList({
  products,
  criteria,
  surface,
  numbered = false,
  showCriteria = true,
}: Props) {
  return (
    <ol className="space-y-6" role="list">
      {products.map((entry, index) => {
        const { product } = entry
        const verified = entry.cells.filter((cell) => (cell.value ?? '').trim().length > 0)
        return (
          <li
            key={product.id}
            className="grid gap-5 rounded-card border border-line bg-card p-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
          >
            <div>
              <ProductImage
                src={product.imageUrl}
                alt={product.imageAlt}
                productId={product.id}
                sizes="(min-width: 640px) 240px, 92vw"
                priority={index === 0}
              />
            </div>
            <div className="space-y-3">
              <div>
                {entry.label || entry.bestForAudience ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {entry.label ?? `Voor ${entry.bestForAudience}`}
                  </p>
                ) : null}
                <h3 className="mt-1 text-lg font-semibold">
                  <Link href={`/product/${product.slug}`} className="hover:text-accent">
                    {numbered ? `${index + 1}. ` : ''}
                    {product.title}
                  </Link>
                </h3>
                {entry.bestForAudience && entry.label ? (
                  <p className="mt-1 text-sm text-muted">Vooral geschikt voor {entry.bestForAudience}.</p>
                ) : null}
              </div>

              {product.pricing ? (
                <PriceBlock pricing={product.pricing} merchantName={product.merchantName} />
              ) : (
                <p className="text-sm text-muted">Geen actuele prijs bekend.</p>
              )}

              {entry.exceedsBudget && entry.budgetNote ? (
                <p className="rounded-tile border border-line bg-accent-soft px-3 py-2 text-sm text-ink">
                  <span className="font-medium">Boven het budget:</span> {entry.budgetNote}
                </p>
              ) : null}

              {entry.recommendation ? (
                <p className="text-sm leading-relaxed text-ink">{entry.recommendation}</p>
              ) : (
                <p className="text-sm leading-relaxed text-muted">{product.teaser}</p>
              )}

              {entry.caveat ? (
                <p className="text-sm text-muted">
                  <span className="font-medium text-ink">Aandachtspunt:</span> {entry.caveat}
                </p>
              ) : null}

              {showCriteria && criteria.length > 0 ? (
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {criteria.map((criterion) => {
                    const cell = entry.cells.find((item) => item.criterionName === criterion.name)
                    const value = (cell?.value ?? '').trim()
                    return (
                      <div key={criterion.name} className="flex justify-between gap-3 border-b border-line/60 py-1">
                        <dt className="text-muted">{criterion.label}</dt>
                        <dd className={value.length > 0 ? 'text-right text-ink' : 'text-right text-muted'}>
                          {value.length > 0
                            ? `${value}${criterion.unit ? ` ${criterion.unit}` : ''}`
                            : NOT_PROVIDED_LABEL}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              ) : null}

              {showCriteria && criteria.length > 0 && verified.length === 0 ? (
                <p className="text-xs text-muted">
                  Voor dit product zijn nog geen criteria gecontroleerd; wij vullen ze niet zelf in.
                </p>
              ) : null}

              <DealCta
                offerId={product.offerId}
                pricing={product.pricing}
                merchantName={product.merchantName}
                source={surface}
                position={index}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
