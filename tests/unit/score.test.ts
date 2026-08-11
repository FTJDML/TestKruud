import { describe, expect, it } from 'vitest'
import {
  compositeScore,
  discountQualityScore,
  editorialScore,
  freshnessScore,
  scoreWeights,
  type ScoreInput,
} from '@/lib/deals/score'

const now = new Date('2026-08-11T12:00:00.000Z')

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    uniquenessScore: 80,
    storyScore: 70,
    usefulnessScore: 60,
    giftabilityScore: 50,
    discountPercentage: 20,
    hasValidReferencePrice: true,
    discoveredAt: now,
    checkedAt: now,
    visualQualityScore: 60,
    merchantTrustScore: 70,
    ...overrides,
  }
}

describe('gewichten', () => {
  it('tellen op tot 1', () => {
    const total = Object.values(scoreWeights).reduce((sum, weight) => sum + weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('gebruikt de afgesproken verdeling', () => {
    expect(scoreWeights).toEqual({
      uniqueness: 0.2,
      story: 0.15,
      usefulness: 0.15,
      giftability: 0.1,
      discountQuality: 0.2,
      freshness: 0.1,
      visualQuality: 0.05,
      merchantTrust: 0.05,
    })
  })
})

describe('kortingskwaliteit', () => {
  it('is 0 zonder geldige referentieprijs', () => {
    expect(discountQualityScore(30, false)).toBe(0)
    expect(discountQualityScore(null, true)).toBe(0)
  })

  it('loopt op tot 40% korting en vlakt daarna af', () => {
    expect(discountQualityScore(20, true)).toBe(50)
    expect(discountQualityScore(40, true)).toBe(100)
    expect(discountQualityScore(80, true)).toBe(100)
  })
})

describe('versheid', () => {
  it('is hoog voor pas ontdekte, net gecontroleerde producten', () => {
    expect(freshnessScore({ discoveredAt: now, checkedAt: now }, now)).toBe(100)
  })

  it('daalt met de leeftijd van de vondst', () => {
    const old = new Date(now.getTime() - 20 * 86_400_000)
    expect(freshnessScore({ discoveredAt: old, checkedAt: now }, now)).toBeLessThan(
      freshnessScore({ discoveredAt: now, checkedAt: now }, now),
    )
  })

  it('blijft binnen 0 en 100', () => {
    const ancient = new Date(now.getTime() - 400 * 86_400_000)
    const score = freshnessScore({ discoveredAt: ancient, checkedAt: ancient }, now)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

describe('samengestelde score', () => {
  it('combineert alle onderdelen volgens de gewichten', () => {
    const result = compositeScore(input(), now)
    const expected =
      80 * 0.2 + 70 * 0.15 + 60 * 0.15 + 50 * 0.1 + 50 * 0.2 + 100 * 0.1 + 60 * 0.05 + 70 * 0.05
    expect(result.total).toBeCloseTo(Math.round(expected * 100) / 100, 5)
    expect(result.parts.discountQuality).toBe(50)
  })

  it('scoort een product zonder geldige referentieprijs lager', () => {
    const withReference = compositeScore(input(), now).total
    const withoutReference = compositeScore(input({ hasValidReferencePrice: false }), now).total
    expect(withoutReference).toBeLessThan(withReference)
  })

  it('begrenst deelscores op 0 tot 100', () => {
    const result = compositeScore(input({ uniquenessScore: 500, storyScore: -20 }), now)
    expect(result.parts.uniqueness).toBe(100)
    expect(result.parts.story).toBe(0)
  })
})

describe('redactionele score', () => {
  it('gebruikt geen prijscomponent', () => {
    const score = editorialScore({
      uniquenessScore: 100,
      storyScore: 100,
      usefulnessScore: 100,
      giftabilityScore: 100,
    })
    expect(score).toBe(100)
  })
})
