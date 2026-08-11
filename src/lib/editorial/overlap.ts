/**
 * ContentOverlapService.
 *
 * Twee pagina's die dezelfde vraag beantwoorden met dezelfde producten helpen
 * niemand: ze concurreren met elkaar en verdunnen de site. Deze module vergelijkt
 * een nieuwe of gewijzigde pagina met de bestaande pagina's en geeft een advies:
 * doorgaan, waarschuwen, of blokkeren met een voorstel om samen te voegen of een
 * canonical te zetten.
 *
 * Er wordt niets automatisch samengevoegd of op noindex gezet: de redactie
 * beslist, deze service levert het bewijs.
 */
export type OverlapCandidate = {
  id: string
  slug: string
  title: string
  primaryQuery: string
  /** Ids van de geselecteerde producten. */
  productIds: readonly string[]
  introduction: string
  /** Tussenkoppen van de pagina; leeg mag. */
  headings?: readonly string[]
  indexable?: boolean
}

export type OverlapVerdict = {
  /** `ok` = geen bezwaar, `warn` = melden aan de redactie, `block` = niet publiceren. */
  level: 'ok' | 'warn' | 'block'
  /** Wat de redactie zou moeten doen. */
  recommendation: 'geen' | 'samenvoegen' | 'canonical' | 'noindex'
  matches: OverlapMatch[]
  reasons: string[]
}

export type OverlapMatch = {
  id: string
  slug: string
  title: string
  querySimilarity: number
  productOverlap: number
  textSimilarity: number
  /** Gecombineerde maat, gebruikt voor de drempels. */
  score: number
}

/** Boven deze waarde krijgt de redactie een waarschuwing. */
export const OVERLAP_WARN_THRESHOLD = 0.55
/** Boven deze waarde wordt een nieuwe pagina geblokkeerd. */
export const OVERLAP_BLOCK_THRESHOLD = 0.75

const stopWords = new Set([
  'de',
  'het',
  'een',
  'en',
  'of',
  'voor',
  'met',
  'van',
  'in',
  'op',
  'onder',
  'boven',
  'bij',
  'tot',
  'die',
  'dat',
  'je',
  'jouw',
  'we',
  'wij',
  'is',
  'zijn',
  'beste',
  'top',
  'per',
  'aan',
  'als',
  'ook',
  'naar',
])

/** Woorden zonder ruis: kleine letters, geen leestekens, geen stopwoorden. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9€\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
}

/** Jaccard-overeenkomst tussen twee verzamelingen woorden. */
export function jaccard(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left)
  const b = new Set(right)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const value of a) if (b.has(value)) shared += 1
  return shared / (a.size + b.size - shared)
}

/** Overlap tussen twee productselecties; 1 betekent dezelfde producten. */
export function productOverlap(left: readonly string[], right: readonly string[]): number {
  return jaccard(left, right)
}

/**
 * Tekstovereenkomst op woordparen. Twee intro's met dezelfde zinnen komen hier
 * hoog uit, ook wanneer een enkel woord is vervangen.
 */
export function textSimilarity(left: string, right: string): number {
  const bigrams = (text: string): string[] => {
    const words = tokenize(text)
    return words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`)
  }
  const leftPairs = bigrams(left)
  const rightPairs = bigrams(right)
  if (leftPairs.length === 0 || rightPairs.length === 0) return jaccard(tokenize(left), tokenize(right))
  return jaccard(leftPairs, rightPairs)
}

function combined(query: number, products: number, text: number): number {
  // De vraag weegt het zwaarst: twee pagina's die dezelfde vraag beantwoorden
  // concurreren, ook wanneer de producten deels verschillen.
  return query * 0.5 + products * 0.3 + text * 0.2
}

/**
 * Vergelijkt één pagina met bestaande pagina's. De pagina zelf wordt op id
 * overgeslagen, zodat een bestaande pagina niet met zichzelf botst.
 */
export function checkOverlap(
  candidate: OverlapCandidate,
  existing: readonly OverlapCandidate[],
): OverlapVerdict {
  const candidateQuery = tokenize(candidate.primaryQuery)
  const matches: OverlapMatch[] = []

  for (const other of existing) {
    if (other.id === candidate.id) continue
    const querySimilarity = jaccard(candidateQuery, tokenize(other.primaryQuery))
    const overlap = productOverlap(candidate.productIds, other.productIds)
    const text = textSimilarity(
      [candidate.introduction, ...(candidate.headings ?? [])].join(' '),
      [other.introduction, ...(other.headings ?? [])].join(' '),
    )
    const score = combined(querySimilarity, overlap, text)
    if (score >= OVERLAP_WARN_THRESHOLD * 0.6) {
      matches.push({
        id: other.id,
        slug: other.slug,
        title: other.title,
        querySimilarity,
        productOverlap: overlap,
        textSimilarity: text,
        score,
      })
    }
  }

  matches.sort((left, right) => right.score - left.score)
  const worst = matches[0]
  if (!worst) return { level: 'ok', recommendation: 'geen', matches: [], reasons: [] }

  const reasons: string[] = []
  if (worst.querySimilarity >= 0.6) {
    reasons.push(`primaryQuery lijkt sterk op "${worst.title}" (${Math.round(worst.querySimilarity * 100)}%)`)
  }
  if (worst.productOverlap >= 0.6) {
    reasons.push(`bijna dezelfde producten als "${worst.title}" (${Math.round(worst.productOverlap * 100)}%)`)
  }
  if (worst.textSimilarity >= 0.5) {
    reasons.push(`introductie en koppen lijken op "${worst.title}"`)
  }

  // Twee pagina's die vrijwel dezelfde vraag beantwoorden concurreren met
  // elkaar, ook wanneer de producten verschillen: dat is precies waar
  // cannibalisatie begint. Een hoge vraagovereenkomst weegt daarom apart.
  const nearIdenticalQuery = worst.querySimilarity >= 0.8
  if (nearIdenticalQuery && worst.productOverlap >= 0.6) {
    return {
      level: 'block',
      recommendation: worst.productOverlap >= 0.8 ? 'samenvoegen' : 'canonical',
      matches,
      reasons: reasons.length > 0 ? reasons : [`vrijwel dezelfde vraag als "${worst.title}"`],
    }
  }
  if (nearIdenticalQuery && worst.score < OVERLAP_WARN_THRESHOLD) {
    return {
      level: 'warn',
      recommendation: 'canonical',
      matches,
      reasons: [
        `primaryQuery lijkt sterk op "${worst.title}" (${Math.round(worst.querySimilarity * 100)}%), terwijl de selectie verschilt`,
      ],
    }
  }

  if (worst.score >= OVERLAP_BLOCK_THRESHOLD) {
    return {
      level: 'block',
      // Vrijwel identieke selectie én vraag: samenvoegen is dan het eerlijke
      // antwoord. Verschilt de selectie wél, dan is een canonical genoeg.
      recommendation: worst.productOverlap >= 0.8 ? 'samenvoegen' : 'canonical',
      matches,
      reasons: reasons.length > 0 ? reasons : [`sterke overlap met "${worst.title}"`],
    }
  }
  if (worst.score >= OVERLAP_WARN_THRESHOLD) {
    return {
      level: 'warn',
      recommendation: worst.productOverlap >= 0.8 ? 'samenvoegen' : 'noindex',
      matches,
      reasons: reasons.length > 0 ? reasons : [`mogelijke overlap met "${worst.title}"`],
    }
  }
  return { level: 'ok', recommendation: 'geen', matches, reasons: [] }
}

/**
 * Groepeert pagina's die onderling te veel overlappen. Wordt gebruikt door het
 * launchdashboard om te laten zien welke pagina's met elkaar concurreren.
 */
export function overlappingGroups(pages: readonly OverlapCandidate[]): Array<{
  pages: OverlapCandidate[]
  score: number
}> {
  const groups: Array<{ pages: OverlapCandidate[]; score: number }> = []
  const claimed = new Set<string>()

  for (const page of pages) {
    if (claimed.has(page.id)) continue
    const verdict = checkOverlap(page, pages)
    const strong = verdict.matches.filter((match) => match.score >= OVERLAP_WARN_THRESHOLD)
    if (strong.length === 0) continue
    const group = [page, ...strong.map((match) => pages.find((entry) => entry.id === match.id)!)]
    for (const entry of group) claimed.add(entry.id)
    groups.push({ pages: group, score: strong[0]!.score })
  }
  return groups.sort((left, right) => right.score - left.score)
}
