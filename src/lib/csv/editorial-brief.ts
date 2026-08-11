import { z } from 'zod'
import { parseCsv } from '@/lib/scraping/csv'
import { editorialPageTypes } from '@/lib/editorial/archetypes'
import { toCents } from '@/lib/pricing/money'

/**
 * Editorial brief-import.
 *
 * Een brief is een opdracht aan de redactie, geen gepubliceerde pagina. De
 * import maakt dus altijd concepten aan (`DRAFT`, of `SCHEDULED` met een datum) —
 * nooit iets dat direct online staat. Er worden geen producten, prijzen of
 * feiten verzonnen: alleen de kolommen uit het bestand worden overgenomen.
 */
export const EDITORIAL_BRIEF_COLUMNS = [
  'pageType',
  'workingTitle',
  'primaryQuery',
  'searchIntent',
  'audience',
  'useCase',
  'budgetMin',
  'budgetMax',
  'selectedProductIds',
  'featuredProductId',
  'comparisonCriteria',
  'notes',
  'scheduledPublishAt',
] as const

/** Kant-en-klaar CSV-sjabloon met één voorbeeldregel als toelichting. */
export function editorialBriefTemplate(): string {
  const example = [
    'COMPARISON',
    'Koffiemolens voor thuis vergeleken',
    'welke koffiemolen voor thuis past bij mijn espressomachine',
    'COMMERCIAL_INVESTIGATION',
    'thuisbaristas met een espressomachine',
    'espresso zetten op een klein aanrecht',
    '',
    '500',
    'prod_1;prod_2;prod_3;prod_4',
    'prod_2',
    'maalgraden;bonenreservoir;geluidsniveau;afmetingen',
    'let op de doserlade bij de kleinste modellen',
    '2026-09-01',
  ]
  return `${EDITORIAL_BRIEF_COLUMNS.join(',')}\n${example.map(quote).join(',')}\n`
}

function quote(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Meerdere waarden in één cel: gescheiden door `;` of `|`. */
function list(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/[;|]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function optionalCents(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) return null
  return toCents(value.trim())
}

const briefSchema = z.object({
  pageType: z.enum(editorialPageTypes as [string, ...string[]]),
  workingTitle: z.string().min(10).max(160),
  primaryQuery: z.string().min(8).max(200),
  searchIntent: z
    .enum(['INFORMATIONAL', 'COMMERCIAL_INVESTIGATION', 'TRANSACTIONAL', 'INSPIRATIONAL'])
    .optional(),
  audience: z.string().max(200).optional(),
  useCase: z.string().max(300).optional(),
  budgetMinCents: z.number().int().positive().nullable(),
  budgetMaxCents: z.number().int().positive().nullable(),
  selectedProductIds: z.array(z.string().min(1)),
  featuredProductId: z.string().min(1).optional(),
  comparisonCriteria: z.array(z.string().min(1)),
  notes: z.string().max(1000).optional(),
  scheduledPublishAt: z.date().nullable(),
})

export type EditorialBrief = z.infer<typeof briefSchema>

export type BriefParseResult = {
  briefs: EditorialBrief[]
  /** Regels die niet zijn overgenomen, met de reden. */
  errors: Array<{ line: number; message: string }>
}

function parseDate(value: string | undefined): Date | null {
  if (!value || value.trim().length === 0) return null
  const date = new Date(value.trim())
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Leest een brief-CSV. Een onbruikbare regel wordt overgeslagen met een reden;
 * de rest van het bestand gaat gewoon door. Zo blijft een typefout in één regel
 * geen reden om honderd goede regels te weigeren.
 */
export function parseEditorialBriefs(csv: string): BriefParseResult {
  const rows = parseCsv(csv)
  const briefs: EditorialBrief[] = []
  const errors: Array<{ line: number; message: string }> = []

  rows.forEach((row, index) => {
    // +2: de kopregel plus de 1-gebaseerde nummering die een redacteur ziet.
    const line = index + 2
    const parsed = briefSchema.safeParse({
      pageType: (row.pageType ?? '').trim().toUpperCase(),
      workingTitle: (row.workingTitle ?? '').trim(),
      primaryQuery: (row.primaryQuery ?? '').trim(),
      searchIntent: (row.searchIntent ?? '').trim().toUpperCase() || undefined,
      audience: (row.audience ?? '').trim() || undefined,
      useCase: (row.useCase ?? '').trim() || undefined,
      budgetMinCents: optionalCents(row.budgetMin),
      budgetMaxCents: optionalCents(row.budgetMax),
      selectedProductIds: list(row.selectedProductIds),
      featuredProductId: (row.featuredProductId ?? '').trim() || undefined,
      comparisonCriteria: list(row.comparisonCriteria),
      notes: (row.notes ?? '').trim() || undefined,
      scheduledPublishAt: parseDate(row.scheduledPublishAt),
    })

    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      })
      return
    }

    const brief = parsed.data
    if (
      brief.featuredProductId &&
      brief.selectedProductIds.length > 0 &&
      !brief.selectedProductIds.includes(brief.featuredProductId)
    ) {
      errors.push({ line, message: 'featuredProductId staat niet in selectedProductIds' })
      return
    }
    if (
      brief.budgetMinCents !== null &&
      brief.budgetMaxCents !== null &&
      brief.budgetMinCents > brief.budgetMaxCents
    ) {
      errors.push({ line, message: 'budgetMin is hoger dan budgetMax' })
      return
    }

    briefs.push(brief)
  })

  return { briefs, errors }
}

/** Slug uit een werktitel; blijft leesbaar en uniek te maken met een suffix. */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
