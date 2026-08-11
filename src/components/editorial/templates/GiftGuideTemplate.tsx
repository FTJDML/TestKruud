import {
  Conclusion,
  EditorialProductList,
  FaqBlock,
  Introduction,
  InternalLinks,
  SelectionMethod,
  type TemplateProps,
} from '@/components/editorial/templates/shared'

/**
 * GIFT_GUIDE: geen ranglijst en geen "beste" — cadeaus kiezen is geen meting.
 * Wel de prijsgrens, de leeftijdsindicatie van de fabrikant (als criterium),
 * waar het cadeau leuk voor is en welke accessoires er nog bij moeten.
 */
export function GiftGuideTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      {page.budgetLabel ? (
        <p className="rounded-card border border-line bg-canvas p-5 text-sm text-muted">
          Alle cadeaus in deze lijst kostten bij onze laatste controle{' '}
          <span className="font-medium text-ink">{page.budgetLabel}</span>. Leeftijdsindicaties komen van de
          fabrikant; wij bedenken die niet zelf.
        </p>
      ) : null}

      <section aria-labelledby="cadeaus" className="space-y-4">
        <h2 id="cadeaus" className="text-xl font-semibold sm:text-2xl">
          De cadeaus
        </h2>
        <EditorialProductList products={page.selected} criteria={page.criteria} surface="editorial_gift" />
      </section>

      <Conclusion page={page} />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
