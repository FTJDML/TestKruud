import { describe, expect, it } from 'vitest'
import {
  analysePrices,
  ANALYSIS_VERSION,
  MIN_OBSERVATIONS,
  type PriceObservation,
} from '@/lib/analysis/price-analysis'
import { priceStatements } from '@/lib/analysis/statements'

const now = new Date('2026-08-11T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

/** Metingen op vaste dagafstanden; index 0 is het oudst. */
function series(prices: readonly number[], startDaysAgo: number, stepDays = 1): PriceObservation[] {
  return prices.map((priceCents, index) => ({
    priceCents,
    capturedAt: new Date(now.getTime() - (startDaysAgo - index * stepDays) * DAY),
    inStock: true,
  }))
}

describe('prijsanalyse', () => {
  it('stelt niets vast met te weinig metingen', () => {
    const analysis = analysePrices({
      currentPriceCents: 29_900,
      observations: series([29_900, 29_900], 2),
      now,
    })
    expect(analysis.numberOfObservedPrices).toBe(2)
    expect(analysis.numberOfObservedPrices).toBeLessThan(MIN_OBSERVATIONS)
    expect(analysis.lowestPriceAllTimeCents).toBeNull()
    expect(analysis.lowestPrice30DaysCents).toBeNull()
    expect(analysis.medianPrice90DaysCents).toBeNull()
    expect(analysis.confidenceLevel).toBe('LOW')
  })

  it('doet geen 30-dagenclaim zonder 30 dagen historie', () => {
    const analysis = analysePrices({
      currentPriceCents: 24_900,
      // Tien metingen, maar pas tien dagen historie.
      observations: series([29_900, 29_900, 28_900, 28_900, 27_900, 27_900, 26_900, 25_900, 24_900, 24_900], 10),
      now,
    })
    expect(analysis.historyDays).toBeLessThan(30)
    expect(analysis.lowestPrice30DaysCents).toBeNull()
    expect(analysis.medianPrice90DaysCents).toBeNull()
    // Wat wél kan: de laagste prijs die wij ooit zagen.
    expect(analysis.lowestPriceAllTimeCents).toBe(24_900)
  })

  it('berekent de laagste prijs in 30 dagen met genoeg historie', () => {
    const prices = Array.from({ length: 40 }, (_, index) => (index === 30 ? 19_900 : 29_900))
    const analysis = analysePrices({
      currentPriceCents: 29_900,
      observations: series(prices, 39),
      now,
    })
    expect(analysis.historyDays).toBe(39)
    expect(analysis.lowestPrice30DaysCents).toBe(19_900)
  })

  it('berekent de mediaan over 90 dagen met genoeg historie', () => {
    // 100 dagen, prijzen 100..199 euro; de mediaan van die reeks is bekend.
    const prices = Array.from({ length: 100 }, (_, index) => 10_000 + index * 100)
    const analysis = analysePrices({
      currentPriceCents: prices.at(-1)!,
      observations: series(prices, 99),
      now,
    })
    expect(analysis.historyDays).toBe(99)
    // Alleen de laatste 90 dagen tellen mee: 91 metingen van € 109 tot € 199,
    // dus de mediaan is € 154.
    expect(analysis.medianPrice90DaysCents).toBe(15_400)
    expect(analysis.highestPrice90DaysCents).toBe(19_900)
    expect(analysis.confidenceLevel).toBe('HIGH')
  })

  it('herkent een nieuwe prijsdaling met datum en percentage', () => {
    const observations = series([29_900, 29_900, 29_900, 24_900], 3)
    const analysis = analysePrices({ currentPriceCents: 24_900, observations, now })
    expect(analysis.previousObservedPriceCents).toBe(29_900)
    expect(analysis.priceChangeAmountCents).toBe(-5_000)
    expect(analysis.priceChangePercentage).toBeCloseTo(-16.7, 1)
    expect(analysis.lastPriceChangeAt).toEqual(observations.at(-1)?.capturedAt)
    expect(analysis.dealDetectedAt).toEqual(observations.at(-1)?.capturedAt)
  })

  it('meldt geen prijswijziging bij een stabiele prijs', () => {
    const analysis = analysePrices({
      currentPriceCents: 29_900,
      observations: series([29_900, 29_900, 29_900, 29_900], 3),
      now,
    })
    expect(analysis.priceChangeAmountCents).toBeNull()
    expect(analysis.lastPriceChangeAt).toBeNull()
    expect(analysis.dealDetectedAt).toBeNull()
  })

  it('vergelijkt aanbieders en neemt verzendkosten alleen mee als ze bekend zijn', () => {
    const withoutShipping = analysePrices({
      currentPriceCents: 10_000,
      observations: series([10_000, 10_000, 10_000], 2),
      offers: [
        { merchantId: 'a', priceCents: 10_000, shippingCents: null, isActive: true },
        { merchantId: 'b', priceCents: 12_000, shippingCents: 500, isActive: true },
      ],
      now,
    })
    expect(withoutShipping.comparisonBasis).toBe('prijs')
    expect(withoutShipping.cheapestMerchantId).toBe('a')
    expect(withoutShipping.differenceToNextMerchantCents).toBe(2_000)

    const withShipping = analysePrices({
      currentPriceCents: 10_000,
      observations: series([10_000, 10_000, 10_000], 2),
      offers: [
        { merchantId: 'a', priceCents: 10_000, shippingCents: 700, isActive: true },
        { merchantId: 'b', priceCents: 10_400, shippingCents: 0, isActive: true },
      ],
      now,
    })
    expect(withShipping.comparisonBasis).toBe('prijs-en-verzending')
    // Met verzendkosten is b goedkoper: 10.400 tegen 10.700.
    expect(withShipping.cheapestMerchantId).toBe('b')
    expect(withShipping.differenceToNextMerchantCents).toBe(300)
  })

  it('negeert inactieve aanbiedingen in de vergelijking', () => {
    const analysis = analysePrices({
      currentPriceCents: 10_000,
      observations: series([10_000], 0),
      offers: [
        { merchantId: 'a', priceCents: 10_000, shippingCents: null, isActive: true },
        { merchantId: 'b', priceCents: 8_000, shippingCents: null, isActive: false },
      ],
      now,
    })
    expect(analysis.numberOfComparedMerchants).toBe(1)
    expect(analysis.differenceToNextMerchantCents).toBeNull()
  })

  it('is deterministisch en bevat de analyseversie', () => {
    const input = { currentPriceCents: 9_900, observations: series([9_900, 9_900, 9_900], 2), now }
    expect(analysePrices(input)).toEqual(analysePrices(input))
    expect(analysePrices(input).analysisVersion).toBe(ANALYSIS_VERSION)
  })
})

describe('zinnen over de prijs', () => {
  it('noemt de mediaan alleen wanneer die bestaat', () => {
    const prices = Array.from({ length: 100 }, () => 20_000)
    const analysis = analysePrices({
      currentPriceCents: 16_400,
      observations: series(prices, 99),
      now,
    })
    const texts = priceStatements(analysis, now).map((statement) => statement.text)
    expect(texts.some((text) => text.includes('90-dagenmediaan'))).toBe(true)
    expect(texts.some((text) => text.includes('18%'))).toBe(true)
  })

  it('zegt eerlijk dat er te weinig historie is', () => {
    const analysis = analysePrices({
      currentPriceCents: 9_900,
      observations: series([9_900], 0),
      now,
    })
    const statements = priceStatements(analysis, now)
    expect(statements).toHaveLength(1)
    expect(statements[0]?.key).toBe('geen-historie')
    expect(statements[0]?.text).toContain('te weinig historie')
  })

  it('meldt een prijsdaling van vandaag', () => {
    const analysis = analysePrices({
      currentPriceCents: 25_900,
      observations: [
        ...series([29_900, 29_900, 29_900], 3),
        { priceCents: 25_900, capturedAt: new Date(now.getTime() - 3600_000), inStock: true },
      ],
      now,
    })
    const texts = priceStatements(analysis, now).map((statement) => statement.text)
    expect(texts.some((text) => text.startsWith('De prijs is vandaag'))).toBe(true)
  })

  it('claimt nooit een goedkoopste-aanbieder zonder tweede aanbieder', () => {
    const analysis = analysePrices({
      currentPriceCents: 9_900,
      observations: series([9_900, 9_900, 9_900], 2),
      offers: [{ merchantId: 'a', priceCents: 9_900, shippingCents: null, isActive: true }],
      now,
    })
    const keys = priceStatements(analysis, now).map((statement) => statement.key)
    expect(keys).not.toContain('goedkoopste-aanbieder')
  })
})
