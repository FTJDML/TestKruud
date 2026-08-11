import {
  ComparisonTable,
  Conclusion,
  EditorialProductList,
  FaqBlock,
  Introduction,
  InternalLinks,
  SelectionMethod,
  type TemplateProps,
} from '@/components/editorial/templates/shared'

/**
 * DESIGN_COLLECTION: stijl en smaak zijn geen meetbare criteria, dus deze
 * template spreekt geen winnaar uit. Wat er wél naast elkaar staat, is
 * controleerbaar: materiaal, afmetingen, zitplaatsen, montage, onderhoud en de
 * actuele prijs.
 */
export function DesignCollectionTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      <p className="max-w-3xl rounded-card border border-line bg-canvas p-5 text-sm text-muted">
        Deze collectie zet geen nummer één op de eerste plaats: welke stijl je mooi vindt, kunnen wij niet
        meten. Wij vergelijken wat wél te controleren is en laten de keuze aan jou.
      </p>

      <section aria-labelledby="collectie" className="space-y-4">
        <h2 id="collectie" className="text-xl font-semibold sm:text-2xl">
          De collectie
        </h2>
        <EditorialProductList products={page.selected} criteria={page.criteria} surface="editorial_design" />
      </section>

      {page.criteria.length > 0 ? (
        <section aria-labelledby="tabel" className="space-y-4">
          <h2 id="tabel" className="text-xl font-semibold sm:text-2xl">
            Materiaal, maten en onderhoud
          </h2>
          <ComparisonTable criteria={page.criteria} products={page.selected} />
        </section>
      ) : null}

      <Conclusion page={page} />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
