/** Kleine helpers zonder externe dependencies. */

/** Voegt classnames samen en filtert falsy waarden. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

/** Maakt een URL-veilige slug van Nederlandse tekst. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Zorgt voor unieke slugs binnen een set bestaande waarden. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const slug = slugify(base) || 'product'
  if (!taken.has(slug)) return slug
  let counter = 2
  while (taken.has(`${slug}-${counter}`)) counter += 1
  return `${slug}-${counter}`
}

/** Telt woorden; gebruikt voor contentregels (teaser 45-70 woorden). */
export function wordCount(input: string): number {
  const trimmed = input.trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

/** Kapt tekst netjes af op woordgrens. */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input
  const cut = input.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Deterministische shuffle-vrije chunk helper voor grids. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
