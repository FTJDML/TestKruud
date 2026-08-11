import { describe, expect, it } from 'vitest'
import {
  computeDealPricing,
  discountBadgeLabel,
  MIN_DEAL_DISCOUNT_PERCENTAGE,
  STALE_AFTER_MS,
} from '@/lib/pricing/deal'
import { formatMoney, normalizeDecimalString, toCents } from '@/lib/pricing/money'

const now = new Date('2026-08-11T12:00:00.000Z')
const fresh = new Date(now.getTime() - 60 * 60 * 1000)

describe('prijsparsing', () => {
  it('leest Nederlandse en Engelse notaties', () => {
    expect(toCents('€ 1.299,00')).toBe(129_900)
    expect(toCents('1299.00')).toBe(129_900)
    expect(toCents('1,299.00')).toBe(129_900)
    expect(toCents('129,95 EUR')).toBe(12_995)
    expect(toCents('€1.299')).toBe(129_900)
    expect(toCents(299)).toBe(29_900)
    expect(toCents({ toString: () => '299.00' })).toBe(29_900)
  })

  it('leest dezelfde prijs uit verschillende schrijfwijzen', () => {
    // De ingest vergelijkt prijzen in centen; anders zou "70" naast "70.00" als
    // een prijswijziging tellen en kreeg elke run een identiek snapshot.
    expect(toCents('70')).toBe(toCents('70.00'))
    expect(toCents('70,00')).toBe(toCents('70.00'))
    expect(toCents('1799')).toBe(toCents('1799.00'))
  })

  it('weigert onbruikbare invoer', () => {
    expect(toCents('')).toBeNull()
    expect(toCents('op aanvraag')).toBeNull()
    expect(toCents(null)).toBeNull()
    expect(normalizeDecimalString('geen prijs')).toBeNull()
  })

  it('formatteert bedragen volgens nl-NL', () => {
    expect(formatMoney(29_900).replace(/ /g, ' ')).toBe('€ 299')
    expect(formatMoney(12_995).replace(/ /g, ' ')).toBe('€ 129,95')
  })
})

describe('kortingsberekening', () => {
  it('berekent besparing en percentage', () => {
    const pricing = computeDealPricing(
      {
        currentPrice: '299.00',
        referencePrice: '399.00',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        inStock: true,
        checkedAt: fresh,
      },
      now,
    )
    expect(pricing.savingsCents).toBe(10_000)
    expect(pricing.discountPercentage).toBe(25)
    expect(pricing.currentPrice.replace(/ /g, ' ')).toBe('€ 299')
    expect(pricing.referencePrice?.replace(/ /g, ' ')).toBe('€ 399')
    expect(pricing.referencePriceLabel).toBe('Van-prijs volgens aanbieder')
    expect(pricing.qualifiesAsDeal).toBe(true)
  })

  it('rondt percentages af op hele getallen', () => {
    const pricing = computeDealPricing(
      {
        currentPrice: '66.66',
        referencePrice: '99.99',
        referencePriceType: 'RECOMMENDED_RETAIL_PRICE',
        checkedAt: fresh,
      },
      now,
    )
    expect(pricing.discountPercentage).toBe(33)
  })

  it('maakt een badge alleen bij een echte korting', () => {
    const deal = computeDealPricing(
      {
        currentPrice: '299.00',
        referencePrice: '399.00',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        checkedAt: fresh,
      },
      now,
    )
    expect(discountBadgeLabel(deal)).toBe('-25%')
    expect(discountBadgeLabel(null)).toBeNull()

    // Zonder geldige referentieprijs bestaat er geen korting om te tonen.
    const discovery = computeDealPricing({ currentPrice: '299.00', checkedAt: fresh }, now)
    expect(discountBadgeLabel(discovery)).toBeNull()

    // Een uitverkochte aanbieding is geen DEAL en krijgt dus ook geen badge.
    const soldOut = computeDealPricing(
      {
        currentPrice: '299.00',
        referencePrice: '399.00',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        inStock: false,
        checkedAt: fresh,
      },
      now,
    )
    expect(soldOut.discountPercentage).toBe(25)
    expect(discountBadgeLabel(soldOut)).toBeNull()
  })
})

describe('DEAL versus DISCOVERY', () => {
  const dealInput = {
    currentPrice: '299.00',
    referencePrice: '399.00',
    referencePriceType: 'MERCHANT_WAS_PRICE',
    inStock: true,
    checkedAt: fresh,
  } as const

  it('is een DEAL met alle zes voorwaarden', () => {
    const pricing = computeDealPricing(dealInput, now)
    expect(pricing.kind).toBe('DEAL')
    expect(pricing.hasValidReferencePrice).toBe(true)
    expect(pricing.isActive).toBe(true)
    expect(pricing.referencePrice).not.toBeNull()
    expect(pricing.discountPercentage).toBe(25)
  })

  it('is een DISCOVERY zonder referentieprijs', () => {
    const pricing = computeDealPricing({ currentPrice: '299.00', checkedAt: fresh }, now)
    expect(pricing.kind).toBe('DISCOVERY')
    expect(pricing.referencePrice).toBeNull()
    expect(pricing.savings).toBeNull()
    expect(pricing.discountPercentage).toBeNull()
    expect(pricing.qualifiesAsDeal).toBe(false)
  })

  it('is een DISCOVERY zonder referentieprijstype', () => {
    const pricing = computeDealPricing({ ...dealInput, referencePriceType: null }, now)
    expect(pricing.kind).toBe('DISCOVERY')
    expect(pricing.referencePrice).toBeNull()
  })

  it('is een DISCOVERY wanneer de referentieprijs niet hoger is', () => {
    const pricing = computeDealPricing({ ...dealInput, referencePrice: '299.00' }, now)
    expect(pricing.kind).toBe('DISCOVERY')
  })

  it('is een DISCOVERY wanneer de prijs niet recent is gecontroleerd', () => {
    const pricing = computeDealPricing(
      { ...dealInput, checkedAt: new Date(now.getTime() - STALE_AFTER_MS - 1_000) },
      now,
    )
    expect(pricing.kind).toBe('DISCOVERY')
    expect(pricing.isStale).toBe(true)
  })

  it('is een DISCOVERY wanneer het product uitverkocht is', () => {
    const pricing = computeDealPricing({ ...dealInput, inStock: false }, now)
    expect(pricing.kind).toBe('DISCOVERY')
  })

  it('houdt een DEAL met te weinig korting buiten de dealssecties', () => {
    const pricing = computeDealPricing({ ...dealInput, referencePrice: '305.00' }, now)
    // Wel een echte van-prijs, dus DEAL in de presentatie...
    expect(pricing.kind).toBe('DEAL')
    // ... maar te weinig korting voor de dagfeed en het dealfilter.
    expect(pricing.qualifiesAsDeal).toBe(false)
  })
})

describe('ongeldige referentieprijzen', () => {
  it('negeert een referentieprijs die niet hoger is dan de huidige prijs', () => {
    const pricing = computeDealPricing(
      {
        currentPrice: '299.00',
        referencePrice: '299.00',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        checkedAt: fresh,
      },
      now,
    )
    expect(pricing.hasValidReferencePrice).toBe(false)
    expect(pricing.referencePrice).toBeNull()
    expect(pricing.savings).toBeNull()
    expect(pricing.discountPercentage).toBeNull()
    expect(pricing.qualifiesAsDeal).toBe(false)
  })

  it('negeert een referentieprijs zonder type', () => {
    const pricing = computeDealPricing(
      { currentPrice: '199.00', referencePrice: '249.00', referencePriceType: null, checkedAt: fresh },
      now,
    )
    expect(pricing.hasValidReferencePrice).toBe(false)
    expect(pricing.qualifiesAsDeal).toBe(false)
  })

  it('houdt een te kleine korting buiten de dagfeed', () => {
    const pricing = computeDealPricing(
      {
        currentPrice: '98.00',
        referencePrice: '100.00',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        checkedAt: fresh,
      },
      now,
    )
    expect(pricing.discountPercentage).toBeLessThan(MIN_DEAL_DISCOUNT_PERCENTAGE)
    expect(pricing.qualifiesAsDeal).toBe(false)
  })
})

describe('stale aanbiedingen', () => {
  it('is stale na 24 uur zonder controle', () => {
    const pricing = computeDealPricing(
      {
        currentPrice: '50.00',
        referencePrice: '80.00',
        referencePriceType: 'MERCHANT_WAS_PRICE',
        checkedAt: new Date(now.getTime() - STALE_AFTER_MS - 1_000),
      },
      now,
    )
    expect(pricing.isStale).toBe(true)
    expect(pricing.isActive).toBe(false)
    expect(pricing.qualifiesAsDeal).toBe(false)
  })

  it('is niet stale binnen 24 uur', () => {
    const pricing = computeDealPricing(
      { currentPrice: '50.00', checkedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000) },
      now,
    )
    expect(pricing.isStale).toBe(false)
    expect(pricing.isActive).toBe(true)
  })

  it('is niet actief wanneer het product uitverkocht is', () => {
    const pricing = computeDealPricing({ currentPrice: '50.00', inStock: false, checkedAt: fresh }, now)
    expect(pricing.isActive).toBe(false)
  })

  it('respecteert een expliciete staleAt', () => {
    const pricing = computeDealPricing(
      { currentPrice: '50.00', checkedAt: fresh, staleAt: new Date(now.getTime() - 1_000) },
      now,
    )
    expect(pricing.isStale).toBe(true)
  })
})

describe('tijdelijke acties', () => {
  it('gebruikt "Tijdelijk" alleen met een bekende einddatum', () => {
    const withEnd = computeDealPricing(
      { currentPrice: '50.00', checkedAt: fresh, promotionEndsAt: new Date(now.getTime() + 3_600_000) },
      now,
    )
    expect(withEnd.isTemporary).toBe(true)
    expect(withEnd.priceLeadLabel).toBe('Tijdelijk')

    const withoutEnd = computeDealPricing({ currentPrice: '50.00', checkedAt: fresh }, now)
    expect(withoutEnd.isTemporary).toBe(false)
    expect(withoutEnd.priceLeadLabel).toBe('Nu')

    const expired = computeDealPricing(
      { currentPrice: '50.00', checkedAt: fresh, promotionEndsAt: new Date(now.getTime() - 1_000) },
      now,
    )
    expect(expired.isTemporary).toBe(false)
  })
})
