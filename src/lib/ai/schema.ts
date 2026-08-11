import { z } from 'zod'
import type { ExperienceType } from '@prisma/client'
import { looksDutch } from '@/lib/ai/language'
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

/** Tekstvelden die een bezoeker leest en die dus Nederlands moeten zijn. */
const prose = ['headline', 'teaser', 'longDescription', 'whyItStandsOut', 'caveat'] as const

const placeholderPattern =
  /(lorem ipsum|\bt\.?b\.?d\.?\b|\btodo\b|\bxxx\b|\[insert|\{\{|\}\}|<\/?[a-z][^>]*>|\bundefined\b|\bnull\b|\bn\/a\b)/i

export type ContentBlocker = {
  field: keyof EditorialContentPayload | 'content'
  message: string
}

/**
 * Formuleringen die eerstehandservaring suggereren. Deze mogen alleen in de
 * tekst staan wanneer de redactie het product echt heeft gebruikt
 * (`experienceType = HANDS_ON_TESTED`).
 */
const firstHandPatterns: readonly RegExp[] = [
  // "Wij hebben dit product zelf gebruikt", maar ook "wij hebben deze tafel getest".
  // "Gemeten" staat er bewust niet bij: prijzen meten is juist wat wij doen. De
  // lookahead op "niet" laat de eerlijke variant staan: "wij hebben dit product
  // niet zelf gebruikt" mag er juist wél in.
  /\bwij hebben\b(?![^.!?]*\bniet\b)[^.!?]{0,60}\b(getest|gebruikt|geprobeerd|uitgeprobeerd)\b/i,
  /(?<!niet )\bzelf (getest|gebruikt|geprobeerd|uitgeprobeerd)\b/i,
  /\bin (onze|mijn) (test|ervaring)\b/i,
  /\bonze (eigen )?(test|ervaring|bevindingen)\b/i,
  // "Wij vonden de rand te smal" is een oordeel; "wij vonden geen
  // vergelijkingsprijs" gaat over onze data en mag wel.
  /\bwij vonden (?!geen\b)/i,
  /\bwij (merkten|hoorden|voelden|ervoeren)\b/i,
  /\btijdens (ons|het) (gebruik|testen)\b/i,
  /\bna (een|twee|drie|enkele) (dag|dagen|week|weken|maand|maanden) gebruik\b/i,
]

/**
 * Blokkeert tekst die eigen ervaring suggereert zonder dat wij het product
 * hebben gebruikt. Dit is een harde regel: liever geen tekst dan een verzonnen
 * ervaring.
 */
export function findExperienceClaims(
  payload: EditorialContentPayload,
  experienceType: ExperienceType = 'NOT_TESTED',
): ContentBlocker[] {
  if (experienceType === 'HANDS_ON_TESTED') return []
  const blockers: ContentBlocker[] = []
  for (const field of prose) {
    if (firstHandPatterns.some((pattern) => pattern.test(payload[field]))) {
      blockers.push({
        field,
        message: `suggereert eigen ervaring, maar dit product is ${experienceType === 'DESK_RESEARCHED' ? 'alleen bureauonderzoek' : 'niet door ons getest'}`,
      })
    }
  }
  return blockers
}

/**
 * Harde kwaliteitspoort voor gegenereerde content. Anders dan
 * {@link checkContentStyle} is dit geen advies: wat hier wordt geblokkeerd komt
 * niet in de database en zet het product op `NEEDS_REVIEW`.
 *
 * Geblokkeerd wordt: lege of vulveldtekst, placeholders en HTML, tekst die niet
 * Nederlands is, gekopieerde velden, prijzen of kortingspercentages, dezelfde
 * zin die zich blijft herhalen, en eerstehandservaring die wij niet hebben.
 */
export function findContentBlockers(
  payload: EditorialContentPayload,
  options: { experienceType?: ExperienceType } = {},
): ContentBlocker[] {
  const blockers: ContentBlocker[] = []

  for (const field of prose) {
    const value = payload[field]
    if (value.trim().length === 0) {
      blockers.push({ field, message: 'veld is leeg' })
      continue
    }
    if (placeholderPattern.test(value)) {
      blockers.push({ field, message: 'bevat placeholder-, HTML- of vulveldtekst' })
    }
    if (!looksDutch(value)) {
      blockers.push({ field, message: 'tekst lijkt niet Nederlands' })
    }
    if (value === value.toUpperCase() && value.length > 12) {
      blockers.push({ field, message: 'volledig in hoofdletters' })
    }
    if (/€|\d+\s?%/.test(value)) {
      blockers.push({ field, message: 'prijzen en kortingspercentages horen niet in redactionele tekst' })
    }
  }

  if (payload.headline.trim() === payload.teaser.trim()) {
    blockers.push({ field: 'teaser', message: 'teaser is een kopie van de kop' })
  }
  if (payload.teaser.trim() === payload.longDescription.trim()) {
    blockers.push({ field: 'longDescription', message: 'beschrijving is een kopie van de teaser' })
  }

  // Eén zin die zich drie keer herhaalt is geen tekst maar vulling.
  const sentences = payload.longDescription
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence.length > 20)
  const counts = new Map<string, number>()
  for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) ?? 0) + 1)
  if ([...counts.values()].some((count) => count >= 3)) {
    blockers.push({ field: 'longDescription', message: 'dezelfde zin wordt herhaald' })
  }

  if (payload.bestFor.some((entry) => entry.trim().length === 0)) {
    blockers.push({ field: 'bestFor', message: 'lege waarde in bestFor' })
  }
  if (payload.tags.some((entry) => entry.trim().length === 0)) {
    blockers.push({ field: 'tags', message: 'lege waarde in tags' })
  }

  blockers.push(...findExperienceClaims(payload, options.experienceType))

  return blockers
}

export type ContentValidation =
  | { ok: true }
  | { ok: false; blockers: ContentBlocker[]; reasons: string[] }

/** Handige wrapper: `ok` plus leesbare redenen voor de log en het adminpaneel. */
export function validateEditorialContent(
  payload: EditorialContentPayload,
  options: { experienceType?: ExperienceType } = {},
): ContentValidation {
  const blockers = findContentBlockers(payload, options)
  if (blockers.length === 0) return { ok: true }
  return {
    ok: false,
    blockers,
    reasons: blockers.map((blocker) => `${blocker.field}: ${blocker.message}`),
  }
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
