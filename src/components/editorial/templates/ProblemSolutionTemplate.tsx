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
 * PROBLEM_SOLUTION: eerst het probleem concreet maken, dan per product de
 * eigenschap die het voor dit probleem relevant maakt. Zonder die eigenschap
 * hoort een product hier niet.
 */
export function ProblemSolutionTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <section aria-labelledby="probleem" className="space-y-4">
        <h2 id="probleem" className="text-xl font-semibold sm:text-2xl">
          Het probleem
        </h2>
        <Introduction page={page} />
      </section>

      <section aria-labelledby="oplossingen" className="space-y-4">
        <h2 id="oplossingen" className="text-xl font-semibold sm:text-2xl">
          Wat dit probleem oplost
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          Bij elk product staat welke eigenschap het verschil maakt. Die eigenschap komt uit gecontroleerde
          brondata, niet uit een aanname.
        </p>
        <EditorialProductList products={page.selected} criteria={page.criteria} surface="editorial_problem" />
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
