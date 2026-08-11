import type { ConfidenceLevel } from '@prisma/client'

/**
 * Eigen prijsanalyse. Volledig gewone, deterministische code op basis van
 * `PriceSnapshot`-metingen: AI berekent hier niets en interpreteert hier niets.
 *
 * De harde regel is: een claim mag alleen als de data haar draagt. Zonder dertig
 * dagen historie bestaat er geen dertigdagenclaim, en zonder genoeg meetpunten
 * bestaat er geen mediaan.
 */
export const ANALYSIS_VERSION = 'analysis-2026-08-1'

const DAY_MS = 24 * 60 * 60 * 1000

/** Minimaal aantal metingen voordat wij iets over een reeks durven zeggen. */
export const MIN_OBSERVATIONS = 3
/** Extra eis voor de 90-dagenmediaan: een mediaan van drie punten zegt weinig. */
export const MIN_OBSERVATIONS_FOR_MEDIAN = 5

export type PriceObservation = {
  priceCents: number
  capturedAt: Date
  inStock: boolean
}

export type MerchantOffer = {
  merchantId: string
  priceCents: number
  /** Alleen bekend wanneer de bron verzendkosten betrouwbaar meelevert. */
  shippingCents: number | null
  isActive: boolean
}

/** Waarop de merchantvergelijking is gebaseerd; bepaalt wat wij mogen beweren. */
export type ComparisonBasis = 'prijs' | 'prijs-en-verzending'

export type PriceAnalysis = {
  analysisVersion: string
  calculatedAt: Date
  currentPriceCents: number
  previousObservedPriceCents: number | null
  lowestPrice30DaysCents: number | null
  medianPrice90DaysCents: number | null
  lowestPriceAllTimeCents: number | null
  highestPrice90DaysCents: number | null
  priceChangeAmountCents: number | null
  priceChangePercentage: number | null
  numberOfObservedPrices: number
  numberOfComparedMerchants: number
  cheapestMerchantId: string | null
  nextCheapestPriceCents: number | null
  differenceToNextMerchantCents: number | null
  comparisonBasis: ComparisonBasis
  firstSeenAt: Date | null
  lastSeenAt: Date | null
  lastPriceChangeAt: Date | null
  /** Moment waarop de huidige, lagere prijs voor het eerst is gemeten. */
  dealDetectedAt: Date | null
  historyDays: number
  confidenceLevel: ConfidenceLevel
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]!
  return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

function withinDays(
  observations: readonly PriceObservation[],
  now: Date,
  days: number,
): PriceObservation[] {
  const threshold = now.getTime() - days * DAY_MS
  return observations.filter((observation) => observation.capturedAt.getTime() >= threshold)
}

function confidenceFor(observations: number, historyDays: number): ConfidenceLevel {
  if (observations >= 10 && historyDays >= 30) return 'HIGH'
  if (observations >= MIN_OBSERVATIONS_FOR_MEDIAN) return 'MEDIUM'
  return 'LOW'
}

function comparisonFor(offers: readonly MerchantOffer[]): {
  numberOfComparedMerchants: number
  cheapestMerchantId: string | null
  nextCheapestPriceCents: number | null
  differenceToNextMerchantCents: number | null
  comparisonBasis: ComparisonBasis
} {
  const active = offers.filter((offer) => offer.isActive && offer.priceCents > 0)
  // Verzendkosten alleen meenemen wanneer élke vergeleken aanbieding ze kent;
  // anders vergelijken wij appels met peren.
  const basis: ComparisonBasis =
    active.length > 0 && active.every((offer) => offer.shippingCents !== null)
      ? 'prijs-en-verzending'
      : 'prijs'
  const total = (offer: MerchantOffer) =>
    basis === 'prijs-en-verzending' ? offer.priceCents + (offer.shippingCents ?? 0) : offer.priceCents

  // Eén prijs per merchant: de goedkoopste die de merchant zelf biedt.
  const perMerchant = new Map<string, number>()
  for (const offer of active) {
    const value = total(offer)
    const current = perMerchant.get(offer.merchantId)
    if (current === undefined || value < current) perMerchant.set(offer.merchantId, value)
  }

  const ranked = [...perMerchant.entries()].sort(([, left], [, right]) => left - right)
  const cheapest = ranked[0]
  const next = ranked[1]

  return {
    numberOfComparedMerchants: ranked.length,
    cheapestMerchantId: cheapest?.[0] ?? null,
    nextCheapestPriceCents: next?.[1] ?? null,
    differenceToNextMerchantCents:
      cheapest && next ? next[1] - cheapest[1] : null,
    comparisonBasis: basis,
  }
}

/**
 * Berekent de analyse. `observations` mag in willekeurige volgorde staan en
 * wordt hier gesorteerd; `now` is verplicht meegegeven zodat de uitkomst
 * deterministisch en testbaar is.
 */
export function analysePrices(input: {
  currentPriceCents: number
  observations: readonly PriceObservation[]
  offers?: readonly MerchantOffer[]
  now: Date
}): PriceAnalysis {
  const sorted = [...input.observations]
    .filter((observation) => observation.priceCents > 0)
    .sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime())

  const first = sorted[0] ?? null
  const last = sorted.at(-1) ?? null
  const historyDays =
    first && last ? Math.floor((last.capturedAt.getTime() - first.capturedAt.getTime()) / DAY_MS) : 0

  // De vorige gemeten prijs is de laatste meting met een andere prijs dan nu.
  let previousObservedPriceCents: number | null = null
  let lastPriceChangeAt: Date | null = null
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const observation = sorted[index]!
    if (observation.priceCents !== input.currentPriceCents) {
      previousObservedPriceCents = observation.priceCents
      // De wijziging is zichtbaar geworden bij de eerstvolgende meting.
      lastPriceChangeAt = sorted[index + 1]?.capturedAt ?? null
      break
    }
  }
  // Geen andere prijs gemeten, maar wel meerdere metingen: prijs is stabiel.
  if (previousObservedPriceCents === null && sorted.length > 0) {
    lastPriceChangeAt = null
  }

  const priceChangeAmountCents =
    previousObservedPriceCents === null ? null : input.currentPriceCents - previousObservedPriceCents
  const priceChangePercentage =
    previousObservedPriceCents === null || previousObservedPriceCents === 0 || priceChangeAmountCents === null
      ? null
      : Math.round((priceChangeAmountCents / previousObservedPriceCents) * 1000) / 10

  const enough = sorted.length >= MIN_OBSERVATIONS

  const window30 = withinDays(sorted, input.now, 30)
  // Alleen een dertigdagenclaim wanneer er ook dertig dagen historie is.
  const has30Days = historyDays >= 30 && window30.length >= MIN_OBSERVATIONS
  const lowestPrice30DaysCents = has30Days
    ? Math.min(...window30.map((observation) => observation.priceCents))
    : null

  const window90 = withinDays(sorted, input.now, 90)
  const has90Days = historyDays >= 90 && window90.length >= MIN_OBSERVATIONS_FOR_MEDIAN
  const medianPrice90DaysCents = has90Days
    ? median(window90.map((observation) => observation.priceCents))
    : null
  const highestPrice90DaysCents = has90Days
    ? Math.max(...window90.map((observation) => observation.priceCents))
    : null

  const lowestPriceAllTimeCents = enough
    ? Math.min(...sorted.map((observation) => observation.priceCents))
    : null

  // Een prijsdaling is "gedetecteerd" op het moment dat de lagere prijs voor het
  // eerst is gemeten.
  const dealDetectedAt =
    priceChangeAmountCents !== null && priceChangeAmountCents < 0 ? lastPriceChangeAt : null

  return {
    analysisVersion: ANALYSIS_VERSION,
    calculatedAt: input.now,
    currentPriceCents: input.currentPriceCents,
    previousObservedPriceCents,
    lowestPrice30DaysCents,
    medianPrice90DaysCents,
    lowestPriceAllTimeCents,
    highestPrice90DaysCents,
    priceChangeAmountCents,
    priceChangePercentage,
    numberOfObservedPrices: sorted.length,
    firstSeenAt: first?.capturedAt ?? null,
    lastSeenAt: last?.capturedAt ?? null,
    lastPriceChangeAt,
    dealDetectedAt,
    historyDays,
    confidenceLevel: confidenceFor(sorted.length, historyDays),
    ...comparisonFor(input.offers ?? []),
  }
}
