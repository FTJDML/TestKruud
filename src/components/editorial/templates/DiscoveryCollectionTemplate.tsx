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
 * DISCOVERY_COLLECTION: originele vondsten die geen technische vergelijking
 * nodig hebben. Korte hook per product, doelgroep, toepassing en een
 * aandachtspunt — en geen tabel, want er valt niets te meten.
 */
export function DiscoveryCollectionTemplate({ page }: TemplateProps) {
  return (
    <div className="space-y-12">
      <Introduction page={page} />

      <section aria-labelledby="vondsten" className="space-y-4">
        <h2 id="vondsten" className="text-xl font-semibold sm:text-2xl">
          De vondsten
        </h2>
        <EditorialProductList
          products={page.selected}
          criteria={page.criteria}
          surface="editorial_discovery"
          showCriteria={false}
        />
      </section>

      <Conclusion page={page} />
      <FaqBlock faqs={page.faqs} />
      <SelectionMethod sources={page.sources} methodology={page.methodology} />
      <InternalLinks page={page} />
    </div>
  )
}
