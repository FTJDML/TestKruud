import {
  Alternatives,
  ComparisonTable,
  Conclusion,
  EditorialProductList,
  FaqBlock,
  FeaturedChoice,
  Introduction,
  InternalLinks,
  SelectionMethod,
  type TemplateProps,
} from '@/components/editorial/templates/shared'

/**
 * USE_CASE_GUIDE: de situatie staat centraal. Per product staat welke eigenschap
 * het in díe situatie bruikbaar maakt.
 */
export function UseCaseGuideTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      {page.useCase ? (
        <section aria-labelledby="situatie" className="rounded-card border border-line bg-canvas p-5">
          <h2 id="situatie" className="text-base font-semibold text-ink">
            De situatie
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">{page.useCase}</p>
        </section>
      ) : null}

      <section aria-labelledby="wat-werkt" className="space-y-4">
        <h2 id="wat-werkt" className="text-xl font-semibold sm:text-2xl">
          Wat werkt hier, en waarom
        </h2>
        <EditorialProductList products={page.selected} criteria={page.criteria} surface="editorial_use_case" />
      </section>

      {page.featured ? <FeaturedChoice featured={page.featured} /> : null}

      {page.criteria.length > 0 ? (
        <ComparisonTable
          criteria={page.criteria}
          products={page.selected}
          featuredProductId={page.featured?.product.id ?? null}
        />
      ) : null}

      <Conclusion page={page} />
      <Alternatives page={page} surface="editorial_alternative" />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
