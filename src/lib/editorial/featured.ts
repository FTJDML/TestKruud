import type { EditorialPageType } from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'

/**
 * Labels voor het uitgelichte product.
 *
 * Een label benoemt altijd een doelgroep, use case of grens — niet een
 * algemene rangorde. "Beste overall" staat er wel tussen, maar mag alleen bij
 * een archetype dat een objectieve claim ondersteunt én met een methodologie:
 * dat wordt hieronder afgedwongen.
 */
export const featuredLabels = [
  'Onze opvallendste keuze',
  'Beste voor kleine keukens',
  'Beste voor design',
  'Beste binnen dit budget',
  'Beste voor beginners',
  'Meest complete keuze',
  'Beste overall',
] as const

export type FeaturedLabel = (typeof featuredLabels)[number]

/** Labels die een objectieve rangorde claimen. */
const objectiveClaimLabels: readonly string[] = ['Beste overall', 'Meest complete keuze']

export type FeaturedInput = {
  pageType: EditorialPageType
  productId: string | null
  label: string | null
  /** Waarom dit product; moet naar controleerbare criteria verwijzen. */
  reason: string | null
  /** Minimaal één aandachtspunt. */
  caveat: string | null
  /** Wanneer een alternatief geschikter is. */
  alternativeNote: string | null
  /** Aantal gecontroleerde criteriumwaarden van dit product op deze pagina. */
  verifiedCriteriaCount: number
  /** Is er een doelgroep of use case benoemd? */
  hasAudienceOrUseCase: boolean
  hasMethodology: boolean
  /** Staan er alternatieven op de pagina? */
  alternativeCount: number
}

export type FeaturedProblem = { field: string; message: string }

/**
 * Controleert de regels rond het uitgelichte product. Een affiliateproduct mag
 * uitgelicht worden, maar de aanbeveling moet aan controleerbare criteria
 * hangen — commissie speelt in deze controle en in de score geen enkele rol
 * (zie {@link ../editorial/ranking}).
 */
export function checkFeaturedProduct(input: FeaturedInput): FeaturedProblem[] {
  if (!input.productId) return []

  const archetype = archetypeFor(input.pageType)
  const problems: FeaturedProblem[] = []

  if (!input.label || input.label.trim().length === 0) {
    problems.push({ field: 'featuredLabel', message: 'kies een label voor de uitgelichte keuze' })
  }
  if (!input.reason || input.reason.trim().length < 20) {
    problems.push({
      field: 'featuredReason',
      message: 'leg uit waarom dit product uitgelicht is, gekoppeld aan de vergelijkingscriteria',
    })
  }
  if (!input.caveat || input.caveat.trim().length < 10) {
    problems.push({ field: 'featuredCaveat', message: 'benoem minimaal één aandachtspunt' })
  }
  if (!input.hasAudienceOrUseCase) {
    problems.push({
      field: 'featuredReason',
      message: 'benoem voor welke doelgroep of use case dit de beste keuze is',
    })
  }
  if (input.alternativeCount > 0 && !input.alternativeNote) {
    problems.push({
      field: 'featuredAlternativeNote',
      message: 'benoem wanneer een van de alternatieven geschikter is',
    })
  }
  if (archetype.minCriteria > 0 && input.verifiedCriteriaCount < 2) {
    problems.push({
      field: 'featuredProductId',
      message: 'een uitgelichte keuze vraagt minimaal twee gecontroleerde criteriumwaarden',
    })
  }

  const label = input.label?.trim() ?? ''
  if (objectiveClaimLabels.includes(label)) {
    if (!archetype.allowsBestClaim) {
      problems.push({
        field: 'featuredLabel',
        message: `"${label}" past niet bij ${archetype.label.toLowerCase()}: hier gaat het vooral om smaak`,
      })
    } else if (!input.hasMethodology) {
      problems.push({
        field: 'featuredLabel',
        message: `"${label}" mag alleen wanneer de methodologie die claim onderbouwt`,
      })
    }
  }

  return problems
}

/** Labels die bij dit archetype gekozen mogen worden. */
export function labelsForType(type: EditorialPageType): readonly string[] {
  const archetype = archetypeFor(type)
  return archetype.allowsBestClaim
    ? featuredLabels
    : featuredLabels.filter((label) => !objectiveClaimLabels.includes(label))
}
