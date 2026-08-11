import { ComparisonTable } from '@/components/editorial/ComparisonTable'
import { EditorialProductList } from '@/components/editorial/EditorialProductList'
import { FaqBlock } from '@/components/editorial/FaqBlock'
import { FeaturedChoice } from '@/components/editorial/FeaturedChoice'
import { SelectionMethod } from '@/components/editorial/SelectionMethod'
import type { EditorialPageView } from '@/types'

/**
 * Bouwstenen die elk archetype gebruikt. De archetypen verschillen in wat zij
 * tonen en in welke volgorde — daarom heeft elk type een eigen template — maar
 * de losse onderdelen zijn hier één keer geschreven.
 */
export type TemplateProps = { page: EditorialPageView }

/** Introductie met de primaryQuery in een natuurlijke zin. */
export function Introduction({ page }: TemplateProps) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="whitespace-pre-line text-base leading-relaxed text-ink sm:text-lg">
        {page.introduction}
      </p>
      {page.audience || page.useCase ? (
        <p className="text-sm text-muted">
          {page.audience ? `Bedoeld voor ${page.audience}.` : ''}
          {page.audience && page.useCase ? ' ' : ''}
          {page.useCase ? `Situatie: ${page.useCase}.` : ''}
        </p>
      ) : null}
    </div>
  )
}

export function Conclusion({ page }: TemplateProps) {
  if (!page.conclusion) return null
  return (
    <section aria-labelledby="conclusie" className="max-w-3xl space-y-2">
      <h2 id="conclusie" className="text-xl font-semibold sm:text-2xl">
        Onze conclusie
      </h2>
      <p className="whitespace-pre-line text-base leading-relaxed text-ink">{page.conclusion}</p>
    </section>
  )
}

export function Alternatives({ page, surface }: TemplateProps & { surface: string }) {
  if (page.alternatives.length === 0) return null
  return (
    <section aria-labelledby="alternatieven" className="space-y-4">
      <h2 id="alternatieven" className="text-xl font-semibold sm:text-2xl">
        Alternatieven
      </h2>
      <p className="max-w-3xl text-sm text-muted">
        Deze producten haalden de selectie niet, maar passen bij een ander budget of een andere situatie.
      </p>
      <EditorialProductList
        products={page.alternatives}
        criteria={page.criteria}
        surface={surface}
        showCriteria={false}
      />
    </section>
  )
}

export function InternalLinks({ page }: TemplateProps) {
  if (page.internalLinks.length === 0) return null
  return (
    <nav aria-labelledby="verder-lezen" className="rounded-card border border-line bg-card p-5">
      <h2 id="verder-lezen" className="text-base font-semibold text-ink">
        Verder lezen
      </h2>
      <ul className="mt-2 space-y-1 text-sm" role="list">
        {page.internalLinks.map((link) => (
          <li key={`${link.href}-${link.anchorText}`}>
            <a href={link.href} className="underline decoration-line underline-offset-2 hover:text-accent">
              {link.anchorText}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { ComparisonTable, EditorialProductList, FaqBlock, FeaturedChoice, SelectionMethod }
