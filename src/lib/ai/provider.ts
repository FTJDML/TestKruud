import type { ExperienceType, OpeningStyle } from '@prisma/client'
import type { EditorialContentPayload } from '@/lib/ai/schema'

export type { ExperienceType }

/** Waar een feit vandaan komt; gaat mee naar de bronsectie op de productpagina. */
export type DataSourceLabel =
  | 'merchant-feed'
  | 'merchant-api'
  | 'eigen-prijsmeting'
  | 'redactie'
  | 'demo-fixture'

/** Wat wij zelf over de prijs hebben gemeten. Nooit door AI berekend. */
export type PriceAnalysisFacts = {
  numberOfObservedPrices: number
  historyDays: number
  /** Klare zinnen uit `src/lib/analysis/statements.ts`. */
  statements: string[]
  hasPriceDrop: boolean
  numberOfComparedMerchants: number
  /** Verschil met de volgende aanbieder, in centen. */
  differenceToNextMerchantCents: number | null
}

/**
 * Gecontroleerde productfeiten die een provider mag gebruiken.
 *
 * Dit is de enige input voor redactionele tekst. Alles wat hier niet in staat,
 * mag niet in de tekst staan: geen verzonnen materialen, geen geluidsbeleving,
 * geen kwaliteitsoordeel en geen ervaring die wij niet hebben.
 */
export type ProductFacts = {
  title: string
  brand?: string | null
  model?: string | null
  primaryCategory: string
  /** Korte omschrijving zoals de aanbieder haar levert. */
  shortSourceDescription?: string | null
  /** Gecontroleerde specificaties uit brondata (sleutel/waarde). */
  specifications?: Record<string, string>
  merchantName: string
  /** Prijs in centen; alleen als context, nooit om korting te laten berekenen. */
  currentPriceCents: number
  isDemo: boolean
  /** Onze eigen prijsanalyse; alleen wat de data draagt. */
  priceAnalysis?: PriceAnalysisFacts | null
  /** Aantal aanbieders waarbij wij dit product volgen. */
  merchantCount?: number
  /** Waar de gegevens vandaan komen. */
  dataSources?: DataSourceLabel[]
  /** Wanneer wij de prijs voor het laatst hebben gecontroleerd. */
  lastCheckedAt?: Date | null
  /** Bekende voordelen uit brondata of redactie; nooit verzonnen. */
  knownPros?: string[]
  /** Bekende nadelen of aandachtspunten; nooit verzonnen. */
  knownCons?: string[]
  /** Titels van vergelijkbare producten die wij zelf volgen. */
  comparableAlternatives?: string[]
  /**
   * Hoe goed wij dit product kennen. Zonder `HANDS_ON_TESTED` mag de tekst geen
   * eerstehandservaring suggereren.
   */
  experienceType?: ExperienceType
  /** Stabiele sleutel (slug of id); bepaalt de deterministische stijlkeuze. */
  key?: string
  /** Openingsstijlen van de laatste publicaties, nieuwste eerst. */
  recentOpeningStyles?: OpeningStyle[]
  /** Hashes van recente openings- en slotzinnen; voorkomt herhaling. */
  recentOpeningHashes?: Array<{ openingHash: string | null; closingHash: string | null }>
  /** Gekozen openingsstijl; de provider houdt zich daaraan. */
  openingStyle?: OpeningStyle | null
  /** Mag deze tekst een informele opening krijgen? Ongeveer 15% van de teksten. */
  allowInformalOpening?: boolean
}

export type EditorialGenerationResult = {
  content: EditorialContentPayload
  provider: string
  promptVersion: string
  /** True wanneer de content door een mens beoordeeld moet worden. */
  needsReview: boolean
  warnings: string[]
  /** Model dat de tekst maakte; leeg bij een deterministische provider. */
  model?: string | null
  /** Korte opsomming van de feiten waarop de tekst zich baseert. */
  evidenceSummary?: string | null
  /** Gekozen openingsstijl en hashes van de eerste en laatste zin. */
  openingStyle?: OpeningStyle | null
  openingHash?: string | null
  closingHash?: string | null
  /** Versie van de stijlregels waaronder de tekst is geschreven. */
  styleVersion?: string | null
  /** Stijlbevindingen die de redactie nog kan opvolgen. */
  styleWarnings?: string[]
}

export type EditorialContentProvider = {
  readonly name: string
  readonly promptVersion: string
  generate(facts: ProductFacts): Promise<EditorialGenerationResult>
}

/** Mag de tekst spreken over eigen gebruik? Alleen na een echte test. */
export function mayClaimFirstHandExperience(facts: ProductFacts): boolean {
  return facts.experienceType === 'HANDS_ON_TESTED'
}

/**
 * Korte, leesbare samenvatting van de gebruikte feiten. Wordt bij de content
 * opgeslagen (`evidenceSummary`) zodat later te zien is waarop een tekst rust.
 */
export function buildEvidenceSummary(facts: ProductFacts): string {
  const parts: string[] = [`brontitel en categorie (${facts.primaryCategory})`]
  const specCount = Object.keys(facts.specifications ?? {}).length
  if (specCount > 0) parts.push(`${specCount} gecontroleerde specificatie(s)`)
  if (facts.shortSourceDescription) parts.push('omschrijving van de aanbieder')
  if (facts.priceAnalysis) {
    parts.push(
      `${facts.priceAnalysis.numberOfObservedPrices} eigen prijsmeting(en) over ${facts.priceAnalysis.historyDays} dag(en)`,
    )
  }
  if ((facts.merchantCount ?? 1) > 1) parts.push(`${facts.merchantCount} aanbieders vergeleken`)
  if ((facts.knownCons ?? []).length > 0) parts.push('bekend aandachtspunt uit brondata')
  parts.push(
    facts.experienceType === 'HANDS_ON_TESTED'
      ? 'zelf getest door de redactie'
      : facts.experienceType === 'DESK_RESEARCHED'
        ? 'bureauonderzoek, niet zelf getest'
        : 'niet zelf getest',
  )
  return parts.join('; ')
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
    experienceType: facts.experienceType ?? 'NOT_TESTED',
    // De prijs zelf hoort hier niet in: een prijswijziging vraagt geen nieuwe
    // tekst. Het aantal aanbieders wel, want dat staat in de tekst.
    merchantCount: facts.merchantCount ?? 1,
  })
  let hash = 0
  for (let index = 0; index < canonical.length; index += 1) {
    hash = (hash * 31 + canonical.charCodeAt(index)) | 0
  }
  return `f${(hash >>> 0).toString(36)}`
}
