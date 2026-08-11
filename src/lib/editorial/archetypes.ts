import type { EditorialPageType, SearchIntent } from '@prisma/client'

/**
 * Eisen per redactioneel archetype.
 *
 * Elk type heeft een eigen editor en een eigen rendertemplate, maar de regels
 * staan hier op één plek: zo kan de quality gate, de admin-editor en de
 * publieke template dezelfde eisen lezen zonder ze te herhalen.
 */
export type Archetype = {
  type: EditorialPageType
  /** Korte naam in de admin en in kruimelpaden. */
  label: string
  /** Wat dit type belooft aan de bezoeker; staat in de editor als hulptekst. */
  purpose: string
  /** Harde ondergrens aan het aantal geselecteerde producten. */
  minProducts: number
  /** Wat de redactie het beste aanhoudt; alleen advies. */
  preferredProducts: { min: number; max: number }
  /** Minimaal aantal echte vergelijkingscriteria; 0 betekent niet vereist. */
  minCriteria: number
  /** Is een methodologiesectie verplicht voor indexering? */
  requiresMethodology: boolean
  /** Moet er een budgetgrens zijn? */
  requiresBudget: boolean
  /** Vraagt dit type per product een aandachtspunt? */
  requiresPerProductCaveat: boolean
  /**
   * Mag dit type een objectieve "beste"-claim maken? Bij een collectie die
   * hoofdzakelijk over smaak gaat niet.
   */
  allowsBestClaim: boolean
  /** Vraagt dit type een vergelijkingstabel in de template? */
  showsComparisonTable: boolean
  /** Zoekintentie die het beste bij dit type past; alleen een voorstel. */
  defaultIntent: SearchIntent
}

export const archetypes: Record<EditorialPageType, Archetype> = {
  COMPARISON: {
    type: 'COMPARISON',
    label: 'Vergelijking',
    purpose:
      'Technische producten naast elkaar op criteria die uit brondata te controleren zijn: koffiemolens, robotstofzuigers, projectoren, ovens, deurbellen, gamingstoelen, tuinmachines.',
    minProducts: 3,
    preferredProducts: { min: 4, max: 6 },
    minCriteria: 4,
    requiresMethodology: true,
    requiresBudget: false,
    requiresPerProductCaveat: true,
    allowsBestClaim: true,
    showsComparisonTable: true,
    defaultIntent: 'COMMERCIAL_INVESTIGATION',
  },
  BEST_OF: {
    type: 'BEST_OF',
    label: 'Beste van',
    purpose: 'Een selectie binnen één productgroep, met per product een duidelijke doelgroep.',
    minProducts: 3,
    preferredProducts: { min: 5, max: 8 },
    minCriteria: 3,
    requiresMethodology: true,
    requiresBudget: false,
    requiresPerProductCaveat: true,
    allowsBestClaim: true,
    showsComparisonTable: true,
    defaultIntent: 'COMMERCIAL_INVESTIGATION',
  },
  BUDGET_GUIDE: {
    type: 'BUDGET_GUIDE',
    label: 'Budgetgids',
    purpose:
      'Wat er binnen een duidelijke prijsgrens wél en niet haalbaar is, met producten die werkelijk binnen die grens vallen.',
    minProducts: 3,
    preferredProducts: { min: 4, max: 8 },
    minCriteria: 3,
    requiresMethodology: true,
    requiresBudget: true,
    requiresPerProductCaveat: true,
    allowsBestClaim: true,
    showsComparisonTable: true,
    defaultIntent: 'COMMERCIAL_INVESTIGATION',
  },
  USE_CASE_GUIDE: {
    type: 'USE_CASE_GUIDE',
    label: 'Gids per gebruik',
    purpose: 'Eén concrete situatie, en welke eigenschap een product daarin bruikbaar maakt.',
    minProducts: 3,
    preferredProducts: { min: 4, max: 6 },
    minCriteria: 3,
    requiresMethodology: true,
    requiresBudget: false,
    requiresPerProductCaveat: true,
    allowsBestClaim: true,
    showsComparisonTable: true,
    defaultIntent: 'COMMERCIAL_INVESTIGATION',
  },
  GIFT_GUIDE: {
    type: 'GIFT_GUIDE',
    label: 'Cadeaugids',
    purpose:
      'Cadeaus binnen een prijsgrens, met leeftijdsindicatie van de fabrikant, interesse en of het direct speelbaar is.',
    minProducts: 4,
    preferredProducts: { min: 6, max: 12 },
    minCriteria: 2,
    requiresMethodology: false,
    requiresBudget: true,
    requiresPerProductCaveat: true,
    allowsBestClaim: false,
    showsComparisonTable: false,
    defaultIntent: 'INSPIRATIONAL',
  },
  DESIGN_COLLECTION: {
    type: 'DESIGN_COLLECTION',
    label: 'Designcollectie',
    purpose:
      'Banksets, fauteuils, verlichting, tafels en woonaccessoires op stijl, materiaal, afmetingen en ruimtegebruik. Smaak is geen ranglijst.',
    minProducts: 3,
    preferredProducts: { min: 5, max: 10 },
    minCriteria: 3,
    requiresMethodology: false,
    requiresBudget: false,
    requiresPerProductCaveat: true,
    // Bij stijl en smaak bestaat geen objectieve winnaar.
    allowsBestClaim: false,
    showsComparisonTable: true,
    defaultIntent: 'INSPIRATIONAL',
  },
  DEAL_COLLECTION: {
    type: 'DEAL_COLLECTION',
    label: 'Dealcollectie',
    purpose: 'Actuele prijsdalingen die wij zelf hebben gemeten, gebundeld rond één thema.',
    minProducts: 4,
    preferredProducts: { min: 6, max: 12 },
    minCriteria: 0,
    requiresMethodology: false,
    requiresBudget: false,
    requiresPerProductCaveat: false,
    allowsBestClaim: false,
    showsComparisonTable: false,
    defaultIntent: 'TRANSACTIONAL',
  },
  PROBLEM_SOLUTION: {
    type: 'PROBLEM_SOLUTION',
    label: 'Probleem en oplossing',
    purpose:
      'Eén concreet probleem — kattenharen, een kleine keuken, een gamekamer in de woonkamer — en welke eigenschap elk product daarvoor geschikt maakt.',
    minProducts: 3,
    preferredProducts: { min: 4, max: 6 },
    minCriteria: 3,
    requiresMethodology: true,
    requiresBudget: false,
    requiresPerProductCaveat: true,
    allowsBestClaim: true,
    showsComparisonTable: true,
    defaultIntent: 'INFORMATIONAL',
  },
  DISCOVERY_COLLECTION: {
    type: 'DISCOVERY_COLLECTION',
    label: 'Vondstencollectie',
    purpose:
      'Originele of deelbare producten die geen technische vergelijking nodig hebben: korte hook, doelgroep, toepassing en een aandachtspunt.',
    minProducts: 4,
    preferredProducts: { min: 6, max: 12 },
    minCriteria: 0,
    requiresMethodology: false,
    requiresBudget: false,
    requiresPerProductCaveat: true,
    allowsBestClaim: false,
    showsComparisonTable: false,
    defaultIntent: 'INSPIRATIONAL',
  },
}

export function archetypeFor(type: EditorialPageType): Archetype {
  return archetypes[type]
}

export const editorialPageTypes: readonly EditorialPageType[] = Object.keys(
  archetypes,
) as EditorialPageType[]

/** Nederlandse omschrijving van een zoekintentie, voor de admin en de bronsectie. */
export const searchIntentLabels: Record<SearchIntent, string> = {
  INFORMATIONAL: 'informatief: iemand wil eerst begrijpen',
  COMMERCIAL_INVESTIGATION: 'oriënterend: iemand vergelijkt voor een aankoop',
  TRANSACTIONAL: 'kopen: iemand wil nu beslissen',
  INSPIRATIONAL: 'inspiratie: iemand kijkt rond',
}
