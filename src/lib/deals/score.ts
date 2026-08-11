import { clamp } from '@/lib/utils'

/**
 * Samengestelde selectiescore. Eén centrale module, bewust puur en unit-testbaar.
 * Alle deelscores lopen van 0 tot 100; het resultaat ook.
 */
export const scoreWeights = {
  uniqueness: 0.2,
  story: 0.15,
  usefulness: 0.15,
  giftability: 0.1,
  discountQuality: 0.2,
  freshness: 0.1,
  visualQuality: 0.05,
  merchantTrust: 0.05,
} as const

export type ScoreWeights = typeof scoreWeights

export type ScoreInput = {
  uniquenessScore: number
  storyScore: number
  usefulnessScore: number
  giftabilityScore: number
  /** Kortingspercentage uit de prijsmodule (nooit uit AI). */
  discountPercentage: number | null
  /** Of er een geldige, getypeerde referentieprijs is. */
  hasValidReferencePrice: boolean
  /** Wanneer het product bij ons is ontdekt. */
  discoveredAt: Date
  /** Wanneer de aanbieding voor het laatst is gecontroleerd. */
  checkedAt: Date
  /** Laatste door ons gemeten prijswijziging (uit DealAnalysis). */
  lastPriceChangeAt?: Date | null
  /** Moment waarop een prijsdaling is gedetecteerd (uit DealAnalysis). */
  dealDetectedAt?: Date | null
  visualQualityScore: number
  merchantTrustScore: number
}

export type ScoreBreakdown = {
  total: number
  parts: Record<keyof ScoreWeights, number>
}

/**
 * Kortingskwaliteit: geen geldige referentieprijs betekent 0. Daarna loopt de
 * score op tot 40% korting; hoger dan dat levert geen extra punten op, zodat
 * onwaarschijnlijk hoge "kortingen" niet automatisch de editie domineren.
 */
export function discountQualityScore(
  discountPercentage: number | null,
  hasValidReferencePrice: boolean,
): number {
  if (!hasValidReferencePrice || discountPercentage === null || discountPercentage <= 0) return 0
  return clamp(Math.round((Math.min(discountPercentage, 40) / 40) * 100), 0, 100)
}

/**
 * Versheid. Drie signalen, in deze volgorde van belang:
 *
 * 1. een verse, door ons gemeten prijsdaling (`dealDetectedAt`);
 * 2. een recente prijswijziging in het algemeen (`lastPriceChangeAt`);
 * 3. hoe lang wij het product al kennen en hoe recent wij de prijs zagen.
 *
 * Zo kan een product dat wij al maanden volgen opnieuw bovenaan komen zodra de
 * prijs echt daalt — precies wat een dealsite hoort te doen.
 */
export function freshnessScore(
  input: {
    discoveredAt: Date
    checkedAt: Date
    lastPriceChangeAt?: Date | null
    dealDetectedAt?: Date | null
  },
  now: Date = new Date(),
): number {
  const discoveryDays = (now.getTime() - input.discoveredAt.getTime()) / 86_400_000
  const discoveryPart = clamp(100 - discoveryDays * 5, 0, 100)
  const checkHours = (now.getTime() - input.checkedAt.getTime()) / 3_600_000
  const checkPart = clamp(100 - checkHours * 4, 0, 100)
  const basis = discoveryPart * 0.6 + checkPart * 0.4

  const priceEvent = input.dealDetectedAt ?? input.lastPriceChangeAt ?? null
  if (!priceEvent) return Math.round(basis)

  // Een prijsdaling van vandaag geeft 100; het effect zakt over zeven dagen weg.
  const eventDays = (now.getTime() - priceEvent.getTime()) / 86_400_000
  const eventPart = clamp(100 - eventDays * (100 / 7), 0, 100)
  // Een verse prijsdaling weegt zwaarder dan een gewone prijswijziging.
  const weight = input.dealDetectedAt ? 0.75 : 0.5
  return Math.round(Math.max(basis, basis * (1 - weight) + eventPart * weight))
}

export function compositeScore(input: ScoreInput, now: Date = new Date()): ScoreBreakdown {
  const parts: Record<keyof ScoreWeights, number> = {
    uniqueness: clamp(input.uniquenessScore, 0, 100),
    story: clamp(input.storyScore, 0, 100),
    usefulness: clamp(input.usefulnessScore, 0, 100),
    giftability: clamp(input.giftabilityScore, 0, 100),
    discountQuality: discountQualityScore(input.discountPercentage, input.hasValidReferencePrice),
    freshness: freshnessScore(
      {
        discoveredAt: input.discoveredAt,
        checkedAt: input.checkedAt,
        lastPriceChangeAt: input.lastPriceChangeAt,
        dealDetectedAt: input.dealDetectedAt,
      },
      now,
    ),
    visualQuality: clamp(input.visualQualityScore, 0, 100),
    merchantTrust: clamp(input.merchantTrustScore, 0, 100),
  }

  const total = (Object.keys(scoreWeights) as Array<keyof ScoreWeights>).reduce(
    (sum, key) => sum + parts[key] * scoreWeights[key],
    0,
  )

  return { total: Math.round(total * 100) / 100, parts }
}

/** Redactionele score zonder prijscomponent; gebruikt voor "Redactiefavorieten". */
export function editorialScore(input: {
  uniquenessScore: number
  storyScore: number
  usefulnessScore: number
  giftabilityScore: number
}): number {
  const total =
    clamp(input.uniquenessScore, 0, 100) * 0.35 +
    clamp(input.storyScore, 0, 100) * 0.25 +
    clamp(input.usefulnessScore, 0, 100) * 0.25 +
    clamp(input.giftabilityScore, 0, 100) * 0.15
  return Math.round(total * 100) / 100
}
