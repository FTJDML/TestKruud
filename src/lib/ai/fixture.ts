import {
  buildEvidenceSummary,
  type EditorialContentProvider,
  type EditorialGenerationResult,
  type ProductFacts,
} from '@/lib/ai/provider'
import { checkContentStyle, editorialContentSchema, type EditorialContentPayload } from '@/lib/ai/schema'
import { firstSentence, lastSentence, openingHash } from '@/lib/ai/style/openings'
import { checkVoice, STYLE_VERSION } from '@/lib/ai/style/voice'
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
      // Ook handgeschreven demo-content volgt de stijlregels; zo blijft de hele
      // site één stem en zien wij afwijkingen in de admin.
      const styleWarnings = [
        ...checkVoice(parsed.teaser, {
          surface: 'TEASER',
          ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
          ...(facts.allowInformalOpening === undefined
            ? {}
            : { allowInformalOpening: facts.allowInformalOpening }),
        }),
        ...checkVoice(parsed.longDescription, {
          surface: 'BODY',
          ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
        }),
        ...checkVoice(parsed.seoTitle, { surface: 'SEO_TITLE' }),
        ...checkVoice(parsed.metaDescription, { surface: 'META_DESCRIPTION' }),
      ].map((issue) => `${issue.surface}: ${issue.message}`)

      return Promise.resolve({
        content: parsed,
        provider: 'fixture',
        promptVersion: FIXTURE_PROMPT_VERSION,
        needsReview: false,
        warnings,
        model: null,
        evidenceSummary: buildEvidenceSummary(facts),
        // De opening staat vast in de fixture; wij bewaren welke stijl er is
        // gekozen zodat de variatiecontrole ook deze teksten meeneemt.
        openingStyle: facts.openingStyle ?? null,
        openingHash: openingHash(firstSentence(parsed.teaser)),
        closingHash: openingHash(lastSentence(parsed.longDescription)),
        styleVersion: STYLE_VERSION,
        styleWarnings,
      })
    },
  }
}
