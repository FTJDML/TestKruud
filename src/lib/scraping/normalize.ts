import { categoryNames } from '@/lib/categories'
import { toCents } from '@/lib/pricing/money'

/** Voorraadwaarden zoals feeds ze schrijven, genormaliseerd naar boolean. */
const inStockWords = ['1', 'true', 'y', 'yes', 'ja', 'in stock', 'instock', 'op voorraad', 'available', 'leverbaar']
const outOfStockWords = [
  '0',
  'false',
  'n',
  'no',
  'nee',
  'out of stock',
  'outofstock',
  'uitverkocht',
  'niet op voorraad',
  'backorder',
  'preorder',
]

export function normalizeStock(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value !== 'string') return false
  const cleaned = value.trim().toLowerCase()
  if (inStockWords.includes(cleaned)) return true
  if (outOfStockWords.includes(cleaned)) return false
  // Feeds schrijven soms een aantal ("12 stuks").
  const amount = Number.parseInt(cleaned, 10)
  return Number.isFinite(amount) ? amount > 0 : false
}

/** Veilige prijsparsing; null bij onbruikbare invoer. */
export function normalizePriceCents(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return toCents(value)
  return null
}

/** Alleen absolute http(s)-URL's zijn bruikbaar. */
export function normalizeUrl(value: unknown, base?: string): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  try {
    const url = new URL(value.trim(), base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** EAN's zijn 8, 12, 13 of 14 cijfers; alles daarbuiten negeren we. */
export function normalizeEan(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const digits = String(value).replace(/\D/g, '')
  return [8, 12, 13, 14].includes(digits.length) ? digits : null
}

export function normalizeText(value: unknown, maxLength = 400): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length === 0 ? null : cleaned.slice(0, maxLength)
}

/**
 * Zet een categorie uit brondata om naar één van onze hoofdcategorieën.
 * Onbekende categorieën komen in "Cadeaus" en vragen handmatige controle.
 */
export function normalizeCategory(value: unknown, mapping: Record<string, string> = {}): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw.length === 0) return 'Cadeaus'
  const mapped = mapping[raw] ?? mapping[raw.toLowerCase()]
  if (mapped && categoryNames.includes(mapped)) return mapped
  const exact = categoryNames.find((name) => name.toLowerCase() === raw.toLowerCase())
  return exact ?? 'Cadeaus'
}

/** Leest een waarde uit een geneste bron met een pad als "product.price.amount". */
export function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) {
      const index = Number.parseInt(key, 10)
      return Number.isFinite(index) ? current[index] : undefined
    }
    if (typeof current === 'object') return (current as Record<string, unknown>)[key]
    return undefined
  }, source)
}
