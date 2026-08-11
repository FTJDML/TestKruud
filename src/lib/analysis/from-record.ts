import type { ConfidenceLevel } from '@prisma/client'
import { toCents } from '@/lib/pricing/money'
import type { ComparisonBasis, PriceAnalysis } from '@/lib/analysis/price-analysis'

/**
 * Zet een `DealAnalysis`-rij uit de database om in het object waarmee de rest
 * van de applicatie rekent (centen, geen Decimal). Zo gebruiken de productpagina,
 * de contentgeneratie en de tests exact dezelfde vorm.
 */
export type DealAnalysisRecord = {
  currency: string
  currentPrice: { toString(): string }
  previousObservedPrice: { toString(): string } | null
  lowestPrice30Days: { toString(): string } | null
  medianPrice90Days: { toString(): string } | null
  lowestPriceAllTime: { toString(): string } | null
  highestPrice90Days: { toString(): string } | null
  priceChangeAmount: { toString(): string } | null
  priceChangePercentage: number | null
  numberOfObservedPrices: number
  numberOfComparedMerchants: number
  cheapestMerchantId: string | null
  nextCheapestPrice: { toString(): string } | null
  differenceToNextMerchant: { toString(): string } | null
  firstSeenAt: Date | null
  lastSeenAt: Date | null
  lastPriceChangeAt: Date | null
  dealDetectedAt: Date | null
  calculatedAt: Date
  confidenceLevel: ConfidenceLevel
  analysisVersion: string
  historyDays: number
}

function cents(value: { toString(): string } | null): number | null {
  return value === null ? null : toCents(value.toString())
}

export function analysisFromRecord(
  record: DealAnalysisRecord,
  comparisonBasis: ComparisonBasis = 'prijs',
): PriceAnalysis {
  return {
    analysisVersion: record.analysisVersion,
    calculatedAt: record.calculatedAt,
    currentPriceCents: cents(record.currentPrice) ?? 0,
    previousObservedPriceCents: cents(record.previousObservedPrice),
    lowestPrice30DaysCents: cents(record.lowestPrice30Days),
    medianPrice90DaysCents: cents(record.medianPrice90Days),
    lowestPriceAllTimeCents: cents(record.lowestPriceAllTime),
    highestPrice90DaysCents: cents(record.highestPrice90Days),
    priceChangeAmountCents: cents(record.priceChangeAmount),
    priceChangePercentage: record.priceChangePercentage,
    numberOfObservedPrices: record.numberOfObservedPrices,
    numberOfComparedMerchants: record.numberOfComparedMerchants,
    cheapestMerchantId: record.cheapestMerchantId,
    nextCheapestPriceCents: cents(record.nextCheapestPrice),
    differenceToNextMerchantCents: cents(record.differenceToNextMerchant),
    comparisonBasis,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    lastPriceChangeAt: record.lastPriceChangeAt,
    dealDetectedAt: record.dealDetectedAt,
    historyDays: record.historyDays,
    confidenceLevel: record.confidenceLevel,
  }
}
