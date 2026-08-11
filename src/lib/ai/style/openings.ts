/**
 * Variatie in openingen.
 *
 * Elke tekst kiest één `openingStyle` die bij het product en de beschikbare
 * feiten past. Niet willekeurig: een prijsdaling opent met de prijs, een
 * cadeaugids met de reactie van de ontvanger, een vergelijking met een feit.
 *
 * Van elke publicatie bewaren wij de gekozen stijl en een hash van de
 * openingszin. Daarmee kunnen wij drie dingen voorkomen: dezelfde stijl meer dan
 * drie keer achter elkaar, sterk gelijkende openingszinnen binnen de laatste
 * twintig publicaties, en dezelfde grap of slotzin bij meerdere producten.
 */
export const openingStyles = [
  'PRICE_DROP',
  'RECOGNIZABLE_PROBLEM',
  'VISUAL_SURPRISE',
  'USE_CASE_SCENE',
  'GIFT_REACTION',
  'DESIGN_OBSERVATION',
  'PRACTICAL_DISCOVERY',
  'DRY_HUMOR',
  'DIRECT_FACT',
  'EDITORIAL_QUESTION',
] as const

export type OpeningStyle = (typeof openingStyles)[number]

/** Wat elke stijl doet; staat in de admin als hulptekst. */
export const openingStyleDescriptions: Record<OpeningStyle, string> = {
  PRICE_DROP: 'begin met de gemeten prijsdaling of het concrete prijsvoordeel',
  RECOGNIZABLE_PROBLEM: 'begin met het probleem dat de lezer herkent',
  VISUAL_SURPRISE: 'begin met wat je ziet en niet verwacht',
  USE_CASE_SCENE: 'begin met één concreet moment waarop je dit gebruikt',
  GIFT_REACTION: 'begin met de reactie van degene die het krijgt',
  DESIGN_OBSERVATION: 'begin met vorm, materiaal of hoe het in een ruimte staat',
  PRACTICAL_DISCOVERY: 'begin met het praktische nut dat je niet zocht',
  DRY_HUMOR: 'begin droog, zonder uitroepteken',
  DIRECT_FACT: 'begin met het feit dat het product bijzonder maakt',
  EDITORIAL_QUESTION: 'begin met een vraag die de tekst daarna beantwoordt',
}

/** Stijlen die niet bij een rustige, feitelijke tekst passen. */
const playfulStyles: readonly OpeningStyle[] = [
  'VISUAL_SURPRISE',
  'GIFT_REACTION',
  'DRY_HUMOR',
  'EDITORIAL_QUESTION',
]

export type OpeningContext = {
  /** Stabiele sleutel van de tekst: slug of id. Bepaalt de deterministische keuze. */
  key: string
  contentType: 'DISCOVERY' | 'DEAL' | 'COMPARISON' | 'DESIGN_COLLECTION' | 'GIFT_GUIDE' | 'GENERIC'
  /** Hebben wij zelf een prijsdaling gemeten? */
  hasMeasuredPriceDrop?: boolean
  /** Is er een aandachtspunt of probleem uit brondata? */
  hasKnownProblem?: boolean
  /** Gaat het om een cadeau? */
  isGift?: boolean
  /** Gaat het vooral over vorm en stijl? */
  isDesignLed?: boolean
  /** Is het product opvallend of ongebruikelijk? */
  isUnusual?: boolean
  /** Recent gebruikte stijlen, nieuwste eerst. */
  recentStyles?: readonly OpeningStyle[]
}

/** Hoe vaak dezelfde stijl achter elkaar mag voorkomen. */
export const MAX_CONSECUTIVE_STYLE = 3
/** Hoeveel publicaties terug wij openingszinnen vergelijken. */
export const OPENING_HISTORY_WINDOW = 20

/**
 * Kandidaten in lagen van geschiktheid. De bovenste laag past het best bij de
 * feiten die wij hebben: een gemeten prijsdaling opent met de prijs, een cadeau
 * met de reactie, een vergelijking met een feit. Binnen één laag zijn de opties
 * even geschikt; dáár mag de keuze deterministisch spreiden.
 *
 * Zo is de opening nooit willekeurig, en toch niet elke keer dezelfde.
 */
function tiersFor(context: OpeningContext): OpeningStyle[][] {
  const tiers: OpeningStyle[][] = []

  // Een gemeten prijsdaling is het sterkste signaal dat wij hebben.
  if (context.hasMeasuredPriceDrop) tiers.push(['PRICE_DROP'])
  if (context.contentType === 'DEAL') tiers.push(['PRICE_DROP'], ['DIRECT_FACT'])
  if (context.contentType === 'COMPARISON') tiers.push(['DIRECT_FACT', 'RECOGNIZABLE_PROBLEM'])
  if (context.contentType === 'GIFT_GUIDE' || context.isGift) {
    // Beide passen bij een cadeau; binnen de laag spreidt de sleutel.
    tiers.push(['GIFT_REACTION', 'USE_CASE_SCENE'])
  }
  if (context.contentType === 'DESIGN_COLLECTION' || context.isDesignLed) {
    // Eén stijl per categorie zou de hele categorie hetzelfde laten openen.
    tiers.push(['DESIGN_OBSERVATION', 'VISUAL_SURPRISE', 'DIRECT_FACT'])
  }
  if (context.contentType === 'DISCOVERY' || context.isUnusual) {
    tiers.push(['VISUAL_SURPRISE', 'EDITORIAL_QUESTION', 'DRY_HUMOR'])
  }
  if (context.hasKnownProblem) tiers.push(['RECOGNIZABLE_PROBLEM', 'PRACTICAL_DISCOVERY'])

  // Vangnet dat bij elk product klopt.
  tiers.push(['USE_CASE_SCENE', 'PRACTICAL_DISCOVERY', 'DIRECT_FACT'])

  const filtered = tiers
    .map((tier) =>
      context.contentType === 'COMPARISON' ? tier.filter((style) => !playfulStyles.includes(style)) : tier,
    )
    .filter((tier) => tier.length > 0)
  return filtered.length > 0 ? filtered : [['DIRECT_FACT']]
}

/** Hoe vaak staat `style` vooraan in de recente historie? */
function leadingRun(recent: readonly OpeningStyle[], style: OpeningStyle): number {
  let count = 0
  for (const entry of recent) {
    if (entry !== style) break
    count += 1
  }
  return count
}

/**
 * Kiest de openingStyle. Deterministisch: dezelfde sleutel en dezelfde historie
 * geven dezelfde uitkomst, zodat een herhaalde generatie geen andere tekst
 * oplevert.
 */
export function chooseOpeningStyle(context: OpeningContext): OpeningStyle {
  const recent = context.recentStyles ?? []
  const tiers = tiersFor(context)

  let hash = 0
  for (const character of context.key) hash = (hash * 31 + character.codePointAt(0)!) % 100_003

  // Van boven naar beneden: de eerste laag met een stijl die niet te vaak achter
  // elkaar is gebruikt, bepaalt de keuze.
  for (const tier of tiers) {
    const usable = tier.filter((style) => leadingRun(recent, style) < MAX_CONSECUTIVE_STYLE)
    if (usable.length > 0) return usable[hash % usable.length]!
  }
  // Alles is recent gebruikt; dan valt de keuze terug op de best passende laag.
  const first = tiers[0]!
  return first[hash % first.length]!
}

/**
 * Hash van een openingszin: kleine letters, zonder leestekens, en alleen de
 * eerste acht woorden. Twee openingen die alleen in een bijwoord verschillen,
 * krijgen dezelfde hash en worden dus als herhaling gezien.
 */
export function openingHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 8)
    .join(' ')
  let hash = 0
  for (const character of normalized) hash = (hash * 31 + character.codePointAt(0)!) | 0
  return `o${(hash >>> 0).toString(36)}`
}

/** Eerste zin van een tekst; daar zit de opening in. */
export function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^.*?[.!?](\s|$)/)
  return (match ? match[0] : trimmed).trim()
}

export type PublishedOpening = {
  openingStyle: OpeningStyle | null
  openingHash: string | null
  /** Hash van de slotzin; voorkomt dat elke tekst hetzelfde eindigt. */
  closingHash?: string | null
}

export type VarietyProblem = { code: 'style-run' | 'opening-repeat' | 'closing-repeat'; message: string }

/**
 * Controleert de variatie van een nieuwe tekst tegen de recente publicaties.
 * `recent` staat op nieuwste eerst en bevat maximaal de laatste twintig.
 */
export function checkOpeningVariety(
  candidate: { openingStyle: OpeningStyle; openingHash: string; closingHash?: string | null },
  recent: readonly PublishedOpening[],
): VarietyProblem[] {
  const problems: VarietyProblem[] = []
  const window = recent.slice(0, OPENING_HISTORY_WINDOW)

  const run = leadingRun(
    window.map((entry) => entry.openingStyle).filter((style): style is OpeningStyle => style !== null),
    candidate.openingStyle,
  )
  if (run >= MAX_CONSECUTIVE_STYLE) {
    problems.push({
      code: 'style-run',
      message: `openingStyle ${candidate.openingStyle} is al ${run} keer achter elkaar gebruikt`,
    })
  }

  if (window.some((entry) => entry.openingHash === candidate.openingHash)) {
    problems.push({
      code: 'opening-repeat',
      message: 'deze openingszin lijkt te sterk op een van de laatste twintig publicaties',
    })
  }

  if (
    candidate.closingHash &&
    window.some((entry) => entry.closingHash && entry.closingHash === candidate.closingHash)
  ) {
    problems.push({
      code: 'closing-repeat',
      message: 'deze slotzin is recent al gebruikt; varieer de afsluiting',
    })
  }

  return problems
}

/** Laatste zin van een tekst; gebruikt voor de slotzin-hash. */
export function lastSentence(text: string): string {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
  return sentences.at(-1) ?? ''
}
