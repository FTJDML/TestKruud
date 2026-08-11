import { describe, expect, it } from 'vitest'
import { LAUNCH_OFFER_COLUMNS, launchOfferTemplate, parseLaunchOffers } from '@/lib/csv/launch-offers'

/**
 * De handmatige offerimport is de enige plek waar een prijs binnenkomt. Deze
 * tests leggen vast wat er nodig is voordat een rij een aanbieding mag worden,
 * en waarom een rij wordt geweigerd in plaats van half opgeslagen.
 */
function csv(row: Partial<Record<(typeof LAUNCH_OFFER_COLUMNS)[number], string>>): string {
  const base: Record<string, string> = {
    ean: '8712345678901',
    productSlug: '',
    merchantSlug: 'voorbeeldwinkel',
    destinationUrl: 'https://voorbeeldwinkel.nl/p/stoomoven',
    currentPrice: '479,00',
    referencePrice: '629,00',
    referencePriceType: 'MERCHANT_WAS_PRICE',
    currency: 'EUR',
    shippingCost: '0,00',
    inStock: 'ja',
    availabilityLabel: 'op voorraad',
    priceCheckedAt: '2026-08-11T09:30',
    promotionEndsAt: '',
  }
  const merged = { ...base, ...row }
  const escape = (value: string): string => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  return `${LAUNCH_OFFER_COLUMNS.join(',')}\n${LAUNCH_OFFER_COLUMNS.map((column) => escape(merged[column] ?? '')).join(',')}\n`
}

describe('handmatige offerimport', () => {
  it('leest een volledige rij met van-prijs', () => {
    const { rows, errors } = parseLaunchOffers(csv({}))
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.ean).toBe('8712345678901')
    expect(row.currentPriceCents).toBe(47_900)
    expect(row.referencePriceCents).toBe(62_900)
    expect(row.referencePriceType).toBe('MERCHANT_WAS_PRICE')
    expect(row.inStock).toBe(true)
    expect(row.priceCheckedAt.getFullYear()).toBe(2026)
  })

  it('leest een rij zonder van-prijs; dat blijft een discovery', () => {
    const { rows, errors } = parseLaunchOffers(csv({ referencePrice: '', referencePriceType: '' }))
    expect(errors).toEqual([])
    expect(rows[0]!.referencePriceCents).toBeNull()
    expect(rows[0]!.referencePriceType).toBeNull()
  })

  it('weigert een prijs zonder controlemoment', () => {
    const { rows, errors } = parseLaunchOffers(csv({ priceCheckedAt: '' }))
    expect(rows).toHaveLength(0)
    expect(errors[0]!.message).toContain('priceCheckedAt')
  })

  it('weigert een van-prijs die niet hoger is dan de actuele prijs', () => {
    const { rows, errors } = parseLaunchOffers(csv({ referencePrice: '400,00' }))
    expect(rows).toHaveLength(0)
    expect(errors[0]!.message).toContain('hoger')
  })

  it('weigert een van-prijs zonder type, zodat de herkomst altijd zichtbaar is', () => {
    const { rows, errors } = parseLaunchOffers(csv({ referencePriceType: '' }))
    expect(rows).toHaveLength(0)
    expect(errors[0]!.message).toContain('referencePriceType')
  })

  it('weigert een rij zonder ean en zonder productSlug', () => {
    const { rows, errors } = parseLaunchOffers(csv({ ean: '' }))
    expect(rows).toHaveLength(0)
    expect(errors[0]!.message).toContain('productSlug')
  })

  it('weigert een bestemming die geen geldige URL is', () => {
    const { rows, errors } = parseLaunchOffers(csv({ destinationUrl: 'winkel.nl/p/1' }))
    expect(rows).toHaveLength(0)
    expect(errors[0]!.message).toContain('destinationUrl')
  })

  it('leest onbekende voorraad niet als op voorraad', () => {
    const { rows } = parseLaunchOffers(csv({ inStock: 'misschien' }))
    expect(rows[0]!.inStock).toBe(false)
  })

  it('levert een sjabloon dat zichzelf laat inlezen', () => {
    const { rows, errors } = parseLaunchOffers(launchOfferTemplate())
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
    // De tweede regel is met opzet een discovery: prijs zonder van-prijs.
    expect(rows[1]!.referencePriceCents).toBeNull()
  })
})
