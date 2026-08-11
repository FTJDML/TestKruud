import type { ExperienceType } from '@prisma/client'

/**
 * De redactionele schrijfstijl van Home & Living Deals, als controleerbare regels.
 *
 * Het doel is één herkenbare merkstem: nieuwsgierig, menselijk, licht geestig,
 * concreet, niet schreeuwerig. Deze module misleidt niets en niemand: er worden
 * nooit spelfouten, tikfouten of nepspreektaal toegevoegd om tekst menselijker te
 * laten lijken, en er wordt niet geschreven voor een zoekmachine of detector. Wat
 * hier wordt gecontroleerd is leesbaarheid en eerlijkheid.
 */
export const STYLE_VERSION = 'stijl-2026-08-1'

/** Waar een tekst staat; bepaalt hoe streng de regels zijn. */
export type StyleSurface =
  | 'HEADLINE'
  | 'TEASER'
  | 'BODY'
  | 'CAVEAT'
  | 'SEO_TITLE'
  | 'META_DESCRIPTION'
  | 'COMPARISON'
  | 'METHODOLOGY'

/** Contenttype; DISCOVERY mag speelser zijn dan COMPARISON. */
export type StyleContentType =
  | 'DISCOVERY'
  | 'DEAL'
  | 'COMPARISON'
  | 'DESIGN_COLLECTION'
  | 'GIFT_GUIDE'
  | 'GENERIC'

export type StyleIssue = {
  surface: StyleSurface
  /** Machineleesbare reden, handig in tests en in de admin. */
  code:
    | 'em-dash'
    | 'en-dash-aside'
    | 'hyphen-aside'
    | 'exclamation'
    | 'ai-cliche'
    | 'experience-claim'
    | 'informal-opening'
    | 'shouting'
    | 'emoji'
  message: string
  /** Het gevonden fragment, zodat een redacteur het terugvindt. */
  fragment?: string
}

/**
 * Zinsdelen die als standaard AI-taal gelden. Ze zijn niet verboden omdat ze
 * fout zijn, maar omdat ze niets zeggen. Staat een term inhoudelijk vast (een
 * product dat écht "naadloos" heet), dan mag de redactie de waarschuwing negeren:
 * dit zijn adviezen op tekstniveau, geen blokkade op publicatie.
 */
export const aiCliches: readonly string[] = [
  'gamechanger',
  'game changer',
  'must-have',
  'must have',
  'naar een hoger niveau',
  'naadloos',
  'ongeëvenaarde',
  'ongeevenaarde',
  'revolutionair',
  'perfect voor iedereen',
  'in de wereld van',
  'laten we erin duiken',
  'de ultieme',
  'combineert stijl en functionaliteit',
  'is meer dan alleen',
  'een vleugje',
  'ontdek de perfecte balans',
]

/** Constructies met dezelfde leegte, maar met variabele tussenstukken. */
const aiClichePatterns: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bof je nu\b[^.!?]{0,80}\bof\b/i, label: '"of je nu ... of ..."' },
  { pattern: /\bniet alleen\b[^.!?]{0,80}\bmaar ook\b/i, label: '"niet alleen ..., maar ook ..."' },
  { pattern: /\bideaal voor zowel\b[^.!?]{0,80}\bals\b/i, label: '"ideaal voor zowel ... als ..."' },
]

/**
 * Uitspraken die eigen ervaring veronderstellen. Zonder `HANDS_ON_TESTED` mogen
 * die er niet staan: wij hebben het product dan niet gebruikt.
 */
const experienceClaims: ReadonlyArray<{ pattern: RegExp; label: string; alternative: string }> = [
  {
    pattern: /\bdat zit lekker\b|\bzit lekker\b/i,
    label: '"dat zit lekker"',
    alternative: 'daar wil je zo in neerploffen',
  },
  { pattern: /\bwij vonden\b(?! geen\b)/i, label: '"wij vonden"', alternative: 'volgens de fabrikant' },
  {
    pattern: /\bvoelt (stevig|comfortabel|degelijk|goedkoop)\b/i,
    label: '"voelt stevig"',
    alternative: 'ziet er comfortabel uit',
  },
  {
    pattern: /\bwerkt (uitstekend|prima|geweldig|perfect)\b/i,
    label: '"werkt uitstekend"',
    alternative: 'op basis van de opgegeven specificaties',
  },
  {
    pattern: /\b(is|klinkt) verrassend stil\b|\bis erg stil\b/i,
    label: '"is verrassend stil"',
    alternative: 'de fabrikant geeft het geluidsniveau op',
  },
  { pattern: /\bsmaakt beter\b/i, label: '"smaakt beter"', alternative: 'vooral interessant voor' },
  {
    pattern: /\bwe hebben\b(?![^.!?]*\bniet\b)[^.!?]{0,40}\bgetest\b|\bwij hebben\b(?![^.!?]*\bniet\b)[^.!?]{0,40}\b(getest|gebruikt)\b/i,
    label: '"we hebben getest"',
    alternative: 'zonder eigen meting kunnen we dit niet bevestigen',
  },
  {
    pattern: /\bna (een|twee|drie|enkele) (dag|dagen|week|weken|maand|maanden) gebruik\b/i,
    label: '"na een week gebruik"',
    alternative: 'lijkt bedoeld voor',
  },
  { pattern: /\bin (onze|mijn) (test|ervaring)\b/i, label: '"in onze test"', alternative: 'volgens de fabrikant' },
]

/** Formuleringen die wél mogen zonder eigen test; ter herinnering in de admin. */
export const allowedExperienceAlternatives: readonly string[] = [
  'daar wil je zo in neerploffen',
  'ziet er comfortabel uit',
  'volgens de fabrikant',
  'op basis van de opgegeven specificaties',
  'vooral interessant voor',
  'lijkt bedoeld voor',
  'zonder eigen meting kunnen we dit niet bevestigen',
]

/**
 * Informele openingen. Ze mogen, maar spaarzaam: maximaal één per tekst en bij
 * ongeveer 15 procent van de productteksten (zie `informalOpeningBudget`).
 */
export const informalOpenings: readonly string[] = [
  'Woww...',
  'Kijk...',
  'Pohh...',
  'Oké, dit is slim.',
  'Hier moesten we even twee keer naar kijken.',
  "Dit is zo'n product waarvan je niet wist dat het bestond.",
  'Onnodig? Misschien. Leuk? Absoluut.',
  'Waarom bestaat dit niet al veel langer?',
  'Dit vraagt eigenlijk om een plek in de woonkamer.',
]

/** Oppervlakken waar een informele opening niet thuishoort. */
const formalSurfaces: readonly StyleSurface[] = [
  'SEO_TITLE',
  'META_DESCRIPTION',
  'COMPARISON',
  'METHODOLOGY',
]

/** Oppervlakken waar geen enkel uitroepteken hoort. */
const noExclamationSurfaces: readonly StyleSurface[] = [
  'SEO_TITLE',
  'META_DESCRIPTION',
  'COMPARISON',
  'METHODOLOGY',
]

const emojiPattern =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u

/**
 * Een en dash of koppelteken als kunstmatige onderbreking: leestekens met
 * spaties eromheen, midden in een zin. Correcte samenstellingen zoals
 * `90-dagenprijs`, `wifi-router` en `prijs-kwaliteitverhouding` hebben géén
 * spaties en blijven dus staan.
 */
const enDashAsidePattern = /\s–\s?|\s?–\s/u
const hyphenAsidePattern = /\s-\s/u

export type StyleCheckOptions = {
  surface: StyleSurface
  contentType?: StyleContentType
  experienceType?: ExperienceType
  /** Mag er een informele opening in deze tekst staan? */
  allowInformalOpening?: boolean
}

/**
 * Controleert één tekst op de stijlregels. De uitkomst is een lijst met
 * bevindingen; de aanroeper bepaalt of die blokkeren of alleen waarschuwen.
 */
export function checkVoice(text: string, options: StyleCheckOptions): StyleIssue[] {
  const surface = options.surface
  const issues: StyleIssue[] = []
  const trimmed = text.trim()
  if (trimmed.length === 0) return issues

  const add = (code: StyleIssue['code'], message: string, fragment?: string): void => {
    issues.push({ surface, code, message, ...(fragment ? { fragment } : {}) })
  }

  if (trimmed.includes('—')) {
    add('em-dash', 'gebruik geen em dash; maak er twee zinnen van of gebruik een komma', '—')
  }
  if (enDashAsidePattern.test(trimmed)) {
    add('en-dash-aside', 'gebruik geen en dash als tussenzin; splits de zin of gebruik een komma', '–')
  }
  if (hyphenAsidePattern.test(trimmed)) {
    add(
      'hyphen-aside',
      'een koppelteken tussen zinsdelen leest als een onderbreking; splits de zin of gebruik een komma',
      ' - ',
    )
  }

  const exclamations = (trimmed.match(/!/g) ?? []).length
  if (noExclamationSurfaces.includes(surface) && exclamations > 0) {
    add('exclamation', 'geen uitroeptekens in SEO-teksten, vergelijkingen en methodologie')
  } else if (exclamations > 1) {
    add('exclamation', 'maximaal één uitroepteken per tekst')
  }
  if (/[A-ZÀ-Ý]{5,}/.test(trimmed.replace(/\b[A-Z]{2,5}\b/g, ''))) {
    add('shouting', 'schrijf niet in kapitalen')
  }
  if (emojiPattern.test(trimmed)) {
    add('emoji', 'gebruik geen emoji in redactionele tekst')
  }

  const lowered = trimmed.toLowerCase()
  for (const cliche of aiCliches) {
    if (lowered.includes(cliche)) {
      add('ai-cliche', `"${cliche}" zegt niets; schrijf wat het product concreet doet`, cliche)
    }
  }
  for (const { pattern, label } of aiClichePatterns) {
    if (pattern.test(trimmed)) {
      add('ai-cliche', `${label} is een standaardconstructie; noem één concrete situatie`, label)
    }
  }

  if ((options.experienceType ?? 'NOT_TESTED') !== 'HANDS_ON_TESTED') {
    for (const claim of experienceClaims) {
      if (claim.pattern.test(trimmed)) {
        add(
          'experience-claim',
          `${claim.label} veronderstelt eigen gebruik; schrijf bijvoorbeeld "${claim.alternative}"`,
          claim.label,
        )
      }
    }
  }

  const informal = informalOpenings.filter((opening) => trimmed.includes(opening))
  if (informal.length > 1) {
    add('informal-opening', 'maximaal één informele opening per tekst', informal.join(' / '))
  }
  if (informal.length > 0 && formalSurfaces.includes(surface)) {
    add('informal-opening', 'geen informele opening in SEO-tekst, vergelijking of methodologie', informal[0])
  }
  if (informal.length > 0 && options.allowInformalOpening === false) {
    add('informal-opening', 'deze tekst is niet aan de beurt voor een informele opening', informal[0])
  }
  if (informal.length > 0 && options.contentType === 'COMPARISON') {
    add('informal-opening', 'een vergelijking blijft feitelijk en rustig', informal[0])
  }

  return issues
}

/**
 * Mag deze tekst een informele opening krijgen?
 *
 * Bij ongeveer 15 procent van de productteksten, deterministisch bepaald uit een
 * stabiele sleutel (de slug of het id). Zo krijgt hetzelfde product altijd
 * hetzelfde antwoord, en is de verdeling over de catalogus voorspelbaar zonder
 * dat er twee kaarten naast elkaar hetzelfde openen.
 */
export const INFORMAL_OPENING_SHARE = 0.15

export function informalOpeningBudget(key: string, share = INFORMAL_OPENING_SHARE): boolean {
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.codePointAt(0)!) % 100_003
  return hash % 100 < Math.round(share * 100)
}

/** Alleen de bevindingen die publicatie moeten tegenhouden. */
export function blockingVoiceIssues(issues: readonly StyleIssue[]): StyleIssue[] {
  // Een cliché is een advies aan de redactie. Een ervaringsclaim, een em dash,
  // een uitroepteken in een SEO-tekst of kapitalen zijn dat niet: die maken de
  // tekst onjuist of onleesbaar.
  return issues.filter((issue) => issue.code !== 'ai-cliche')
}
