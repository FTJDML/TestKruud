import type { InternalLinkTargetType } from '@prisma/client'

/**
 * Interne links.
 *
 * Suggesties worden automatisch berekend, maar verschijnen pas op de site na
 * redactionele goedkeuring. Zo blijft de linkstructuur een redactionele keuze en
 * geen automatisch web van dunne verwijzingen.
 *
 * Daarnaast controleert deze module verweesde pagina's: een indexeerbare pagina
 * zonder enkele interne link is voor een bezoeker onvindbaar en hoort niet in de
 * index.
 */
export type LinkRef = { type: InternalLinkTargetType; ref: string }

export type LinkSuggestion = {
  from: LinkRef
  to: LinkRef
  anchorText: string
  reason: string
}

export type SuggestionInput = {
  clusters: ReadonlyArray<{
    slug: string
    title: string
    categorySlugs: readonly string[]
    /** Ids van gepubliceerde redactionele pagina's in dit cluster. */
    editorialPageIds: readonly string[]
  }>
  editorialPages: ReadonlyArray<{
    id: string
    slug: string
    title: string
    type: string
    clusterId: string | null
    clusterSlug: string | null
    primaryQuery: string
    /** Geselecteerde producten. */
    productIds: readonly string[]
    /** Alternatieven; die krijgen een eigen suggestie. */
    alternativeProductIds: readonly string[]
    budgetMaxCents: number | null
    categorySlugs: readonly string[]
  }>
  products: ReadonlyArray<{
    id: string
    slug: string
    title: string
    categorySlug: string
  }>
}

/**
 * Berekent de suggesties uit de bestaande structuur. Er wordt niets verzonnen:
 * elke suggestie volgt uit een relatie die al in de database staat.
 */
export function suggestInternalLinks(input: SuggestionInput): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = []
  const seen = new Set<string>()

  const add = (suggestion: LinkSuggestion): void => {
    const key = `${suggestion.from.type}:${suggestion.from.ref}->${suggestion.to.type}:${suggestion.to.ref}`
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push(suggestion)
  }

  const productById = new Map(input.products.map((product) => [product.id, product]))

  for (const cluster of input.clusters) {
    for (const pageId of cluster.editorialPageIds) {
      const page = input.editorialPages.find((entry) => entry.id === pageId)
      if (!page) continue
      // cluster -> nichepagina
      add({
        from: { type: 'CLUSTER', ref: cluster.slug },
        to: { type: 'EDITORIAL_PAGE', ref: page.slug },
        anchorText: page.title,
        reason: `${page.title} hoort bij het cluster ${cluster.title}`,
      })
    }
  }

  for (const page of input.editorialPages) {
    // nichepagina -> geselecteerde producten
    for (const productId of page.productIds) {
      const product = productById.get(productId)
      if (!product) continue
      add({
        from: { type: 'EDITORIAL_PAGE', ref: page.slug },
        to: { type: 'PRODUCT', ref: product.slug },
        anchorText: product.title,
        reason: `${product.title} staat in de selectie van deze pagina`,
      })
      // product -> relevante vergelijking
      add({
        from: { type: 'PRODUCT', ref: product.slug },
        to: { type: 'EDITORIAL_PAGE', ref: page.slug },
        anchorText: page.title,
        reason: `dit product is opgenomen in ${page.title}`,
      })
    }

    // product -> alternatieven
    for (const productId of page.productIds) {
      const product = productById.get(productId)
      if (!product) continue
      for (const alternativeId of page.alternativeProductIds) {
        const alternative = productById.get(alternativeId)
        if (!alternative || alternative.id === product.id) continue
        add({
          from: { type: 'PRODUCT', ref: product.slug },
          to: { type: 'PRODUCT', ref: alternative.slug },
          anchorText: alternative.title,
          reason: `${alternative.title} is op ${page.title} als alternatief opgenomen`,
        })
      }
    }

    // categorie -> budgetguide
    if (page.budgetMaxCents !== null) {
      for (const categorySlug of page.categorySlugs) {
        add({
          from: { type: 'CATEGORY', ref: categorySlug },
          to: { type: 'EDITORIAL_PAGE', ref: page.slug },
          anchorText: page.title,
          reason: 'budgetgids met een duidelijke prijsgrens binnen deze categorie',
        })
      }
    }

    // cadeaupagina -> gerelateerde productpagina's
    if (page.type === 'GIFT_GUIDE') {
      for (const productId of [...page.productIds, ...page.alternativeProductIds]) {
        const product = productById.get(productId)
        if (!product) continue
        add({
          from: { type: 'EDITORIAL_PAGE', ref: page.slug },
          to: { type: 'PRODUCT', ref: product.slug },
          anchorText: product.title,
          reason: 'cadeaugids verwijst naar de productpagina met de actuele prijs',
        })
      }
    }
  }

  return suggestions
}

export type OrphanCheckInput = {
  /** Slug van de pagina die wordt gecontroleerd. */
  ref: string
  type: InternalLinkTargetType
  /** Goedgekeurde links naar deze pagina. */
  approvedInboundLinks: ReadonlyArray<{ fromType: InternalLinkTargetType }>
  /** Staat het product in een categorie die publiek bereikbaar is? */
  inCategory: boolean
  /** Hoort het product bij een zichtbaar cluster? */
  inCluster: boolean
  /** Staat het product op minimaal één gepubliceerde redactionele pagina? */
  onEditorialPage: boolean
}

export type OrphanVerdict = { orphan: boolean; reasons: string[] }

/**
 * Een indexeerbare productpagina moet vanuit een categorie én een cluster
 * bereikbaar zijn, en waar mogelijk vanuit een redactionele pagina. Voor
 * redactionele pagina's geldt: minimaal één goedgekeurde inkomende link.
 */
export function checkOrphan(input: OrphanCheckInput): OrphanVerdict {
  const reasons: string[] = []
  if (input.type === 'PRODUCT') {
    if (!input.inCategory) reasons.push('niet bereikbaar vanuit een categorie')
    if (!input.inCluster) reasons.push('niet bereikbaar vanuit een cluster')
    // Een redactionele pagina is wenselijk maar niet altijd haalbaar; dat is
    // een advies en geen blokkade.
  } else if (input.approvedInboundLinks.length === 0) {
    reasons.push('geen goedgekeurde interne link naar deze pagina')
  }
  return { orphan: reasons.length > 0, reasons }
}

/** Adviesregel voor de admin: welke link ontbreekt er nog? */
export function orphanAdvice(input: OrphanCheckInput): string | null {
  const verdict = checkOrphan(input)
  if (!verdict.orphan && input.type === 'PRODUCT' && !input.onEditorialPage) {
    return 'nog niet opgenomen in een vergelijking of gids'
  }
  return verdict.orphan ? verdict.reasons.join('; ') : null
}
