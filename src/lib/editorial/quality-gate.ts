import type {
  EditorialPageType,
  ExperienceType,
  ImageStatus,
  ProductStatus,
  PublicationStatus,
  SearchIntent,
  VerificationStatus,
} from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { checkFeaturedProduct } from '@/lib/editorial/featured'
import { STALE_AFTER_MS } from '@/lib/pricing/deal'
import type { OverlapVerdict } from '@/lib/editorial/overlap'

/**
 * IndexabilityQualityGate.
 *
 * Publiek browsebaar en indexeerbaar zijn twee verschillende dingen. Een pagina
 * die niet door deze poort komt blijft gewoon bereikbaar, maar krijgt
 * `noindex, follow`: liever een kleine, kloppende index dan veel dunne pagina's.
 *
 * De poort geeft altijd redenen terug, zodat de admin kan uitleggen wat er nog
 * moet gebeuren.
 */
export type IndexabilityVerdict =
  | { indexable: true; reasons: [] }
  | { indexable: false; reasons: string[] }

/** Hoe oud een gecontroleerde prijs op een redactionele pagina mag zijn. */
export const EDITORIAL_PRICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type EditorialGateProduct = {
  productId: string
  status: ProductStatus
  imageStatus: ImageStatus
  /** Heeft dit product een actieve, niet-verouderde aanbieding? */
  hasActiveOffer: boolean
  /** Laatste prijscontrole; null wanneer er geen aanbieding is. */
  priceCheckedAt: Date | null
  currentPriceCents: number | null
  role: 'SELECTED' | 'ALTERNATIVE'
  caveat: string | null
  exceedsBudget: boolean
  budgetNote: string | null
}

export type EditorialGateCriterionValue = {
  productId: string
  criterionName: string
  value: string | null
  verificationStatus: VerificationStatus
  hasSource: boolean
  sourceRequired: boolean
}

export type EditorialGateInput = {
  type: EditorialPageType
  status: PublicationStatus
  primaryQuery: string
  searchIntent: SearchIntent | null
  introduction: string
  methodology: string | null
  selectionCriteria: string | null
  seoTitle: string
  metaDescription: string
  /** Zijn SEO-title en meta description uniek binnen de site? */
  seoTitleUnique: boolean
  metaDescriptionUnique: boolean
  reviewedAt: Date | null
  /** Inhoudelijke controle door een mens; nodig bij gegenereerde tekst. */
  humanReviewedAt?: Date | null
  /** Provider van de tekst; leeg betekent door een mens geschreven. */
  generationProvider?: string | null
  lastFactCheckedAt: Date | null
  budgetMinCents: number | null
  budgetMaxCents: number | null
  heroImageValid: boolean
  products: readonly EditorialGateProduct[]
  criterionNames: readonly string[]
  criterionValues: readonly EditorialGateCriterionValue[]
  sourceCount: number
  /** Bronnen die wij niet mogen gebruiken; blokkeren indexering. */
  disallowedSourceCount: number
  featured: {
    productId: string | null
    label: string | null
    reason: string | null
    caveat: string | null
    alternativeNote: string | null
  }
  overlap: OverlapVerdict | null
  /** Is de pagina vanuit minimaal één cluster of categorie bereikbaar? */
  hasInboundLink: boolean
  now?: Date
}

export function evaluateEditorialIndexability(input: EditorialGateInput): IndexabilityVerdict {
  const now = input.now ?? new Date()
  const archetype = archetypeFor(input.type)
  const reasons: string[] = []

  if (input.status !== 'PUBLISHED') reasons.push(`status is ${input.status}, niet PUBLISHED`)
  if (!input.reviewedAt) reasons.push('redactionele review is nog niet afgerond')
  // Gegenereerde tekst is pas indexeerbaar nadat een mens haar inhoudelijk heeft
  // gecontroleerd.
  if ((input.generationProvider ?? '').length > 0 && !input.humanReviewedAt) {
    reasons.push('gegenereerde tekst is nog niet door een mens gecontroleerd')
  }
  if (input.primaryQuery.trim().length < 8) reasons.push('primaryQuery ontbreekt of is te kort')
  if (!input.searchIntent) reasons.push('searchIntent is niet gekozen')
  if (input.introduction.trim().length < 200) reasons.push('introductie is te kort voor een eigen pagina')
  if (archetype.requiresMethodology && (input.methodology ?? '').trim().length < 80) {
    reasons.push(`${archetype.label} vraagt een methodologie`)
  }
  if (archetype.requiresBudget && input.budgetMaxCents === null) {
    reasons.push(`${archetype.label} vraagt een expliciete budgetgrens`)
  }

  const selected = input.products.filter((product) => product.role === 'SELECTED')
  const alternatives = input.products.filter((product) => product.role === 'ALTERNATIVE')

  if (selected.length < archetype.minProducts) {
    reasons.push(`minimaal ${archetype.minProducts} producten nodig, nu ${selected.length}`)
  }

  const unpublished = selected.filter((product) => product.status !== 'PUBLISHED')
  if (unpublished.length > 0) {
    reasons.push(`${unpublished.length} geselecteerd product(en) zijn niet PUBLISHED`)
  }
  const brokenImages = selected.filter((product) => product.imageStatus !== 'VALID')
  if (brokenImages.length > 0) {
    reasons.push(`${brokenImages.length} product(en) hebben geen geldige afbeelding`)
  }
  const withoutOffer = selected.filter((product) => !product.hasActiveOffer)
  if (withoutOffer.length > 0) {
    reasons.push(`${withoutOffer.length} product(en) hebben geen actieve aanbieding`)
  }
  const stalePrices = selected.filter(
    (product) =>
      product.priceCheckedAt === null ||
      now.getTime() - product.priceCheckedAt.getTime() > EDITORIAL_PRICE_MAX_AGE_MS,
  )
  if (stalePrices.length > 0) {
    reasons.push(`${stalePrices.length} product(en) hebben een te oude prijscontrole`)
  }

  if (archetype.requiresPerProductCaveat) {
    const withoutCaveat = selected.filter((product) => (product.caveat ?? '').trim().length < 10)
    if (withoutCaveat.length > 0) {
      reasons.push(`${withoutCaveat.length} product(en) missen een aandachtspunt`)
    }
  }

  if (archetype.minCriteria > 0) {
    if (input.criterionNames.length < archetype.minCriteria) {
      reasons.push(
        `minimaal ${archetype.minCriteria} vergelijkingscriteria nodig, nu ${input.criterionNames.length}`,
      )
    }
    // Elk geselecteerd product moet per criterium een gecontroleerde waarde of
    // een expliciet "niet opgegeven" hebben. Leeg is niet hetzelfde als bekend.
    const unverified = input.criterionValues.filter(
      (value) => value.verificationStatus === 'UNVERIFIED',
    )
    if (unverified.length > 0) {
      reasons.push(`${unverified.length} criteriumwaarde(n) zijn nog niet gecontroleerd`)
    }
    const missingSource = input.criterionValues.filter(
      (value) =>
        value.sourceRequired && value.verificationStatus === 'VERIFIED' && !value.hasSource,
    )
    if (missingSource.length > 0) {
      reasons.push(`${missingSource.length} gecontroleerde waarde(n) missen een bron`)
    }
    const expected = selected.length * input.criterionNames.length
    const present = input.criterionValues.filter((value) =>
      selected.some((product) => product.productId === value.productId),
    ).length
    if (present < expected) {
      reasons.push(`${expected - present} criteriumwaarde(n) zijn nog niet ingevuld`)
    }
  }

  if (input.budgetMaxCents !== null) {
    const overBudget = selected.filter(
      (product) =>
        product.currentPriceCents !== null &&
        product.currentPriceCents > input.budgetMaxCents! &&
        !(product.exceedsBudget && (product.budgetNote ?? '').trim().length >= 10),
    )
    if (overBudget.length > 0) {
      reasons.push(`${overBudget.length} product(en) liggen boven het budget zonder uitleg`)
    }
  }

  if (input.sourceCount === 0) reasons.push('er zijn geen bronnen vastgelegd')
  if (input.disallowedSourceCount > 0) {
    reasons.push(`${input.disallowedSourceCount} bron(nen) mogen wij niet gebruiken`)
  }
  if (!input.lastFactCheckedAt) reasons.push('nog geen fact-check uitgevoerd')

  const featuredProblems = checkFeaturedProduct({
    pageType: input.type,
    productId: input.featured.productId,
    label: input.featured.label,
    reason: input.featured.reason,
    caveat: input.featured.caveat,
    alternativeNote: input.featured.alternativeNote,
    verifiedCriteriaCount: input.criterionValues.filter(
      (value) =>
        value.productId === input.featured.productId && value.verificationStatus === 'VERIFIED',
    ).length,
    hasAudienceOrUseCase: (input.featured.reason ?? '').trim().length > 0,
    hasMethodology: (input.methodology ?? '').trim().length >= 80,
    alternativeCount: alternatives.length,
  })
  for (const problem of featuredProblems) {
    reasons.push(`uitgelicht product: ${problem.message}`)
  }

  if (!input.seoTitleUnique) reasons.push('SEO-title is niet uniek')
  if (!input.metaDescriptionUnique) reasons.push('meta description is niet uniek')
  if (input.seoTitle.trim().length < 15) reasons.push('SEO-title ontbreekt')
  if (input.metaDescription.trim().length < 50) reasons.push('meta description ontbreekt')

  if (input.overlap && input.overlap.level === 'block') {
    reasons.push(`sterke overlap met bestaande content (${input.overlap.reasons.join('; ')})`)
  }
  if (!input.hasInboundLink) {
    reasons.push('geen interne link naar deze pagina; een verweesde pagina wordt niet geïndexeerd')
  }

  return reasons.length === 0 ? { indexable: true, reasons: [] } : { indexable: false, reasons }
}

export type ProductGateInput = {
  status: ProductStatus
  imageStatus: ImageStatus
  hasEditorial: boolean
  editorialReviewedAt: Date | null
  /**
   * Moment waarop een mens de tekst inhoudelijk controleerde. Machinegegenereerde
   * tekst is zonder deze datum nooit indexeerbaar.
   */
  humanReviewedAt?: Date | null
  /** Provider van de tekst; `null` of "handmatig" betekent door een mens geschreven. */
  generationProvider?: string | null
  activeOfferCount: number
  /** Aantal gecontroleerde specificaties uit brondata. */
  specificationCount: number
  /** Aantal eigen prijsmetingen; onze analyse is eigen inhoud. */
  observedPriceCount: number
  /** Lengte van de eigen redactionele tekst. */
  ownTextLength: number
  /** Lengte van de overgenomen omschrijving van de aanbieder. */
  sourceTextLength: number
  experienceType: ExperienceType
  isDemo: boolean
  demoContentEnabled: boolean
  /** Bereikbaar vanuit een categorie? */
  hasCategoryLink: boolean
  /** Bereikbaar vanuit een cluster? */
  hasClusterLink: boolean
}

/**
 * Wanneer mag een productpagina in de index? Bovenop de publieke
 * zichtbaarheidsregels (zie src/lib/products/visibility.ts) vraagt indexering
 * eigen inhoud: gecontroleerde specificaties of onze eigen prijsanalyse, en
 * geen pagina die vooral uit merchanttekst bestaat.
 */
export function evaluateProductIndexability(input: ProductGateInput): IndexabilityVerdict {
  const reasons: string[] = []

  if (input.status !== 'PUBLISHED') reasons.push(`status is ${input.status}, niet PUBLISHED`)
  if (input.imageStatus !== 'VALID') reasons.push(`afbeelding is ${input.imageStatus}, niet VALID`)
  if (!input.hasEditorial) reasons.push('geen redactionele content')
  if (input.hasEditorial && !input.editorialReviewedAt) {
    reasons.push('redactionele content is nog niet beoordeeld')
  }
  // Geen indexeerbare tekst die niet inhoudelijk door een mens is gecontroleerd.
  // Handmatig geschreven tekst heeft geen provider en valt hier dus buiten.
  const machineWritten =
    (input.generationProvider ?? '').length > 0 && input.generationProvider !== 'handmatig'
  if (input.hasEditorial && machineWritten && !input.humanReviewedAt) {
    reasons.push('gegenereerde tekst is nog niet door een mens gecontroleerd')
  }
  if (input.activeOfferCount < 1) reasons.push('geen actieve aanbieding')
  if (input.specificationCount === 0 && input.observedPriceCount < 2) {
    reasons.push('geen gecontroleerde specificaties en geen eigen prijshistorie')
  }
  // Een pagina die vooral leverancierstekst is, voegt niets toe aan de index.
  if (input.sourceTextLength > 0 && input.ownTextLength < input.sourceTextLength * 1.5) {
    reasons.push('pagina bestaat voornamelijk uit overgenomen merchanttekst')
  }
  if (input.isDemo && !input.demoContentEnabled) reasons.push('demo-inhoud staat uit')
  if (input.isDemo) reasons.push('demo-inhoud wordt nooit geïndexeerd')
  if (!input.hasCategoryLink) reasons.push('niet bereikbaar vanuit een categorie')
  if (!input.hasClusterLink) reasons.push('niet bereikbaar vanuit een cluster')

  return reasons.length === 0 ? { indexable: true, reasons: [] } : { indexable: false, reasons }
}

/** Is een aanbieding vers genoeg om als "actief" te gelden? */
export function offerIsFresh(checkedAt: Date | null, now: Date = new Date()): boolean {
  if (!checkedAt) return false
  return now.getTime() - checkedAt.getTime() <= STALE_AFTER_MS
}
