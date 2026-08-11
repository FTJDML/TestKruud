import type { ReferencePriceType } from '@prisma/client'
import { formatMoney, toCents, type MoneyInput } from '@/lib/pricing/money'

/** Een aanbieding is standaard stale wanneer zij >24 uur niet is gecontroleerd. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000

/** Minimale korting waarmee een product als deal in de dagfeed mag komen. */
export const MIN_DEAL_DISCOUNT_PERCENTAGE = 5

export type OfferPricingInput = {
  currentPrice: MoneyInput
  referencePrice?: MoneyInput
  referencePriceType?: ReferencePriceType | null
  currency?: string | null
  inStock?: boolean
  checkedAt: Date | string
  staleAt?: Date | string | null
  promotionEndsAt?: Date | string | null
}

export type DealPricing = {
  currency: string
  currentPriceCents: number
  currentPrice: string
  referencePriceCents: number | null
  referencePrice: string | null
  referencePriceType: ReferencePriceType | null
  referencePriceLabel: string | null
  hasValidReferencePrice: boolean
  savingsCents: number | null
  savings: string | null
  discountPercentage: number | null
  isTemporary: boolean
  promotionEndsAt: Date | null
  priceLeadLabel: string
  inStock: boolean
  isStale: boolean
  isActive: boolean
  checkedAt: Date
  checkedAtLabel: string
  qualifiesAsDeal: boolean
}

const referencePriceLabels: Record<ReferencePriceType, string> = {
  MERCHANT_WAS_PRICE: 'Van-prijs volgens aanbieder',
  RECOMMENDED_RETAIL_PRICE: 'Adviesprijs van de fabrikant',
  OWN_PREVIOUS_PRICE: 'Vorige prijs die wij zagen',
  OWN_30_DAY_LOW: 'Laagste prijs die wij in 30 dagen zagen',
  OWN_90_DAY_MEDIAN: 'Mediaanprijs die wij in 90 dagen zagen',
}

export function referencePriceTypeLabel(type: ReferencePriceType | null | undefined): string | null {
  return type ? referencePriceLabels[type] : null
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Centrale prijs- en kortingsberekening. AI berekent nooit percentages; dit is
 * de enige plek waar korting, besparing en geldigheid worden bepaald.
 */
export function computeDealPricing(offer: OfferPricingInput, now: Date = new Date()): DealPricing {
  const currency = offer.currency && offer.currency.length === 3 ? offer.currency : 'EUR'
  const currentPriceCents = toCents(offer.currentPrice) ?? 0
  const rawReferenceCents = toCents(offer.referencePrice ?? null)

  // Een referentieprijs is alleen geldig wanneer zij hoger is dan de huidige
  // prijs én er een expliciet type bij hoort. Nooit zelf een van-prijs verzinnen.
  const hasValidReferencePrice =
    rawReferenceCents !== null &&
    currentPriceCents > 0 &&
    rawReferenceCents > currentPriceCents &&
    Boolean(offer.referencePriceType)

  const referencePriceCents = hasValidReferencePrice ? rawReferenceCents : null
  const savingsCents = referencePriceCents === null ? null : referencePriceCents - currentPriceCents
  const discountPercentage =
    referencePriceCents === null || savingsCents === null
      ? null
      : Math.round((savingsCents / referencePriceCents) * 100)

  const checkedAt = toDate(offer.checkedAt) ?? now
  const explicitStaleAt = toDate(offer.staleAt)
  const staleDeadline = explicitStaleAt ?? new Date(checkedAt.getTime() + STALE_AFTER_MS)
  const isStale = now.getTime() > staleDeadline.getTime()

  const promotionEndsAt = toDate(offer.promotionEndsAt)
  const isTemporary = promotionEndsAt !== null && promotionEndsAt.getTime() > now.getTime()

  const inStock = offer.inStock !== false
  const isActive = inStock && !isStale && currentPriceCents > 0

  return {
    currency,
    currentPriceCents,
    currentPrice: formatMoney(currentPriceCents, currency),
    referencePriceCents,
    referencePrice: referencePriceCents === null ? null : formatMoney(referencePriceCents, currency),
    referencePriceType: hasValidReferencePrice ? (offer.referencePriceType ?? null) : null,
    referencePriceLabel: hasValidReferencePrice
      ? referencePriceTypeLabel(offer.referencePriceType)
      : null,
    hasValidReferencePrice,
    savingsCents,
    savings: savingsCents === null ? null : formatMoney(savingsCents, currency),
    discountPercentage,
    isTemporary,
    promotionEndsAt,
    // "Tijdelijk" mag alleen wanneer er een echte einddatum bekend is.
    priceLeadLabel: isTemporary ? 'Tijdelijk' : 'Nu',
    inStock,
    isStale,
    isActive,
    checkedAt,
    checkedAtLabel: formatCheckedAt(checkedAt, now),
    qualifiesAsDeal:
      isActive &&
      hasValidReferencePrice &&
      (discountPercentage ?? 0) >= MIN_DEAL_DISCOUNT_PERCENTAGE,
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Amsterdam',
})

/** Server-side, tijdzonevaste weergave van het laatste controlemoment. */
export function formatCheckedAt(checkedAt: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - checkedAt.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return 'net gecontroleerd'
  if (diffMinutes < 60) return `${diffMinutes} minuten geleden gecontroleerd`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} uur geleden gecontroleerd`
  return `gecontroleerd op ${dateTimeFormatter.format(checkedAt)}`
}

export function formatPromotionEnd(endsAt: Date): string {
  return dateTimeFormatter.format(endsAt)
}

/** Percentage voor een badge, bijvoorbeeld "-25%". */
export function discountBadgeLabel(discountPercentage: number | null): string | null {
  if (discountPercentage === null || discountPercentage <= 0) return null
  return `-${discountPercentage}%`
}
