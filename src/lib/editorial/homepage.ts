import type { ProductCardView } from '@/types'

/**
 * Samenstellen van de homepage.
 *
 * De homepage moet gevuld zijn (standaard 32 tot 40 productplaatsingen) zonder
 * dat het een lijst dubbele kaarten wordt. Eén regel bepaalt dat: een product
 * mag in meerdere inhoudelijk relevante secties staan, maar niet twee keer vlak
 * na elkaar. Zo blijft een sterk product zichtbaar in zowel "beste deals" als
 * zijn eigen thema, terwijl je nooit dezelfde kaart twee keer achter elkaar ziet.
 *
 * Deze functie is puur: dezelfde input geeft dezelfde homepage.
 */
export type HomepageSectionInput = {
  key: string
  title: string
  description?: string
  /** Waar de klik vandaan komt; wordt het subid van de affiliate-link. */
  surface: string
  products: readonly ProductCardView[]
  /** Maximaal aantal kaarten in deze sectie. */
  limit: number
  /** Onder dit aantal wordt de sectie helemaal weggelaten. */
  minimum?: number
  href?: string
  linkLabel?: string
}

export type HomepageSection = {
  key: string
  title: string
  description?: string
  surface: string
  products: ProductCardView[]
  href?: string
  linkLabel?: string
}

export type HomepageComposition = {
  sections: HomepageSection[]
  /** Totaal aantal productplaatsingen, de hero meegerekend. */
  placements: number
  /** Haalt de homepage het ingestelde minimum? */
  meetsMinimum: boolean
  /** Aantal unieke producten; handig voor het launchdashboard. */
  uniqueProducts: number
}

export type HomepageLimits = { min: number; max: number }

export const DEFAULT_HOMEPAGE_LIMITS: HomepageLimits = { min: 32, max: 40 }

export function composeHomepage(
  sections: readonly HomepageSectionInput[],
  options: { heroProductId?: string | null; limits?: HomepageLimits } = {},
): HomepageComposition {
  const limits = options.limits ?? DEFAULT_HOMEPAGE_LIMITS
  const result: HomepageSection[] = []
  const unique = new Set<string>()
  // De hero telt als plaatsing en als "vorige sectie", zodat het heroproduct
  // niet direct daaronder nog eens opduikt.
  let previousIds = new Set<string>(options.heroProductId ? [options.heroProductId] : [])
  let placements = options.heroProductId ? 1 : 0

  for (const section of sections) {
    if (placements >= limits.max) break
    const room = limits.max - placements
    const chosen: ProductCardView[] = []
    const seenInSection = new Set<string>()

    for (const product of section.products) {
      if (chosen.length >= Math.min(section.limit, room)) break
      // Niet twee keer vlak na elkaar, en niet twee keer in dezelfde sectie.
      if (previousIds.has(product.id) || seenInSection.has(product.id)) continue
      chosen.push(product)
      seenInSection.add(product.id)
    }

    if (chosen.length < (section.minimum ?? 1)) continue

    result.push({
      key: section.key,
      title: section.title,
      ...(section.description ? { description: section.description } : {}),
      surface: section.surface,
      products: chosen,
      ...(section.href ? { href: section.href } : {}),
      ...(section.linkLabel ? { linkLabel: section.linkLabel } : {}),
    })
    for (const product of chosen) unique.add(product.id)
    placements += chosen.length
    previousIds = seenInSection
  }

  return {
    sections: result,
    placements,
    meetsMinimum: placements >= limits.min,
    uniqueProducts: unique.size,
  }
}
