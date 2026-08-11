import type {
  EditorialContentProvider,
  EditorialGenerationResult,
  ProductFacts,
} from '@/lib/ai/provider'
import { checkContentStyle, editorialContentSchema, type EditorialContentPayload } from '@/lib/ai/schema'
import { buildTemplateContent } from '@/lib/ai/template'

export const FIXTURE_PROMPT_VERSION = 'fixture-2026-08-nl-1'

type FixtureLookup = (facts: ProductFacts) => EditorialContentPayload | undefined

/**
 * Fixtureprovider: gebruikt handgeschreven demo-content wanneer die bestaat en
 * valt anders terug op de templateprovider. Hiermee werkt de hele site zonder
 * externe API-key.
 */
export function createFixtureProvider(lookup: FixtureLookup): EditorialContentProvider {
  return {
    name: 'fixture',
    promptVersion: FIXTURE_PROMPT_VERSION,
    generate(facts): Promise<EditorialGenerationResult> {
      const candidate = lookup(facts)
      if (!candidate) return Promise.resolve(buildTemplateContent(facts))
      const parsed = editorialContentSchema.parse(candidate)
      const warnings = checkContentStyle(parsed).map((issue) => `${issue.field}: ${issue.message}`)
      return Promise.resolve({
        content: parsed,
        provider: 'fixture',
        promptVersion: FIXTURE_PROMPT_VERSION,
        needsReview: false,
        warnings,
      })
    },
  }
}
