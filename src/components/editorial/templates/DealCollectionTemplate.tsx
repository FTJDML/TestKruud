import { ProductGrid } from '@/components/product/ProductGrid'
import {
  Conclusion,
  FaqBlock,
  Introduction,
  InternalLinks,
  SelectionMethod,
  type TemplateProps,
} from '@/components/editorial/templates/shared'

/**
 * DEAL_COLLECTION: prijsdalingen die wij zelf hebben gemeten, gebundeld rond één
 * thema. Een raster werkt hier beter dan lange tekst; de prijsuitspraken staan
 * op de productpagina, uit de meetgegevens.
 */
export function DealCollectionTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      <section aria-labelledby="dealcollectie" className="space-y-4">
        <h2 id="dealcollectie" className="text-xl font-semibold sm:text-2xl">
          De actuele prijzen
        </h2>
        <p className="max-w-3xl text-sm text-muted">
          Elke prijs is onze laatste eigen meting bij de aanbieder. Op de productpagina staat wat wij over de
          prijshistorie kunnen zeggen.
        </p>
        <ProductGrid
          products={page.selected.map((entry) => entry.product)}
          surface="editorial_deal_collection"
          priorityCount={2}
        />
      </section>

      <Conclusion page={page} />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
