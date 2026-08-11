/**
 * Subid's (bij sommige netwerken clickref of subid1) laten later zien welke
 * plaatsing een klik opleverde: `home_hero`, `home_best_deals_3`,
 * `category_keuken_5`, `product_related_2`.
 *
 * Netwerken zijn streng over deze parameter. Daarom hier één plek die hem
 * opschoont: alleen kleine letters, cijfers en underscores, maximaal 40 tekens.
 * Dat voorkomt dat een categorienaam met een spatie of een accent een link
 * onbruikbaar maakt.
 */
export const MAX_SUBID_LENGTH = 40

export function safeSubId(raw: string | null | undefined, fallback = 'onbekend'): string {
  const cleaned = (raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    // Diakrieten verwijderen: "keuken & apparaten" wordt keuken_apparaten.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SUBID_LENGTH)
    .replace(/_+$/g, '')
  return cleaned.length > 0 ? cleaned : fallback
}

/** Bouwt een subid uit een plaatsing en een positie: `home_best_deals_3`. */
export function placementSubId(surface: string, position?: number | null): string {
  const base = safeSubId(surface, 'onbekend')
  if (position === null || position === undefined || !Number.isFinite(position)) return base
  const suffix = `_${Math.max(0, Math.trunc(position))}`
  return `${base.slice(0, MAX_SUBID_LENGTH - suffix.length)}${suffix}`
}
