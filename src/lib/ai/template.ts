import { categorySlugForName } from '@/lib/categories'
import type {
  EditorialContentProvider,
  EditorialGenerationResult,
  ProductFacts,
} from '@/lib/ai/provider'
import { checkContentStyle, editorialContentSchema } from '@/lib/ai/schema'
import { truncate, wordCount } from '@/lib/utils'

export const TEMPLATE_PROMPT_VERSION = 'template-2026-08-nl-1'

type CategoryVoice = {
  /** Situatie waarin het product opvalt. */
  situation: string
  /** Waarom deze categorie leuk is om te ontdekken. */
  angle: string
  bestFor: string[]
  caveat: string
  tags: string[]
}

const voices: Record<string, CategoryVoice> = {
  'wonen-en-design': {
    situation: 'op een avond waarop je niet meer van de bank af wil',
    angle: 'een woonobject dat er goed uitziet en ook echt iets doet',
    bestFor: ['wie zijn interieur een accent wil geven', 'kleine woonkamers', 'liefhebbers van design'],
    caveat: 'Reken op een fors formaat: meet je ruimte voordat je bestelt.',
    tags: ['wonen', 'design', 'interieur'],
  },
  'keuken-en-apparaten': {
    situation: 'tijdens een zondagmiddag waarop koken belangrijker is dan opruimen',
    angle: 'een apparaat dat een vertrouwd gerecht sneller of beter maakt',
    bestFor: ['thuiskoks', 'kleine keukens', 'wie graag iets nieuws probeert'],
    caveat: 'Het apparaat vraagt aanrechtruimte en wil na gebruik goed schoongemaakt worden.',
    tags: ['keuken', 'koken', 'apparaten'],
  },
  'smart-home-en-tech': {
    situation: 'op het moment dat je al in bed ligt en het licht nog brandt',
    angle: 'techniek die je huis rustiger maakt in plaats van drukker',
    bestFor: ['wie zijn huis stap voor stap slim maakt', 'huurwoningen', 'techliefhebbers'],
    caveat: 'Voor de slimme functies is een stabiel wifinetwerk en een app nodig.',
    tags: ['smart home', 'techniek', 'gemak'],
  },
  'gaming-en-entertainment': {
    situation: 'op een vrijdagavond waarop de bank een bioscoop moet worden',
    angle: 'entertainment dat je kamer meteen anders laat voelen',
    bestFor: ['gamers', 'filmavonden', 'wie zijn werkkamer wil upgraden'],
    caveat: 'In een lichte kamer heb je verduistering nodig om het beste beeld te krijgen.',
    tags: ['gaming', 'entertainment', 'thuisbioscoop'],
  },
  'tuin-en-buitenleven': {
    situation: 'op de eerste warme avond van het jaar',
    angle: 'buiten net zo comfortabel wonen als binnen',
    bestFor: ['balkons en kleine tuinen', 'wie vaak buiten eet', 'zomerse verjaardagen'],
    caveat: 'Buiten betekent ook onderhoud: berg het op als het weer omslaat.',
    tags: ['tuin', 'buiten', 'zomer'],
  },
  'auto-en-onderweg': {
    situation: 'halverwege een lange rit met kruimels op de achterbank',
    angle: 'een compacte oplossing die je in het handschoenenkastje vergeet tot je haar nodig hebt',
    bestFor: ['vakantieritten', 'wie zijn auto netjes houdt', 'campers en bestelbussen'],
    caveat: 'De accu is niet oneindig; voor grotere klussen laad je tussendoor bij.',
    tags: ['auto', 'onderweg', 'reizen'],
  },
  'speelgoed-en-hobby': {
    situation: 'op een regenachtige zaterdag met te veel tijd en te weinig plan',
    angle: 'een project waar zowel kinderen als volwassenen in verdwijnen',
    bestFor: ['cadeaus', 'regenachtige middagen', 'wie graag iets bouwt'],
    caveat: 'Het bouwen kost een middag en vraagt geduld met de kleine onderdelen.',
    tags: ['hobby', 'speelgoed', 'cadeau'],
  },
  'comfort-en-gemak': {
    situation: 'op een dinsdagavond waarop je huis een klein beetje aardiger mag zijn',
    angle: 'een kleine upgrade met een merkbaar effect op je dag',
    bestFor: ['wie thuiswerkt', 'lange avonden', 'iedereen die van gemak houdt'],
    caveat: 'Het effect is subtiel: verwacht comfort, geen wonder.',
    tags: ['comfort', 'gemak', 'thuis'],
  },
  'onnodig-maar-geweldig': {
    situation: 'op het moment dat iemand vraagt waar je dat nou weer gevonden hebt',
    angle: 'volstrekt overbodig en precies daarom leuk',
    bestFor: ['cadeaus voor wie alles heeft', 'gesprekken op visite', 'liefhebbers van gekke vondsten'],
    caveat: 'Praktisch nut is beperkt; dit is een product voor het plezier.',
    tags: ['bijzonder', 'cadeau', 'verrassend'],
  },
  cadeaus: {
    situation: 'twee dagen voor een verjaardag waarvoor je nog niets hebt',
    angle: 'verrassend genoeg om te onthouden en praktisch genoeg om te gebruiken',
    bestFor: ['verjaardagen', 'wie moeilijk te verrassen is', 'kleine attenties'],
    caveat: 'Ga na of de maat of kleur past bij degene die het krijgt.',
    tags: ['cadeau', 'verrassing', 'inspiratie'],
  },
}

const fallbackVoice: CategoryVoice = {
  situation: 'op een gewone avond thuis',
  angle: 'een vondst die je dag een klein beetje leuker maakt',
  bestFor: ['nieuwsgierige kopers', 'cadeaus', 'wie iets nieuws wil proberen'],
  caveat: 'Bekijk de specificaties van de aanbieder voordat je bestelt.',
  tags: ['vondst', 'inspiratie'],
}

function voiceFor(category: string): CategoryVoice {
  return voices[categorySlugForName(category)] ?? fallbackVoice
}

/** Voegt zinnen samen tot een tekst binnen een woordbereik. */
function fitWords(sentences: readonly string[], min: number, max: number, filler: readonly string[]): string {
  const parts: string[] = []
  for (const sentence of sentences) {
    const candidate = [...parts, sentence].join(' ')
    if (wordCount(candidate) > max && parts.length > 0) break
    parts.push(sentence)
  }
  let text = parts.join(' ')
  let fillerIndex = 0
  while (wordCount(text) < min && fillerIndex < filler.length) {
    const next = filler[fillerIndex]
    fillerIndex += 1
    if (!next) break
    const candidate = `${text} ${next}`
    if (wordCount(candidate) > max) break
    text = candidate
  }
  return text
}

function subject(facts: ProductFacts): string {
  const words = facts.title.split(/\s+/)
  return words.length <= 4 ? facts.title : words.slice(0, 4).join(' ')
}

/**
 * Deterministische Nederlandse templatecontent. Geen externe dienst nodig, en
 * altijd geldig volgens het Zod-schema. Uitkomst is bewust voorlopig: nieuwe
 * producten krijgen hiermee status NEEDS_REVIEW.
 */
export function buildTemplateContent(facts: ProductFacts): EditorialGenerationResult {
  const voice = voiceFor(facts.primaryCategory)
  const name = subject(facts)
  const brand = facts.brand ? `${facts.brand} ` : ''
  const source = facts.shortSourceDescription?.trim() ?? ''
  const specEntries = Object.entries(facts.specifications ?? {}).slice(0, 3)
  const specSentence =
    specEntries.length > 0
      ? `Volgens de aanbieder gaat het om ${specEntries
          .map(([key, value]) => `${key.toLowerCase()}: ${value.toLowerCase()}`)
          .join(', ')}.`
      : ''

  const headline = truncate(`${name} maakt ${voice.angle}`, 75)

  const teaser = fitWords(
    [
      `Deze ${name.toLowerCase()} valt op ${voice.situation}.`,
      source.length > 0 ? `${source.replace(/\s+$/, '').replace(/\.$/, '')}.` : '',
      `Het is ${voice.angle}, en dat merk je vooral in het dagelijks gebruik.`,
      `${facts.merchantName} levert het product; wij houden de prijs in de gaten.`,
    ].filter((sentence) => sentence.length > 0),
    45,
    70,
    [
      'Een vondst die je waarschijnlijk niet zocht en daarna moeilijk vergeet.',
      'Precies het soort product waarvan je vijf minuten eerder nog niet wist dat je het wilde.',
      'Handig genoeg om te gebruiken, opvallend genoeg om over te vertellen.',
    ],
  )

  const longDescription = fitWords(
    [
      `Op het eerste gezicht lijkt de ${name.toLowerCase()} een gewoon product in de categorie ${facts.primaryCategory.toLowerCase()}.`,
      `Kijk je beter, dan blijkt het ${voice.angle}.`,
      source.length > 0 ? `${source.replace(/\.$/, '')}.` : '',
      specSentence,
      `Het verschil zit in het moment waarop je het gebruikt: ${voice.situation} merk je waarom dit product bestaat.`,
      `Wij selecteren producten op originaliteit, bruikbaarheid en verhaal, niet op de hoogte van een commissie.`,
      `${facts.merchantName} verkoopt en verzendt dit product; wij verkopen zelf niets en controleren alleen de prijs.`,
      `Bekijk de productpagina van de aanbieder voor de volledige specificaties, garantie en levertijd.`,
      `Zo weet je precies wat je in huis haalt voordat je op de dealknop drukt.`,
    ].filter((sentence) => sentence.length > 0),
    120,
    220,
    [
      'Dat maakt het een typische vondst voor deze site: geen dagelijkse aankoop, wel iets om te onthouden.',
      'Wie zijn interieur, keuken of avondroutine een klein beetje wil bijstellen, heeft hier genoeg aan.',
      'En mocht je hem niet nodig hebben: dat overkomt ons met de leukste producten ook regelmatig.',
      'De prijs die je hier ziet komt van de aanbieder en wordt dagelijks opnieuw gecontroleerd.',
    ],
  )

  const payload = {
    headline,
    teaser,
    longDescription,
    whyItStandsOut: `${brand}${name} combineert een herkenbare vorm met een functie die je niet verwacht. Dat maakt het een product dat je zelf wil laten zien.`,
    bestFor: voice.bestFor,
    caveat: voice.caveat,
    seoTitle: truncate(`${name} — ${facts.primaryCategory}`, 60),
    metaDescription: truncate(
      `${name}: ${voice.angle}. Actuele prijs bij ${facts.merchantName}, dagelijks gecontroleerd door de redactie.`,
      155,
    ),
    tags: [...new Set([...voice.tags, facts.primaryCategory.toLowerCase()])].slice(0, 8),
    uniquenessScore: 62,
    storyScore: 58,
    usefulnessScore: 60,
    giftabilityScore: 55,
  }

  const parsed = editorialContentSchema.parse(payload)
  const warnings = checkContentStyle(parsed).map((issue) => `${issue.field}: ${issue.message}`)

  return {
    content: parsed,
    provider: 'template',
    promptVersion: TEMPLATE_PROMPT_VERSION,
    // Templatecontent is voorlopig en hoort door een mens te worden bijgewerkt.
    needsReview: true,
    warnings,
  }
}

export const templateProvider: EditorialContentProvider = {
  name: 'template',
  promptVersion: TEMPLATE_PROMPT_VERSION,
  generate: (facts) => Promise.resolve(buildTemplateContent(facts)),
}
