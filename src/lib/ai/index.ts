import { serverEnv } from '@/lib/env'
import { createAnthropicProvider } from '@/lib/ai/anthropic'
import { createFixtureProvider } from '@/lib/ai/fixture'
import { templateProvider } from '@/lib/ai/template'
import type { EditorialContentProvider, ProductFacts } from '@/lib/ai/provider'
import { demoEditorialForTitle } from '@/merchants/fixtures/demo-products'

/** Fixtureprovider met de handgeschreven demo-content. */
export const fixtureProvider = createFixtureProvider((facts: ProductFacts) =>
  demoEditorialForTitle(facts.title),
)

/** Provider volgens CONTENT_PROVIDER; valt terug op de templateprovider. */
export function configuredContentProvider(): EditorialContentProvider {
  const provider = serverEnv().CONTENT_PROVIDER
  if (provider === 'fixture') return fixtureProvider
  if (provider === 'anthropic') return createAnthropicProvider()
  return templateProvider
}

/**
 * Kiest de provider voor één product: bestaat er handgeschreven fixturecontent,
 * dan heeft die altijd voorrang. Zo blijft demo-content stabiel en kost het
 * genereren van demo-inhoud nooit een API-call.
 */
export function providerForProduct(facts: ProductFacts): EditorialContentProvider {
  if (demoEditorialForTitle(facts.title)) return fixtureProvider
  return configuredContentProvider()
}

export { templateProvider }
export type { EditorialContentProvider, ProductFacts }
