import type { AdapterContext, AdapterResult, MerchantAdapter, NormalizedItem } from '@/merchants/types'
import { demoProducts } from '@/merchants/fixtures/demo-products'

/**
 * Lokale fixture-adapter: levert de demo-producten van deze merchant. Geen
 * netwerkverkeer, dus altijd bruikbaar voor de eerste visuele MVP en voor tests.
 */
export const fixtureAdapter: MerchantAdapter = {
  sourceType: 'FIXTURE',
  validate() {
    return []
  },
  fetchItems(context: AdapterContext): Promise<AdapterResult> {
    const items: NormalizedItem[] = demoProducts
      .filter((product) => product.merchantSlug === context.merchant.slug)
      .slice(0, context.limit ?? undefined)
      .map((product) => ({
        product: {
          externalId: product.externalId,
          title: product.title,
          brand: product.brand,
          model: product.model,
          ean: product.ean,
          primaryCategory: product.primaryCategory,
          shortSourceDescription: product.shortSourceDescription,
          specifications: product.specifications,
          imageUrl: `/demo/${product.image}.svg`,
          imageAlt: product.imageAlt,
          isDemo: true,
          collections: product.collections,
          editorialKey: product.title,
        },
        offer: {
          externalOfferId: `${product.externalId}-offer`,
          currentPriceCents: product.priceCents,
          referencePriceCents: product.referencePriceCents,
          referencePriceType: product.referencePriceType,
          currency: 'EUR',
          inStock: product.inStock,
          destinationUrl: `https://${context.merchant.domain}/product/${product.externalId}`,
          affiliateUrl: null,
          promotionEndsAt:
            product.promotionEndsInHours === undefined
              ? null
              : new Date(Date.now() + product.promotionEndsInHours * 3_600_000),
        },
      }))

    return Promise.resolve({ items, warnings: [] })
  },
}
