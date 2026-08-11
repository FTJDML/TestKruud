import { z } from 'zod'
import { parseCsv } from '@/lib/scraping/csv'
import { normalizeEan, normalizePriceCents } from '@/lib/scraping/normalize'

/**
 * Handmatige offerimport voor de launch.
 *
 * De catalogus (Open Icecat) levert wat een product ís; dit bestand levert wat
 * een winkel er vandaag voor vraagt. Die twee blijven bewust gescheiden: een
 * catalogusbestand kent geen winkelprijs, en een prijs zonder controlemoment is
 * geen prijs.
 *
 * Regels die hier worden afgedwongen:
 *
 * - een prijs zonder `priceCheckedAt` wordt geweigerd;
 * - een referentieprijs die niet hoger is dan de actuele prijs wordt geweigerd,
 *   want dan is er geen korting om te tonen;
 * - een referentieprijs zonder type wordt geweigerd, zodat op de pagina altijd
 *   te zien is waar de van-prijs op rust;
 * - de bestemming is een gewone winkel-URL. Affiliatelinks komen later uit een
 *   feed en horen niet in een handmatig bestand.
 */
export const LAUNCH_OFFER_COLUMNS = [
  'ean',
  'productSlug',
  'merchantSlug',
  'destinationUrl',
  'currentPrice',
  'referencePrice',
  'referencePriceType',
  'currency',
  'shippingCost',
  'inStock',
  'availabilityLabel',
  'priceCheckedAt',
  'promotionEndsAt',
] as const

export function launchOfferTemplate(): string {
  const rows = [
    [
      '8712345678901',
      '',
      'voorbeeldwinkel',
      'https://voorbeeldwinkel.nl/p/stoomoven-vapor-38',
      '479,00',
      '629,00',
      'MERCHANT_WAS_PRICE',
      'EUR',
      '0,00',
      'ja',
      'op voorraad',
      '2026-08-11T09:30',
      '2026-08-20T23:59',
    ],
    [
      '8798765432109',
      '',
      'voorbeeldwinkel',
      'https://voorbeeldwinkel.nl/p/robotstofzuiger-rs-500',
      '399,00',
      '',
      '',
      'EUR',
      '4,95',
      'ja',
      'op voorraad',
      '2026-08-11T09:35',
      '',
    ],
  ]
  const escape = (value: string): string =>
    /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return `${LAUNCH_OFFER_COLUMNS.join(',')}\n${rows
    .map((row) => row.map(escape).join(','))
    .join('\n')}\n`
}

const rowSchema = z
  .object({
    ean: z.string().nullable(),
    productSlug: z.string().nullable(),
    merchantSlug: z.string().min(1).max(80),
    destinationUrl: z.string().url(),
    currentPriceCents: z.number().int().positive(),
    referencePriceCents: z.number().int().positive().nullable(),
    referencePriceType: z
      .enum([
        'MERCHANT_WAS_PRICE',
        'RECOMMENDED_RETAIL_PRICE',
        'OWN_PREVIOUS_PRICE',
        'OWN_30_DAY_LOW',
        'OWN_90_DAY_MEDIAN',
      ])
      .nullable(),
    currency: z.string().length(3),
    shippingCostCents: z.number().int().min(0).nullable(),
    inStock: z.boolean(),
    availabilityLabel: z.string().max(120).nullable(),
    priceCheckedAt: z.date(),
    promotionEndsAt: z.date().nullable(),
  })
  .refine((row) => row.ean !== null || row.productSlug !== null, {
    message: 'geef een ean of een productSlug, zodat de rij bij een product hoort',
  })
  .refine(
    (row) => row.referencePriceCents === null || row.referencePriceCents > row.currentPriceCents,
    { message: 'referentieprijs moet hoger zijn dan de actuele prijs' },
  )
  .refine((row) => row.referencePriceCents === null || row.referencePriceType !== null, {
    message: 'bij een referentieprijs hoort een referencePriceType',
  })

export type LaunchOfferRow = z.infer<typeof rowSchema>

export type LaunchOfferResult = {
  rows: LaunchOfferRow[]
  errors: Array<{ line: number; message: string }>
}

function parseStock(value: string | undefined): boolean {
  const text = (value ?? '').trim().toLowerCase()
  if (['ja', 'true', '1', 'op voorraad', 'in stock', 'y'].includes(text)) return true
  if (['nee', 'false', '0', 'uitverkocht', 'out of stock', 'n'].includes(text)) return false
  // Onbekend is niet hetzelfde als op voorraad.
  return false
}

function parseDate(value: string | undefined): Date | null {
  const text = (value ?? '').trim()
  if (text.length === 0) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function text(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Leest het offerbestand. Een foute rij wordt gemeld, niet half opgeslagen. */
export function parseLaunchOffers(csv: string): LaunchOfferResult {
  const rows: LaunchOfferRow[] = []
  const errors: Array<{ line: number; message: string }> = []

  for (const [index, entry] of parseCsv(csv).entries()) {
    const line = index + 2
    const priceCheckedAt = parseDate(entry.priceCheckedAt)
    if (!priceCheckedAt) {
      errors.push({ line, message: 'priceCheckedAt ontbreekt of is geen datum' })
      continue
    }

    const parsed = rowSchema.safeParse({
      ean: normalizeEan(entry.ean),
      productSlug: text(entry.productSlug),
      merchantSlug: (entry.merchantSlug ?? '').trim(),
      destinationUrl: (entry.destinationUrl ?? '').trim(),
      currentPriceCents: normalizePriceCents(entry.currentPrice) ?? 0,
      referencePriceCents: normalizePriceCents(entry.referencePrice),
      referencePriceType: text(entry.referencePriceType),
      currency: text(entry.currency)?.toUpperCase() ?? 'EUR',
      shippingCostCents: normalizePriceCents(entry.shippingCost),
      inStock: parseStock(entry.inStock),
      availabilityLabel: text(entry.availabilityLabel),
      priceCheckedAt,
      promotionEndsAt: parseDate(entry.promotionEndsAt),
    })

    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'rij'}: ${issue.message}`).join('; '),
      })
      continue
    }
    rows.push(parsed.data)
  }

  return { rows, errors }
}
