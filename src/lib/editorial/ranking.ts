/**
 * Redactionele rangorde binnen één vergelijking.
 *
 * De score gebruikt uitsluitend gecontroleerde criteriumwaarden en onze eigen
 * prijsmeting. Er is bewust **geen** veld voor commissie, netwerk, merchant of
 * affiliatevergoeding: die gegevens komen deze functie niet binnen, dus zij
 * kunnen de uitkomst ook niet beïnvloeden. Dat is met een test vastgelegd.
 */
export type RankingCriterionValue = {
  criterionName: string
  /** Genormaliseerde numerieke waarde; null wanneer niet te vergelijken. */
  numericValue: number | null
  /** Null wanneer "hoger" bij dit criterium niets betekent. */
  higherIsBetter: boolean | null
  verified: boolean
}

export type RankingInput = {
  productId: string
  values: readonly RankingCriterionValue[]
  /** Huidige prijs in centen; alleen om binnen een budget te wegen. */
  currentPriceCents: number | null
  /** Onze eigen betrouwbaarheid van de prijsanalyse. */
  priceConfidence: 'LOW' | 'MEDIUM' | 'HIGH' | null
}

export type RankingResult = {
  productId: string
  /** 0-100; alleen bedoeld om de redactie een startvolgorde te geven. */
  score: number
  /** Hoeveel criteria daadwerkelijk zijn gecontroleerd. */
  verifiedCriteria: number
  comparableCriteria: number
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Zet per criterium de beste waarde op 100 en de slechtste op 0, en telt daarna
 * het gemiddelde. Criteria zonder richting (`higherIsBetter = null`) en
 * ongecontroleerde waarden tellen niet mee: een onbekende waarde mag geen
 * voordeel én geen nadeel opleveren.
 */
export function rankProducts(products: readonly RankingInput[]): RankingResult[] {
  const criteria = new Map<string, { min: number; max: number; higherIsBetter: boolean }>()
  for (const product of products) {
    for (const value of product.values) {
      if (!value.verified || value.numericValue === null || value.higherIsBetter === null) continue
      const current = criteria.get(value.criterionName)
      if (!current) {
        criteria.set(value.criterionName, {
          min: value.numericValue,
          max: value.numericValue,
          higherIsBetter: value.higherIsBetter,
        })
        continue
      }
      current.min = Math.min(current.min, value.numericValue)
      current.max = Math.max(current.max, value.numericValue)
    }
  }

  return products
    .map((product) => {
      const scores: number[] = []
      let verifiedCriteria = 0
      for (const value of product.values) {
        if (value.verified) verifiedCriteria += 1
        if (!value.verified || value.numericValue === null || value.higherIsBetter === null) continue
        const range = criteria.get(value.criterionName)
        if (!range) continue
        const span = range.max - range.min
        // Zonder spreiding is dit criterium niet onderscheidend.
        const normalized = span === 0 ? 50 : ((value.numericValue - range.min) / span) * 100
        scores.push(range.higherIsBetter ? normalized : 100 - normalized)
      }

      const base = scores.length > 0 ? scores.reduce((sum, entry) => sum + entry, 0) / scores.length : 0
      // Een goed onderbouwd product krijgt een klein voordeel: meer gecontroleerde
      // feiten betekent een betrouwbaarder oordeel, niet een beter product.
      const evidenceBonus = Math.min(10, verifiedCriteria * 2)
      const confidenceBonus =
        product.priceConfidence === 'HIGH' ? 5 : product.priceConfidence === 'MEDIUM' ? 2 : 0

      return {
        productId: product.productId,
        score: Math.round(clamp(base + evidenceBonus + confidenceBonus)),
        verifiedCriteria,
        comparableCriteria: scores.length,
      }
    })
    .sort((left, right) =>
      right.score !== left.score
        ? right.score - left.score
        : left.productId.localeCompare(right.productId),
    )
}

/**
 * Leest een criteriumwaarde als getal. Tekst als "1,4 kg" of "€ 249" levert
 * 1.4 respectievelijk 249; onleesbare tekst levert null in plaats van een gok.
 */
export function numericFromValue(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) return null
  if (trimmed === 'ja' || trimmed === 'true') return 1
  if (trimmed === 'nee' || trimmed === 'false') return 0
  const match = trimmed.match(/-?\d+(?:[.,]\d+)?/)
  if (!match) return null
  const parsed = Number.parseFloat(match[0].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
