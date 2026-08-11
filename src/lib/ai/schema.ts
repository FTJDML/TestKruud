import { z } from 'zod'
import { wordCount } from '@/lib/utils'

/**
 * Verwachte JSON-output van een EditorialContentProvider. De AI krijgt alleen
 * gecontroleerde productfeiten en mag nooit prijzen of kortingen berekenen.
 */
export const editorialContentSchema = z.object({
  headline: z.string().min(10).max(90),
  teaser: z.string().min(120),
  longDescription: z.string().min(300),
  whyItStandsOut: z.string().min(40),
  bestFor: z.array(z.string().min(2)).min(1).max(5),
  caveat: z.string().min(15),
  seoTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(170),
  tags: z.array(z.string().min(2)).min(2).max(8),
  uniquenessScore: z.number().int().min(0).max(100),
  storyScore: z.number().int().min(0).max(100),
  usefulnessScore: z.number().int().min(0).max(100),
  giftabilityScore: z.number().int().min(0).max(100),
})

export type EditorialContentPayload = z.infer<typeof editorialContentSchema>

/** JSON Schema voor structured output; bewust in sync met het Zod-schema. */
export const editorialContentJsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    teaser: { type: 'string' },
    longDescription: { type: 'string' },
    whyItStandsOut: { type: 'string' },
    bestFor: { type: 'array', items: { type: 'string' } },
    caveat: { type: 'string' },
    seoTitle: { type: 'string' },
    metaDescription: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    uniquenessScore: { type: 'integer' },
    storyScore: { type: 'integer' },
    usefulnessScore: { type: 'integer' },
    giftabilityScore: { type: 'integer' },
  },
  required: [
    'headline',
    'teaser',
    'longDescription',
    'whyItStandsOut',
    'bestFor',
    'caveat',
    'seoTitle',
    'metaDescription',
    'tags',
    'uniquenessScore',
    'storyScore',
    'usefulnessScore',
    'giftabilityScore',
  ],
  additionalProperties: false,
} as const

export type ContentStyleIssue = {
  field: keyof EditorialContentPayload
  message: string
}

/**
 * Aanvullende Nederlandse stijlregels. Deze zijn adviserend: ze bepalen of
 * content handmatige review nodig heeft, niet of zij geldig is.
 */
export function checkContentStyle(payload: EditorialContentPayload): ContentStyleIssue[] {
  const issues: ContentStyleIssue[] = []
  const teaserWords = wordCount(payload.teaser)
  if (teaserWords < 45 || teaserWords > 70) {
    issues.push({ field: 'teaser', message: `teaser heeft ${teaserWords} woorden (richtlijn 45-70)` })
  }
  const longWords = wordCount(payload.longDescription)
  if (longWords < 120 || longWords > 220) {
    issues.push({
      field: 'longDescription',
      message: `longDescription heeft ${longWords} woorden (richtlijn 120-220)`,
    })
  }
  if (payload.headline.length > 75) {
    issues.push({ field: 'headline', message: 'headline langer dan 75 tekens' })
  }
  if (payload.seoTitle.length > 60) {
    issues.push({ field: 'seoTitle', message: 'seoTitle langer dan 60 tekens' })
  }
  if (payload.metaDescription.length > 155) {
    issues.push({ field: 'metaDescription', message: 'metaDescription langer dan 155 tekens' })
  }
  for (const field of ['headline', 'teaser', 'longDescription'] as const) {
    if (payload[field].includes('!')) {
      issues.push({ field, message: 'uitroeptekens passen niet bij de tone of voice' })
    }
    if (/\d+\s?%/.test(payload[field])) {
      issues.push({ field, message: 'kortingspercentages horen niet in redactionele tekst' })
    }
    if (/wij hebben (dit |deze )?getest|zelf getest/i.test(payload[field])) {
      issues.push({ field, message: 'niet beweren dat wij het product hebben getest' })
    }
  }
  return issues
}
