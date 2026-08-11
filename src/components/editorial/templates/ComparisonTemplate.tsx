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
 * COMPARISON: de tabel staat vooraan, want wie vergelijkt wil eerst de feiten
 * naast elkaar. Daarna per product de doelgroep, de reden en het aandachtspunt,
 * en pas onderaan de methodologie en de bronnen.
 */
export function ComparisonTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      <section aria-labelledby="vergelijking" className="space-y-4">
        <h2 id="vergelijking" className="text-xl font-semibold sm:text-2xl">
          {page.selected.length} producten naast elkaar
        </h2>
        <ComparisonTable
          criteria={page.criteria}
          products={page.selected}
          featuredProductId={page.featured?.product.id ?? null}
        />
      </section>

      {page.featured ? <FeaturedChoice featured={page.featured} /> : null}

      <section aria-labelledby="per-product" className="space-y-4">
        <h2 id="per-product" className="text-xl font-semibold sm:text-2xl">
          Per product: voor wie is dit de beste keuze?
        </h2>
        <EditorialProductList products={page.selected} criteria={page.criteria} surface="editorial_comparison" />
      </section>

      <Conclusion page={page} />
      <Alternatives page={page} surface="editorial_alternative" />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
