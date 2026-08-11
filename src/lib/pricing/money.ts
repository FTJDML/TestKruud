/**
 * Geldbedragen worden intern in hele centen bewaard zodat afronding
 * voorspelbaar is. Prisma levert Decimal-waarden als object met toString().
 */
export type MoneyInput = number | string | { toString(): string } | null | undefined

const currencyFormatters = new Map<string, Intl.NumberFormat>()
const numberFormatter = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Zet een prijs uit brondata of database om naar hele centen. */
export function toCents(input: MoneyInput): number | null {
  if (input === null || input === undefined) return null
  const raw = typeof input === 'number' ? input.toFixed(2) : input.toString().trim()
  if (raw.length === 0) return null
  const normalized = normalizeDecimalString(raw)
  if (normalized === null) return null
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/**
 * Normaliseert prijsnotaties uit feeds: "€ 1.299,00", "1299.00", "1,299.00",
 * "€1.299", "129,95 EUR". Geeft null bij onbruikbare invoer.
 */
export function normalizeDecimalString(raw: string): string | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/(eur|euro|€)/gi, '')
    .replace(/[^0-9.,-]/g, '')
  if (cleaned.length === 0) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma === -1 && lastDot === -1) return cleaned

  // Het laatst voorkomende scheidingsteken is het decimaalteken, mits er
  // maximaal twee cijfers achter staan. Anders is het een duizendscheider.
  const decimalIndex = Math.max(lastComma, lastDot)
  const decimals = cleaned.length - decimalIndex - 1
  if (decimals === 0 || decimals > 2) {
    return cleaned.replace(/[.,]/g, '')
  }
  const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, '')
  const fractionPart = cleaned.slice(decimalIndex + 1)
  return `${integerPart === '' || integerPart === '-' ? `${integerPart}0` : integerPart}.${fractionPart}`
}

/** Formatteert centen als Nederlands bedrag, bijvoorbeeld "€ 299" of "€ 12,95". */
export function formatMoney(cents: number, currency = 'EUR'): string {
  const showFractions = cents % 100 !== 0
  const key = `${currency}:${showFractions ? 'frac' : 'whole'}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency,
      minimumFractionDigits: showFractions ? 2 : 0,
      maximumFractionDigits: showFractions ? 2 : 0,
    })
    currencyFormatters.set(key, formatter)
  }
  // Intl gebruikt een non-breaking space tussen symbool en getal; die houden we.
  return formatter.format(cents / 100)
}

/** Formatteert centen zonder valutasymbool (voor JSON-LD price velden). */
export function formatPriceValue(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2)
}
