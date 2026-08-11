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
 * BUDGET_GUIDE: de grens staat bovenaan en blijft zichtbaar. Producten boven het
 * budget mogen alleen meedoen met een expliciete uitleg — die staat dan bij het
 * product zelf, niet in een voetnoot.
 */
export function BudgetGuideTemplate({ page }: TemplateProps) {
  const overBudget = page.selected.filter((entry) => entry.exceedsBudget)
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      {page.budgetLabel ? (
        <section
          aria-labelledby="budget"
          className="rounded-card border border-line bg-canvas p-5"
        >
          <h2 id="budget" className="text-base font-semibold text-ink">
            Het budget: {page.budgetLabel}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Alle prijzen zijn de laatste door ons gemeten prijzen bij de aanbieder. Wij nemen alleen
            producten op die op het moment van controle binnen deze grens vielen.
            {overBudget.length > 0
              ? ` ${overBudget.length} product(en) liggen er bewust boven; bij die producten staat waarom.`
              : ''}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="binnen-budget" className="space-y-4">
        <h2 id="binnen-budget" className="text-xl font-semibold sm:text-2xl">
          Wat er binnen dit budget mogelijk is
        </h2>
        <EditorialProductList
          products={page.selected}
          criteria={page.criteria}
          surface="editorial_budget"
          numbered
        />
      </section>

      {page.featured ? <FeaturedChoice featured={page.featured} /> : null}

      {page.criteria.length > 0 ? (
        <section aria-labelledby="tabel" className="space-y-4">
          <h2 id="tabel" className="text-xl font-semibold sm:text-2xl">
            Wat je per prijsklasse krijgt
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
