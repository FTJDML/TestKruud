import type { EditionSection } from '@prisma/client'
import { normalizeTitle, titleSimilarity } from '@/lib/deals/dedupe'
import { compositeScore, type ScoreInput } from '@/lib/deals/score'

/** Maximaal aantal producten per categorie in één editie. */
export const MAX_PER_CATEGORY = 4
/** Maximaal aantal producten per merchant in één editie. */
export const MAX_PER_MERCHANT = 3
/** Minimaal aantal aanvullende producten naast de hero. */
export const MIN_ADDITIONAL_ITEMS = 16
/** Prijsgrens (in centen) voor de sectie "Slimmer wonen onder €100". */
export const UNDER_100_LIMIT_CENTS = 100_00

export type EditionCandidate = {
  productId: string
  offerId: string
  merchantId: string
  category: string
  title: string
  priceCents: number
  isUnnecessaryButGreat: boolean
  /** Alleen deals met een geldige referentieprijs mogen in de dagfeed. */
  qualifiesAsDeal: boolean
  score: ScoreInput
}

export type SelectedEditionItem = {
  productId: string
  offerId: string
  merchantId: string
  category: string
  section: EditionSection
  position: number
  score: number
}

export type EditionSelection = {
  hero: SelectedEditionItem | null
  items: SelectedEditionItem[]
  /** Redenen waarom kandidaten zijn overgeslagen; handig voor joblogging. */
  skipped: Array<{ productId: string; reason: string }>
}

const SECTION_ORDER: readonly EditionSection[] = [
  'TODAY',
  'EDITORS_PICK',
  'UNDER_100',
  'UNNECESSARY_BUT_GREAT',
]

const SECTION_TARGETS: Record<EditionSection, number> = {
  HERO: 1,
  TODAY: 8,
  EDITORS_PICK: 4,
  UNDER_100: 4,
  UNNECESSARY_BUT_GREAT: 4,
}

/**
 * Drempel voor "bijna identiek" binnen één editie. Lager dan de dedupe-drempel:
 * hier willen we ook kleurvarianten en sterk verwante producten uit elkaar
 * houden, zonder de onderliggende producten samen te voegen.
 */
export const NEAR_DUPLICATE_THRESHOLD = 0.7

function isNearDuplicate(candidate: EditionCandidate, chosen: readonly EditionCandidate[]): boolean {
  // normalizeTitle verwijdert kleuren en maten, dus kleurvarianten van hetzelfde
  // product komen hier op dezelfde genormaliseerde titel uit.
  const normalized = normalizeTitle(candidate.title)
  return chosen.some(
    (item) =>
      normalizeTitle(item.title) === normalized ||
      titleSimilarity(item.title, candidate.title) >= NEAR_DUPLICATE_THRESHOLD,
  )
}

function sectionFor(candidate: EditionCandidate, counts: Map<EditionSection, number>): EditionSection {
  const preferred: EditionSection[] = []
  if (candidate.isUnnecessaryButGreat) preferred.push('UNNECESSARY_BUT_GREAT')
  if (candidate.priceCents <= UNDER_100_LIMIT_CENTS) preferred.push('UNDER_100')
  preferred.push('TODAY', 'EDITORS_PICK')

  for (const section of preferred) {
    if ((counts.get(section) ?? 0) < SECTION_TARGETS[section]) return section
  }
  // Alles vol: kies de sectie met de minste items zodat niets verloren gaat.
  return SECTION_ORDER.reduce((least, section) =>
    (counts.get(section) ?? 0) < (counts.get(least) ?? 0) ? section : least,
  )
}

/**
 * Stelt één dagelijkse editie samen: één hero plus minimaal 16 aanvullende
 * producten, met harde grenzen per categorie en merchant.
 */
export function selectEdition(
  candidates: readonly EditionCandidate[],
  now: Date = new Date(),
): EditionSelection {
  const skipped: Array<{ productId: string; reason: string }> = []

  const scored = candidates
    .map((candidate) => ({
      candidate,
      total: compositeScore(candidate.score, now).total,
    }))
    .sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total
      // Stabiele tiebreaker zodat een refresh dezelfde editie oplevert.
      return left.candidate.productId.localeCompare(right.candidate.productId)
    })

  const eligible = scored.filter(({ candidate, total }) => {
    if (!candidate.qualifiesAsDeal) {
      skipped.push({ productId: candidate.productId, reason: 'geen geldige dealprijs' })
      return false
    }
    if (total <= 0) {
      skipped.push({ productId: candidate.productId, reason: 'score 0' })
      return false
    }
    return true
  })

  const perCategory = new Map<string, number>()
  const perMerchant = new Map<string, number>()
  const perSection = new Map<EditionSection, number>()
  const chosenCandidates: EditionCandidate[] = []
  const items: SelectedEditionItem[] = []
  let hero: SelectedEditionItem | null = null

  for (const { candidate, total } of eligible) {
    const categoryCount = perCategory.get(candidate.category) ?? 0
    const merchantCount = perMerchant.get(candidate.merchantId) ?? 0

    if (categoryCount >= MAX_PER_CATEGORY) {
      skipped.push({ productId: candidate.productId, reason: 'categorielimiet bereikt' })
      continue
    }
    if (merchantCount >= MAX_PER_MERCHANT) {
      skipped.push({ productId: candidate.productId, reason: 'merchantlimiet bereikt' })
      continue
    }
    if (isNearDuplicate(candidate, chosenCandidates)) {
      skipped.push({ productId: candidate.productId, reason: 'te vergelijkbaar met andere keuze' })
      continue
    }

    perCategory.set(candidate.category, categoryCount + 1)
    perMerchant.set(candidate.merchantId, merchantCount + 1)
    chosenCandidates.push(candidate)

    if (hero === null) {
      hero = {
        productId: candidate.productId,
        offerId: candidate.offerId,
        merchantId: candidate.merchantId,
        category: candidate.category,
        section: 'HERO',
        position: 0,
        score: total,
      }
      continue
    }

    const section = sectionFor(candidate, perSection)
    const position = perSection.get(section) ?? 0
    perSection.set(section, position + 1)
    items.push({
      productId: candidate.productId,
      offerId: candidate.offerId,
      merchantId: candidate.merchantId,
      category: candidate.category,
      section,
      position,
      score: total,
    })
  }

  return { hero, items, skipped }
}

/** Of een selectie genoeg vulling heeft om gepubliceerd te worden. */
export function isPublishableSelection(selection: EditionSelection): boolean {
  return selection.hero !== null && selection.items.length >= MIN_ADDITIONAL_ITEMS
}
