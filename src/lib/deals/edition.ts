import type { EditionSection } from '@prisma/client'
import { normalizeTitle, titleSimilarity } from '@/lib/deals/dedupe'
import { compositeScore, type ScoreInput } from '@/lib/deals/score'

/**
 * Samenstellen van één dagelijkse editie.
 *
 * De grenzen zijn configureerbaar via de environment, zodat een groeiende
 * catalogus geen codewijziging vraagt. De standaarden hieronder zijn bewust
 * bescheiden: liever een kleine, kloppende editie dan een gevulde met zwakke
 * deals.
 */
export type EditionLimits = {
  maxPerCategory: number
  maxPerMerchant: number
  minAdditionalItems: number
  targetAdditionalItems: number
  maxAdditionalItems: number
}

export const DEFAULT_EDITION_LIMITS: EditionLimits = {
  maxPerCategory: 4,
  maxPerMerchant: 3,
  minAdditionalItems: 8,
  targetAdditionalItems: 16,
  maxAdditionalItems: 24,
}

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
  /** Alleen deals met een geldige referentieprijs mogen in een dealssectie. */
  qualifiesAsDeal: boolean
  /** Door ons gemeten prijsdaling; bepaalt de sectie LATEST_PRICE_DROPS. */
  dealDetectedAt?: Date | null
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

/**
 * Secties van de homepage-editie.
 *
 * `BEST_DEALS` en `LATEST_PRICE_DROPS` eisen een geldige deal. `DISCOVERY` is
 * voor bijzondere producten zonder referentieprijs: die tonen geen van-prijs,
 * geen kortingspercentage en de knop "Bekijk product", en tellen niet als
 * geverifieerde deal.
 */
export const DEAL_SECTIONS: readonly EditionSection[] = ['BEST_DEALS', 'LATEST_PRICE_DROPS']

const SECTION_ORDER: readonly EditionSection[] = [
  'BEST_DEALS',
  'LATEST_PRICE_DROPS',
  'EDITORS_PICK',
  'UNDER_100',
  'UNNECESSARY_BUT_GREAT',
  'DISCOVERY',
]

const SECTION_TARGETS: Record<EditionSection, number> = {
  HERO: 1,
  TODAY: 0,
  BEST_DEALS: 8,
  LATEST_PRICE_DROPS: 4,
  EDITORS_PICK: 4,
  UNDER_100: 4,
  UNNECESSARY_BUT_GREAT: 4,
  DISCOVERY: 4,
}

/** Een prijsdaling is "recent" tot twee dagen na de meting. */
const PRICE_DROP_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

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

function sectionFor(
  candidate: EditionCandidate,
  counts: Map<EditionSection, number>,
  now: Date,
): EditionSection {
  const preferred: EditionSection[] = []

  if (!candidate.qualifiesAsDeal) {
    // Zonder geldige deal alleen niet-dealsecties.
    if (candidate.isUnnecessaryButGreat) preferred.push('UNNECESSARY_BUT_GREAT')
    preferred.push('DISCOVERY', 'EDITORS_PICK')
  } else {
    const dropIsRecent =
      candidate.dealDetectedAt !== null &&
      candidate.dealDetectedAt !== undefined &&
      now.getTime() - candidate.dealDetectedAt.getTime() <= PRICE_DROP_WINDOW_MS
    if (dropIsRecent) preferred.push('LATEST_PRICE_DROPS')
    if (candidate.isUnnecessaryButGreat) preferred.push('UNNECESSARY_BUT_GREAT')
    if (candidate.priceCents <= UNDER_100_LIMIT_CENTS) preferred.push('UNDER_100')
    preferred.push('BEST_DEALS', 'EDITORS_PICK')
  }

  for (const section of preferred) {
    if ((counts.get(section) ?? 0) < SECTION_TARGETS[section]) return section
  }
  // Alles vol: kies uit de toegestane secties die met de minste items.
  const allowed = candidate.qualifiesAsDeal
    ? SECTION_ORDER
    : SECTION_ORDER.filter((section) => !DEAL_SECTIONS.includes(section))
  return allowed.reduce((least, section) =>
    (counts.get(section) ?? 0) < (counts.get(least) ?? 0) ? section : least,
  )
}

/**
 * Stelt één dagelijkse editie samen: één hero plus aanvullende producten, met
 * harde grenzen per categorie en merchant.
 *
 * De hero is altijd een geldige deal. Dat dezelfde uitstekende deal meerdere
 * dagen terugkomt is toegestaan: als de prijs het beste is wat wij kennen, is
 * hem verbergen om de afwisseling geen dienst aan de bezoeker.
 */
export function selectEdition(
  candidates: readonly EditionCandidate[],
  now: Date = new Date(),
  limits: EditionLimits = DEFAULT_EDITION_LIMITS,
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
    if (items.length >= limits.maxAdditionalItems && hero !== null) break

    const categoryCount = perCategory.get(candidate.category) ?? 0
    const merchantCount = perMerchant.get(candidate.merchantId) ?? 0

    if (categoryCount >= limits.maxPerCategory) {
      skipped.push({ productId: candidate.productId, reason: 'categorielimiet bereikt' })
      continue
    }
    if (merchantCount >= limits.maxPerMerchant) {
      skipped.push({ productId: candidate.productId, reason: 'merchantlimiet bereikt' })
      continue
    }
    if (isNearDuplicate(candidate, chosenCandidates)) {
      skipped.push({ productId: candidate.productId, reason: 'te vergelijkbaar met andere keuze' })
      continue
    }

    // De hero is de best scorende geldige deal; een DISCOVERY wordt nooit hero.
    if (hero === null) {
      if (!candidate.qualifiesAsDeal) {
        skipped.push({ productId: candidate.productId, reason: 'geen geldige dealprijs voor de hero' })
        continue
      }
      perCategory.set(candidate.category, categoryCount + 1)
      perMerchant.set(candidate.merchantId, merchantCount + 1)
      chosenCandidates.push(candidate)
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

    perCategory.set(candidate.category, categoryCount + 1)
    perMerchant.set(candidate.merchantId, merchantCount + 1)
    chosenCandidates.push(candidate)

    const section = sectionFor(candidate, perSection, now)
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
export function isPublishableSelection(
  selection: EditionSelection,
  limits: EditionLimits = DEFAULT_EDITION_LIMITS,
): boolean {
  return selection.hero !== null && selection.items.length >= limits.minAdditionalItems
}
