import type { EditorialContentPayload } from '@/lib/ai/schema'

/** Gecontroleerde productfeiten die een provider mag gebruiken. */
export type ProductFacts = {
  title: string
  brand?: string | null
  model?: string | null
  primaryCategory: string
  /** Korte omschrijving zoals de aanbieder haar levert. */
  shortSourceDescription?: string | null
  /** Losse specificaties uit brondata (sleutel/waarde). */
  specifications?: Record<string, string>
  merchantName: string
  /** Prijs in centen; alleen als context, nooit om korting te laten berekenen. */
  currentPriceCents: number
  isDemo: boolean
}

export type EditorialGenerationResult = {
  content: EditorialContentPayload
  provider: string
  promptVersion: string
  /** True wanneer de content door een mens beoordeeld moet worden. */
  needsReview: boolean
  warnings: string[]
}

export type EditorialContentProvider = {
  readonly name: string
  readonly promptVersion: string
  generate(facts: ProductFacts): Promise<EditorialGenerationResult>
}

/** Stabiele hash van de productfeiten; bepaalt of hergenereren nodig is. */
export function factsFingerprint(facts: ProductFacts): string {
  const canonical = JSON.stringify({
    title: facts.title,
    brand: facts.brand ?? null,
    model: facts.model ?? null,
    category: facts.primaryCategory,
    description: facts.shortSourceDescription ?? null,
    specifications: Object.entries(facts.specifications ?? {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  })
  let hash = 0
  for (let index = 0; index < canonical.length; index += 1) {
    hash = (hash * 31 + canonical.charCodeAt(index)) | 0
  }
  return `f${(hash >>> 0).toString(36)}`
}
