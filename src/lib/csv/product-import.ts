import { z } from 'zod'
import { parseCsv } from '@/lib/scraping/csv'
import { categories, categorySlugForName } from '@/lib/categories'
import { normalizeCategory, normalizeEan, normalizePriceCents, normalizeUrl } from '@/lib/scraping/normalize'

/**
 * Productimport via CSV.
 *
 * De rijen komen van de redactie of van een aanbieder; wij verzinnen niets. Een
 * rij zonder prijs, afbeelding of URL wordt geweigerd in plaats van half
 * opgeslagen, precies zoals bij een feed. Geïmporteerde producten komen altijd
 * als `CANDIDATE` binnen met `imageStatus = PENDING`: de afbeeldingsvalidatie en
 * een mens beslissen daarna.
 */
export const PRODUCT_IMPORT_COLUMNS = [
  'merchantSlug',
  'externalId',
  'title',
  'brand',
  'model',
  'ean',
  'category',
  'description',
  'price',
  'referencePrice',
  'referencePriceType',
  'currency',
  'shippingCost',
  'inStock',
  'url',
  'affiliateUrl',
  'imageUrl',
  'imageAlt',
  'specifications',
] as const

export function productImportTemplate(): string {
  const example = [
    'voorbeeldwinkel',
    'SKU-1',
    'Voorbeeld koffiemolen met 40 maalgraden',
    'Voorbeeldmerk',
    'VM-40',
    '8712345000011',
    categories[1]?.name ?? 'Keuken & Apparaten',
    'Korte omschrijving zoals de aanbieder haar levert',
    '249,00',
    '299,00',
    'MERCHANT_WAS_PRICE',
    'EUR',
    '4,95',
    'ja',
    'https://voorbeeldwinkel.nl/p/sku-1',
    '',
    'https://cdn.voorbeeldwinkel.nl/sku-1.jpg',
    'Koffiemolen op een aanrecht',
    'Maalgraden=40;Bonenreservoir=250 g',
  ]
  return `${PRODUCT_IMPORT_COLUMNS.join(',')}\n${example
    .map((value) => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
    .join(',')}\n`
}

const rowSchema = z.object({
  merchantSlug: z.string().min(1).max(80),
  externalId: z.string().min(1).max(120),
  title: z.string().min(6).max(240),
  brand: z.string().max(80).nullable(),
  model: z.string().max(80).nullable(),
  ean: z.string().nullable(),
  categoryName: z.string().min(2),
  description: z.string().max(600).nullable(),
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
  destinationUrl: z.string().url(),
  affiliateUrl: z.string().url().nullable(),
  imageUrl: z.string().min(1),
  imageAlt: z.string().min(2).max(200),
  specifications: z.record(z.string(), z.string()),
})

export type ProductImportRow = z.infer<typeof rowSchema>

export type ProductImportResult = {
  rows: ProductImportRow[]
  errors: Array<{ line: number; message: string }>
}

function parseSpecifications(value: string | undefined): Record<string, string> {
  if (!value) return {}
  const result: Record<string, string> = {}
  for (const pair of value.split(/[;|]/)) {
    const [key, ...rest] = pair.split('=')
    const label = (key ?? '').trim()
    const entry = rest.join('=').trim()
    if (label.length > 0 && entry.length > 0) result[label] = entry
  }
  return result
}

function parseStock(value: string | undefined): boolean {
  const text = (value ?? '').trim().toLowerCase()
  if (['ja', 'true', '1', 'op voorraad', 'in stock', 'y'].includes(text)) return true
  if (['nee', 'false', '0', 'uitverkocht', 'out of stock', 'n'].includes(text)) return false
  // Onbekend is niet hetzelfde als op voorraad.
  return false
}

export function parseProductImport(csv: string): ProductImportResult {
  const parsedRows = parseCsv(csv)
  const rows: ProductImportRow[] = []
  const errors: Array<{ line: number; message: string }> = []

  parsedRows.forEach((row, index) => {
    const line = index + 2
    const categoryName = normalizeCategory(row.category, {})
    const referencePriceCents = normalizePriceCents(row.referencePrice)
    const currentPriceCents = normalizePriceCents(row.price)

    const candidate = {
      merchantSlug: (row.merchantSlug ?? '').trim(),
      externalId: (row.externalId ?? '').trim(),
      title: (row.title ?? '').trim(),
      brand: (row.brand ?? '').trim() || null,
      model: (row.model ?? '').trim() || null,
      ean: normalizeEan(row.ean),
      categoryName,
      description: (row.description ?? '').trim() || null,
      currentPriceCents: currentPriceCents ?? 0,
      // Een referentieprijs die niet hoger is dan de prijs bewaren wij niet.
      referencePriceCents:
        referencePriceCents !== null && currentPriceCents !== null && referencePriceCents > currentPriceCents
          ? referencePriceCents
          : null,
      referencePriceType:
        referencePriceCents !== null && currentPriceCents !== null && referencePriceCents > currentPriceCents
          ? ((row.referencePriceType ?? 'MERCHANT_WAS_PRICE').trim().toUpperCase() || 'MERCHANT_WAS_PRICE')
          : null,
      currency: ((row.currency ?? 'EUR').trim() || 'EUR').toUpperCase(),
      shippingCostCents: normalizePriceCents(row.shippingCost),
      inStock: parseStock(row.inStock),
      destinationUrl: normalizeUrl(row.url) ?? '',
      affiliateUrl: normalizeUrl(row.affiliateUrl),
      imageUrl: normalizeUrl(row.imageUrl) ?? (row.imageUrl ?? '').trim(),
      imageAlt: (row.imageAlt ?? '').trim() || (row.title ?? '').trim(),
      specifications: parseSpecifications(row.specifications),
    }

    const parsed = rowSchema.safeParse(candidate)
    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      })
      return
    }
    if (!categories.some((category) => category.slug === categorySlugForName(parsed.data.categoryName))) {
      errors.push({ line, message: `onbekende categorie "${row.category ?? ''}"` })
      return
    }
    rows.push(parsed.data)
  })

  return { rows, errors }
}
