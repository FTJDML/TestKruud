/**
 * Productdeduplicatie. De volgorde is bewust: harde identifiers eerst, fuzzy
 * titelvergelijking als laatste hulpmiddel. Varianten (maat, kleur, uitvoering)
 * worden nooit blind samengevoegd.
 */

export type DedupeCandidate = {
  /** Interne of externe sleutel van dit record. */
  id: string
  merchantSlug: string
  externalId?: string | null
  ean?: string | null
  brand?: string | null
  model?: string | null
  title: string
}

export type DedupeStrategy =
  | 'ean'
  | 'brand-model'
  | 'merchant-external-id'
  | 'normalized-title'
  | 'fuzzy-title'

export type DedupeMatch = {
  match: DedupeCandidate
  strategy: DedupeStrategy
  confidence: number
}

const colourWords = [
  'zwart',
  'wit',
  'grijs',
  'antraciet',
  'beige',
  'zand',
  'creme',
  'crème',
  'blauw',
  'groen',
  'rood',
  'roze',
  'geel',
  'goud',
  'zilver',
  'brons',
  'koper',
  'naturel',
  'eiken',
  'walnoot',
  'black',
  'white',
  'grey',
  'gray',
  'silver',
  'gold',
]

const sizeWords = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'small', 'medium', 'large']

const noiseWords = [
  'set',
  'stuks',
  'stuk',
  'incl',
  'inclusief',
  'met',
  'voor',
  'de',
  'het',
  'een',
  'en',
  'van',
  'nieuw',
  'model',
  'editie',
  'edition',
  'kleur',
  'colour',
  'color',
  'maat',
  'size',
  'variant',
]

/**
 * Normaliseert een producttitel: hoofdletters, leestekens, dubbele spaties,
 * maten, kleuren en losse modelnummers.
 */
export function normalizeTitle(title: string): string {
  const withoutDiacritics = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const tokens = withoutDiacritics
    // maateenheden en afmetingen: 40cm, 1,5 l, 230 v, 60x40
    .replace(/(\d+)[.,](\d+)/g, '$1$2')
    .replace(/\b\d+\s?(cm|mm|m|l|ml|kg|g|w|watt|v|volt|inch|"|liter|lumen|hz)\b/g, ' ')
    .replace(/\b\d+\s?x\s?\d+(\s?x\s?\d+)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 0)
    .filter((token) => !colourWords.includes(token))
    .filter((token) => !sizeWords.includes(token))
    .filter((token) => !noiseWords.includes(token))

  return tokens.join(' ').trim()
}

/** Losse variantsignalen; twee records met verschillende signalen zijn varianten. */
export function variantSignature(title: string): string {
  const lower = title.toLowerCase()
  const colours = colourWords.filter((word) => new RegExp(`\\b${word}\\b`).test(lower))
  const sizes = lower.match(/\b\d+\s?(cm|mm|l|ml|inch|liter)\b/g) ?? []
  return [...colours.sort(), ...sizes.map((size) => size.replace(/\s/g, '')).sort()].join('|')
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return cleaned.length === 0 ? null : cleaned
}

/** Jaccard-overeenkomst op woordniveau; simpel, voorspelbaar en testbaar. */
export function titleSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeTitle(left).split(' ').filter(Boolean))
  const rightTokens = new Set(normalizeTitle(right).split(' ').filter(Boolean))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let intersection = 0
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1
  const union = leftTokens.size + rightTokens.size - intersection
  return union === 0 ? 0 : intersection / union
}

export const FUZZY_TITLE_THRESHOLD = 0.82

/**
 * Zoekt het bestaande product dat bij een kandidaat hoort.
 * Geeft null wanneer de kandidaat nieuw is (of een aparte variant).
 */
export function findDuplicate(
  candidate: DedupeCandidate,
  existing: readonly DedupeCandidate[],
): DedupeMatch | null {
  const candidateEan = normalizeIdentifier(candidate.ean)
  if (candidateEan) {
    const match = existing.find((item) => normalizeIdentifier(item.ean) === candidateEan)
    if (match) return { match, strategy: 'ean', confidence: 1 }
  }

  const candidateBrand = normalizeIdentifier(candidate.brand)
  const candidateModel = normalizeIdentifier(candidate.model)
  if (candidateBrand && candidateModel) {
    const match = existing.find(
      (item) =>
        normalizeIdentifier(item.brand) === candidateBrand &&
        normalizeIdentifier(item.model) === candidateModel,
    )
    if (match) return { match, strategy: 'brand-model', confidence: 0.97 }
  }

  const candidateExternalId = normalizeIdentifier(candidate.externalId)
  if (candidateExternalId) {
    const match = existing.find(
      (item) =>
        item.merchantSlug === candidate.merchantSlug &&
        normalizeIdentifier(item.externalId) === candidateExternalId,
    )
    if (match) return { match, strategy: 'merchant-external-id', confidence: 0.95 }
  }

  const candidateNormalized = normalizeTitle(candidate.title)
  const candidateVariant = variantSignature(candidate.title)
  if (candidateNormalized.length > 0) {
    const match = existing.find(
      (item) =>
        normalizeTitle(item.title) === candidateNormalized &&
        variantSignature(item.title) === candidateVariant,
    )
    if (match) return { match, strategy: 'normalized-title', confidence: 0.9 }
  }

  let best: DedupeMatch | null = null
  for (const item of existing) {
    if (variantSignature(item.title) !== candidateVariant) continue
    const similarity = titleSimilarity(candidate.title, item.title)
    if (similarity >= FUZZY_TITLE_THRESHOLD && (best === null || similarity > best.confidence)) {
      best = { match: item, strategy: 'fuzzy-title', confidence: similarity }
    }
  }
  return best
}

/** Groepeert een batch kandidaten; handig voor ingest van één feed. */
export function dedupeBatch(candidates: readonly DedupeCandidate[]): {
  unique: DedupeCandidate[]
  duplicates: Array<{ candidate: DedupeCandidate; match: DedupeMatch }>
} {
  const unique: DedupeCandidate[] = []
  const duplicates: Array<{ candidate: DedupeCandidate; match: DedupeMatch }> = []
  for (const candidate of candidates) {
    const match = findDuplicate(candidate, unique)
    if (match) duplicates.push({ candidate, match })
    else unique.push(candidate)
  }
  return { unique, duplicates }
}
