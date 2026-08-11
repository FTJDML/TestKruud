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
 * BEST_OF: een genummerde selectie waarin elk product een eigen doelgroep heeft.
 * De tabel staat achter de lijst: het verhaal per product is hier belangrijker
 * dan de rij cijfers.
 */
export function BestOfTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />
      {page.featured ? <FeaturedChoice featured={page.featured} /> : null}

      <section aria-labelledby="selectie" className="space-y-4">
        <h2 id="selectie" className="text-xl font-semibold sm:text-2xl">
          Onze selectie
        </h2>
        <EditorialProductList
          products={page.selected}
          criteria={page.criteria}
          surface="editorial_best_of"
          numbered
        />
      </section>

      {page.criteria.length > 0 ? (
        <section aria-labelledby="tabel" className="space-y-4">
          <h2 id="tabel" className="text-xl font-semibold sm:text-2xl">
            De verschillen op een rij
          </h2>
          <ComparisonTable
            criteria={page.criteria}
            products={page.selected}
            featuredProductId={page.featured?.product.id ?? null}
          />
        </section>
      ) : null}

      <Conclusion page={page} />
      <Alternatives page={page} surface="editorial_alternative" />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
