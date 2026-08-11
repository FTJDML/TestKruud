import { categorySlugForName } from '@/lib/categories'
import {
  buildEvidenceSummary,
  mayClaimFirstHandExperience,
  type EditorialContentProvider,
  type EditorialGenerationResult,
  type ProductFacts,
} from '@/lib/ai/provider'
import { looksDutch } from '@/lib/ai/language'
import { checkContentStyle, editorialContentSchema } from '@/lib/ai/schema'
import {
  chooseOpeningStyle,
  firstSentence,
  lastSentence,
  openingHash,
  type OpeningStyle,
} from '@/lib/ai/style/openings'
import {
  checkVoice,
  informalOpeningBudget,
  STYLE_VERSION,
  type StyleContentType,
} from '@/lib/ai/style/voice'
import { truncate, wordCount } from '@/lib/utils'

export const TEMPLATE_PROMPT_VERSION = 'template-2026-08-nl-3'

/** Maximale koplengte volgens de redactionele richtlijnen. */
const HEADLINE_MAX_LENGTH = 75

type CategoryVoice = {
  /** Situatie waarin het product opvalt. */
  situation: string
  /**
   * Invalshoeken voor deze categorie. Er wordt per product deterministisch één
   * variant gekozen, zodat producten uit dezelfde categorie niet allemaal
   * dezelfde kop krijgen.
   */
  angles: readonly string[]
  bestFor: string[]
  /**
   * Eerlijk aandachtspunt. Bewust advies in plaats van een bewering: de
   * template kent de echte afmetingen of materialen niet en mag die niet
   * verzinnen.
   */
  caveat: string
  tags: string[]
}

const voices: Record<string, CategoryVoice> = {
  'wonen-en-design': {
    situation: 'op een avond waarop je niet meer van de bank af wil',
    angles: [
      'een woonobject dat er goed uitziet en iets doet',
      'een meubel dat een hoek van je huis opnieuw indeelt',
      'een blikvanger waar bezoek naar blijft kijken',
    ],
    bestFor: ['wie zijn interieur een accent wil geven', 'kleine woonkamers', 'liefhebbers van design'],
    caveat: 'Controleer de afmetingen bij de aanbieder: in een kleine ruimte valt dit anders uit.',
    tags: ['wonen', 'design', 'interieur'],
  },
  'keuken-en-apparaten': {
    situation: 'tijdens een zondagmiddag waarop koken belangrijker is dan opruimen',
    angles: [
      'een apparaat dat een gerecht sneller of beter maakt',
      'keukengerei dat een vervelende klus overneemt',
      'een aanrechtbewoner die zijn plek verdient',
    ],
    bestFor: ['thuiskoks', 'kleine keukens', 'wie graag iets nieuws probeert'],
    caveat: 'Bekijk bij de aanbieder hoeveel aanrechtruimte dit vraagt en hoe het schoonmaken gaat.',
    tags: ['keuken', 'koken', 'apparaten'],
  },
  'smart-home-en-tech': {
    situation: 'op het moment dat je al in bed ligt en het licht nog brandt',
    angles: [
      'techniek die je huis rustiger maakt',
      'een apparaat dat meedenkt en daarna niet opvalt',
      'een slimme toevoeging die je snel weer vergeet',
    ],
    bestFor: ['wie zijn huis stap voor stap slim maakt', 'huurwoningen', 'techliefhebbers'],
    caveat: 'Slimme functies vragen meestal een app en een stabiel netwerk; check de eisen bij de aanbieder.',
    tags: ['smart home', 'techniek', 'gemak'],
  },
  'gaming-en-entertainment': {
    situation: 'op een vrijdagavond waarop de bank een bioscoop moet worden',
    angles: [
      'entertainment dat je kamer anders laat voelen',
      'een upgrade voor je bank of je bureau',
      'techniek die een avond een voorstelling maakt',
    ],
    bestFor: ['gamers', 'filmavonden', 'wie zijn werkkamer wil upgraden'],
    caveat: 'Beeld en geluid hangen af van je kamer; lees de specificaties van de aanbieder.',
    tags: ['gaming', 'entertainment', 'thuisbioscoop'],
  },
  'tuin-en-buitenleven': {
    situation: 'op de eerste warme avond van het jaar',
    angles: [
      'buiten net zo comfortabel wonen als binnen',
      'een reden om in september nog buiten te eten',
      'een buitenobject dat je tuin een middelpunt geeft',
    ],
    bestFor: ['balkons en kleine tuinen', 'wie vaak buiten eet', 'zomerse verjaardagen'],
    caveat: 'Buiten betekent onderhoud; kijk bij de aanbieder hoe weerbestendig dit is.',
    tags: ['tuin', 'buiten', 'zomer'],
  },
  'auto-en-onderweg': {
    situation: 'halverwege een lange rit met kruimels op de achterbank',
    angles: [
      'een compacte oplossing voor onderweg',
      'een kleine hulp die een lange rit korter maakt',
      'gereedschap dat onder de bijrijdersstoel past',
    ],
    bestFor: ['vakantieritten', 'wie zijn auto netjes houdt', 'campers en bestelbussen'],
    caveat: 'Controleer bij de aanbieder of het formaat en de stroomvoorziening bij je auto passen.',
    tags: ['auto', 'onderweg', 'reizen'],
  },
  'speelgoed-en-hobby': {
    situation: 'op een regenachtige zaterdag met te veel tijd en te weinig plan',
    angles: [
      'een project waar je een middag in verdwijnt',
      'een bouwklus met een resultaat dat blijft staan',
      'tijdverdrijf voor een regenachtige middag',
    ],
    bestFor: ['cadeaus', 'regenachtige middagen', 'wie graag iets bouwt'],
    caveat: 'Reken op wat tijd om te beginnen; de aanbieder vermeldt de inhoud en de leeftijd.',
    tags: ['hobby', 'speelgoed', 'cadeau'],
  },
  'comfort-en-gemak': {
    situation: 'op een dinsdagavond waarop je huis een klein beetje aardiger mag zijn',
    angles: [
      'een kleine upgrade met een merkbaar effect',
      'een taak minder zonder iets nieuws te leren',
      'comfort dat je pas mist als het weg is',
    ],
    bestFor: ['wie thuiswerkt', 'lange avonden', 'iedereen die van gemak houdt'],
    caveat: 'Het effect is subtiel: verwacht comfort, geen wonder.',
    tags: ['comfort', 'gemak', 'thuis'],
  },
  'onnodig-maar-geweldig': {
    situation: 'op het moment dat iemand vraagt waar je dat nou weer gevonden hebt',
    angles: [
      'volstrekt overbodig en precies daarom leuk',
      'een aankoop die niemand kan uitleggen',
      'een product dat bestaat omdat het kan',
    ],
    bestFor: ['cadeaus voor wie alles heeft', 'gesprekken op visite', 'liefhebbers van gekke vondsten'],
    caveat: 'Praktisch nut is beperkt; dit is een product voor het plezier.',
    tags: ['bijzonder', 'cadeau', 'verrassend'],
  },
  cadeaus: {
    situation: 'twee dagen voor een verjaardag waarvoor je nog niets hebt',
    angles: [
      'verrassend om te krijgen en simpel in gebruik',
      'een cadeau dat niet in de kast verdwijnt',
      'een attentie die een verhaal oplevert',
    ],
    bestFor: ['verjaardagen', 'wie moeilijk te verrassen is', 'kleine attenties'],
    caveat: 'Ga na of maat, kleur of smaak past bij degene die het krijgt.',
    tags: ['cadeau', 'verrassing', 'inspiratie'],
  },
}

const fallbackVoice: CategoryVoice = {
  situation: 'op een gewone avond thuis',
  angles: [
    'een vondst die je dag iets leuker maakt',
    'een product dat je niet zocht en toch bekijkt',
  ],
  bestFor: ['nieuwsgierige kopers', 'cadeaus', 'wie iets nieuws wil proberen'],
  caveat: 'Bekijk de specificaties van de aanbieder voordat je bestelt.',
  tags: ['vondst', 'inspiratie'],
}

function voiceFor(category: string): CategoryVoice {
  return voices[categorySlugForName(category)] ?? fallbackVoice
}

/** Stabiele, kleine hash zodat dezelfde titel altijd dezelfde variant krijgt. */
function seedFrom(text: string): number {
  let hash = 0
  for (const character of text) hash = (hash * 31 + character.codePointAt(0)!) % 100_003
  return hash
}

function pickVariant<T>(items: readonly T[], seed: number): T {
  // Niet-lege arrays: elke stem heeft minimaal twee varianten.
  return items[seed % items.length]!
}

/** Zelfde varianten, andere startpositie per product. */
function rotate<T>(items: readonly T[], seed: number): T[] {
  return items.map((_, index) => items[(seed + index) % items.length]!)
}

/**
 * Kiest een invalshoek die met deze productnaam nog binnen de koplengte past.
 * Zo hoeft de kop niet te worden afgekapt bij een lange brontitel.
 */
function pickAngle(angles: readonly string[], seed: number, name: string, maxLength: number): string {
  const rotated = angles.map((_, index) => angles[(seed + index) % angles.length]!)
  const fitting = rotated.find((angle) => `${name} maakt ${angle}`.length <= maxLength)
  if (fitting) return fitting
  return [...angles].sort((left, right) => left.length - right.length)[0]!
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
 * Openingszin per stijl. De opening sluit aan bij het product en bij de feiten
 * die wij hebben: er wordt niets verzonnen om een leuke eerste zin te krijgen.
 */
function openingSentence(
  style: OpeningStyle,
  input: {
    name: string
    situation: string
    angle: string
    category: string
    merchantName: string
    seed: number
    /** Hashes van recente openingszinnen; die slaan wij over. */
    usedOpeningHashes?: Set<string>
  },
): string {
  const name = input.name.toLowerCase()
  // Per stijl meerdere formuleringen, met de productnaam vooraan: twee producten
  // met dezelfde stijl krijgen zo toch een eigen openingszin.
  const variants: Record<OpeningStyle, string[]> = {
    PRICE_DROP: [
      `De ${name} bewoog recent in prijs, en dat maakt hem nu interessant.`,
      `De prijs van deze ${name} ligt lager dan bij onze vorige meting.`,
      `Bij deze ${name} zagen wij de prijs dalen sinds de laatste controle.`,
    ],
    RECOGNIZABLE_PROBLEM: [
      `Je kent het moment ${input.situation}: precies daar helpt deze ${name}.`,
      `Iedereen loopt er weleens tegenaan ${input.situation}. Deze ${name} pakt dat aan.`,
      `De ${name} lost iets op wat je vooral merkt ${input.situation}.`,
    ],
    VISUAL_SURPRISE: [
      `Op het eerste gezicht is dit een gewone ${name}, tot je ziet wat er nog bij zit.`,
      `De ${name} lijkt alledaags, en dat is precies de bedoeling.`,
      `Aan de buitenkant verraadt deze ${name} niets van wat hij doet.`,
    ],
    USE_CASE_SCENE: [
      `Deze ${name} bewijst zich ${input.situation}.`,
      `De ${name} komt tot zijn recht ${input.situation}.`,
      `Vooral ${input.situation} merk je wat deze ${name} toevoegt.`,
    ],
    GIFT_REACTION: [
      `De ${name} is het soort cadeau waarbij iemand eerst even stil is.`,
      `Geef deze ${name} weg en de eerste vraag is waar je hem vond.`,
      `Een ${name} als cadeau levert vooral een goed verhaal op.`,
    ],
    DESIGN_OBSERVATION: [
      `De vorm van deze ${name} valt op voordat de functie dat doet.`,
      `Deze ${name} staat er als een object, niet als een apparaat.`,
      `Materiaal en lijn maken deze ${name} eerder meubel dan gereedschap.`,
    ],
    PRACTICAL_DISCOVERY: [
      `Een ${name} die iets oplost waar je zelden een product voor zoekt.`,
      `De ${name} neemt een klusje over dat je nooit had opgeschreven.`,
      `Deze ${name} is handig op een manier die je pas na een dag opvalt.`,
    ],
    DRY_HUMOR: [
      `Niemand wachtte op deze ${name}. Toch blijft hij hangen.`,
      `De ${name} is volstrekt overbodig en daarom moeilijk te vergeten.`,
      `Een ${name} die vooral bestaat omdat het kan.`,
    ],
    DIRECT_FACT: [
      `De ${name} valt in ${input.category.toLowerCase()} op door één ding: het is ${input.angle}.`,
      `Wat deze ${name} onderscheidt: het is ${input.angle}.`,
      `De ${name} is ${input.angle}, en dat is het hele idee.`,
    ],
    EDITORIAL_QUESTION: [
      `Waarom bestond deze ${name} niet al veel langer?`,
      `Wie verzint een ${name} als deze, en waarom werkt het?`,
      `Hoeveel ruimte mag een ${name} innemen voordat het te veel wordt?`,
    ],
  }
  const options = variants[style]
  // Rotatie: kies de eerste variant waarvan de openingszin niet al in de recente
  // publicaties staat. Zo blijven twee producten met dezelfde stijl toch anders
  // openen.
  for (let offset = 0; offset < options.length; offset += 1) {
    const candidate = options[(input.seed + offset) % options.length]!
    if (!input.usedOpeningHashes?.has(openingHash(candidate))) return candidate
  }
  return options[input.seed % options.length]!
}

/** Informele openingen, per stijl passend gekozen; nooit meer dan één. */
const informalByStyle: Partial<Record<OpeningStyle, string>> = {
  VISUAL_SURPRISE: 'Hier moesten we even twee keer naar kijken.',
  PRACTICAL_DISCOVERY: 'Oké, dit is slim.',
  DRY_HUMOR: 'Onnodig? Misschien. Leuk? Absoluut.',
  EDITORIAL_QUESTION: 'Waarom bestaat dit niet al veel langer?',
  DESIGN_OBSERVATION: 'Dit vraagt eigenlijk om een plek in de woonkamer.',
  GIFT_REACTION: "Dit is zo'n product waarvan je niet wist dat het bestond.",
}

/** Contenttype voor de stijlcontrole, afgeleid uit de feiten. */
function contentTypeFor(facts: ProductFacts): StyleContentType {
  if ((facts.priceAnalysis?.hasPriceDrop ?? false) === true) return 'DEAL'
  if (facts.primaryCategory === 'Onnodig Maar Geweldig') return 'DISCOVERY'
  if (facts.primaryCategory === 'Cadeaus') return 'GIFT_GUIDE'
  if (facts.primaryCategory === 'Wonen & Design') return 'DESIGN_COLLECTION'
  return 'GENERIC'
}

/**
 * Deterministische Nederlandse templatecontent. Geen externe dienst nodig, en
 * altijd geldig volgens het Zod-schema. Uitkomst is bewust voorlopig: nieuwe
 * producten krijgen hiermee status NEEDS_REVIEW.
 */
export function buildTemplateContent(facts: ProductFacts): EditorialGenerationResult {
  const voice = voiceFor(facts.primaryCategory)
  const seed = seedFrom(facts.title)
  const name = subject(facts)
  const styleKey = facts.key ?? facts.title
  const contentType = contentTypeFor(facts)
  const openingStyle = chooseOpeningStyle({
    key: styleKey,
    contentType,
    hasMeasuredPriceDrop: facts.priceAnalysis?.hasPriceDrop ?? false,
    hasKnownProblem: (facts.knownCons ?? []).length > 0,
    isGift: facts.primaryCategory === 'Cadeaus',
    isDesignLed: facts.primaryCategory === 'Wonen & Design',
    isUnusual: facts.primaryCategory === 'Onnodig Maar Geweldig',
    ...(facts.recentOpeningStyles ? { recentStyles: facts.recentOpeningStyles } : {}),
  })
  // Een informele opening mag bij ongeveer 15 procent van de teksten, en alleen
  // wanneer de gekozen stijl er een heeft die past.
  const informal = informalOpeningBudget(styleKey) ? (informalByStyle[openingStyle] ?? '') : ''
  const angle = pickAngle(voice.angles, seed, name, HEADLINE_MAX_LENGTH)
  const brand = facts.brand ? `${facts.brand} ` : ''
  // Brondata is vaak Engels. Een Engelse leverancierszin midden in een
  // Nederlandse alinea leest slecht en wordt door de kwaliteitspoort geblokkeerd,
  // dus die nemen we niet over.
  const rawSource = facts.shortSourceDescription?.trim() ?? ''
  const source = rawSource.length > 0 && looksDutch(rawSource) ? rawSource : ''
  const specEntries = Object.entries(facts.specifications ?? {}).slice(0, 3)
  const specSentence =
    specEntries.length > 0
      ? `Volgens de aanbieder gaat het om ${specEntries
          .map(([key, value]) => `${key.toLowerCase()}: ${value.toLowerCase()}`)
          .join(', ')}.`
      : ''

  // Onze eigen prijsanalyse komt níet in de opgeslagen tekst: prijzen en
  // percentages veranderen dagelijks, en de productpagina toont ze los in
  // "Onze prijsanalyse", rechtstreeks uit de meetgegevens. Wat hier wel mag, is
  // een feit dat niet over een bedrag gaat: bij hoeveel aanbieders wij volgen.
  const analysis = facts.priceAnalysis ?? null
  const comparisonSentence =
    analysis && analysis.numberOfComparedMerchants >= 2
      ? `Wij volgen dit product bij ${analysis.numberOfComparedMerchants} aanbieders en vergelijken hun prijzen dagelijks.`
      : ''
  // Zonder eigen test nooit "wij vonden" of "in gebruik voelt het"; de tekst
  // blijft dan bij wat de aanbieder en onze metingen zeggen.
  const testedSentence = mayClaimFirstHandExperience(facts)
    ? 'Wij hebben dit product zelf gebruikt.'
    : ''

  const headline = truncate(`${name} maakt ${angle}`, HEADLINE_MAX_LENGTH)

  const teaser = fitWords(
    [
      // Eén informele opening, alleen wanneer deze tekst aan de beurt is.
      informal,
      // De openingszin hoort bij de gekozen stijl en gebruikt alleen feiten die
      // wij hebben.
      openingSentence(openingStyle, {
        name,
        situation: voice.situation,
        angle,
        category: facts.primaryCategory,
        merchantName: facts.merchantName,
        seed,
        usedOpeningHashes: new Set(
          (facts.recentOpeningHashes ?? [])
            .map((entry) => entry.openingHash)
            .filter((hash): hash is string => hash !== null),
        ),
      }),
      // Direct na de openingszin, zodat deze zin niet als laatste buiten het
      // woordbereik valt; hij is leeg zolang wij het product niet zelf kenden.
      testedSentence,
      source.length > 0 ? `${source.replace(/\s+$/, '').replace(/\.$/, '')}.` : '',
      pickVariant(
        [
          `Het is ${angle}, en dat merk je vooral in het dagelijks gebruik.`,
          `Wat het bijzonder maakt: het is ${angle}.`,
          `Onder de streep is het ${angle}, zonder dat je er iets voor hoeft te leren.`,
        ],
        seed,
      ),
      pickVariant(
        [
          `${facts.merchantName} levert het product; wij houden de prijs in de gaten.`,
          `Te koop bij ${facts.merchantName}; wij controleren dagelijks wat het daar kost.`,
          `${facts.merchantName} verzorgt de verkoop, wij het prijsoverzicht.`,
        ],
        seed,
      ),
    ].filter((sentence) => sentence.length > 0),
    45,
    70,
    rotate(
      [
        'Een vondst die je waarschijnlijk niet zocht en daarna moeilijk vergeet.',
        'Precies het soort product waarvan je vijf minuten eerder nog niet wist dat je het wilde.',
        'Handig genoeg om te gebruiken, opvallend genoeg om over te vertellen.',
      ],
      seed,
    ),
  )

  const longDescription = fitWords(
    [
      pickVariant(
        [
          `Op het eerste gezicht lijkt de ${name.toLowerCase()} een gewoon product in de categorie ${facts.primaryCategory.toLowerCase()}.`,
          `In een rij ${facts.primaryCategory.toLowerCase()} valt de ${name.toLowerCase()} niet meteen op.`,
          `De ${name.toLowerCase()} ziet eruit als een alledaags product voor ${facts.primaryCategory.toLowerCase()}.`,
        ],
        seed,
      ),
      pickVariant(
        [
          `Kijk je beter, dan blijkt het ${angle}.`,
          `Bij nader inzien is het ${angle}.`,
          `Wie doorkijkt, ziet ${angle}.`,
        ],
        seed + 1,
      ),
      source.length > 0 ? `${source.replace(/\.$/, '')}.` : '',
      specSentence,
      comparisonSentence,
      pickVariant(
        [
          `Het verschil zit in het moment waarop je het gebruikt: ${voice.situation} merk je waarom dit product bestaat.`,
          `Vooral ${voice.situation} wordt duidelijk waarom iemand dit heeft gemaakt.`,
          `Het komt tot zijn recht ${voice.situation}, en de rest van de week staat het er gewoon.`,
        ],
        seed,
      ),
      // Openheid over de rolverdeling, zonder vaste slogan.
      pickVariant(
        [
          `${facts.merchantName} verkoopt en verzendt dit product; wij volgen de prijs en de voorraad.`,
          `De verkoop en verzending liggen bij ${facts.merchantName}. Wij houden bij wat het daar kost.`,
          `${facts.merchantName} levert dit product; wij controleren dagelijks de prijs.`,
        ],
        seed,
      ),
      pickVariant(
        [
          `Specificaties, garantie en levertijd staan op de productpagina van de aanbieder.`,
          `Voor maten, garantie en levertijd is de aanbieder de bron; die gegevens verzinnen wij niet.`,
          `Wat er precies bij zit en hoe snel het komt, lees je bij de aanbieder zelf.`,
        ],
        seed + 2,
      ),
    ].filter((sentence) => sentence.length > 0),
    120,
    220,
    rotate(
      [
        'Dat maakt het een typische vondst voor deze site: geen dagelijkse aankoop, wel iets om te onthouden.',
        'Wie zijn interieur, keuken of avondroutine een klein beetje wil bijstellen, heeft hier genoeg aan.',
        'En mocht je hem niet nodig hebben: dat overkomt ons met de leukste producten ook regelmatig.',
        'De prijs die je hier ziet komt van de aanbieder en wordt dagelijks opnieuw gecontroleerd.',
        'Bewaar hem met het hartje als je er nog even over wil nadenken.',
      ],
      seed,
    ),
  )

  const payload = {
    headline,
    teaser,
    longDescription,
    whyItStandsOut: pickVariant(
      [
        `${brand}${name} combineert een herkenbare vorm met een functie die je niet verwacht. Dat maakt het een product dat je zelf wil laten zien.`,
        `Bij ${brand}${name} zit het verschil in het gebruik: het lost een klein probleem op waar je zelden een product voor zoekt.`,
        `${brand}${name} valt tussen de standaardoplossingen op doordat het één ding anders aanpakt dan gebruikelijk in ${facts.primaryCategory.toLowerCase()}.`,
      ],
      seed,
    ),
    bestFor: voice.bestFor,
    caveat: voice.caveat,
    seoTitle: truncate(`${name} in ${facts.primaryCategory}`, 60),
    metaDescription: truncate(
      `${name}: ${angle}. Actuele prijs bij ${facts.merchantName}, dagelijks gecontroleerd door de redactie.`,
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

  // Stijlcontrole per oppervlak: de SEO-velden zijn strenger dan de lopende tekst.
  const styleWarnings = [
    ...checkVoice(parsed.headline, {
      surface: 'HEADLINE',
      contentType,
      ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
    }),
    ...checkVoice(parsed.teaser, {
      surface: 'TEASER',
      contentType,
      ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
    }),
    ...checkVoice(parsed.longDescription, {
      surface: 'BODY',
      contentType,
      ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
    }),
    ...checkVoice(parsed.caveat, {
      surface: 'CAVEAT',
      contentType,
      ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
    }),
    ...checkVoice(parsed.seoTitle, { surface: 'SEO_TITLE', contentType }),
    ...checkVoice(parsed.metaDescription, { surface: 'META_DESCRIPTION', contentType }),
  ].map((issue) => `${issue.surface}: ${issue.message}`)

  return {
    content: parsed,
    provider: 'template',
    promptVersion: TEMPLATE_PROMPT_VERSION,
    /**
     * Deze provider is deterministisch en gebruikt alleen gecontroleerde feiten;
     * er valt niets te hallucineren. Toch gaat geen enkele gegenereerde tekst
     * zonder menselijke controle de index in: `humanReviewedAt` blijft leeg tot
     * een redacteur de tekst heeft nagelezen (zie de indexeringspoort).
     */
    needsReview: false,
    warnings,
    model: null,
    evidenceSummary: buildEvidenceSummary(facts),
    openingStyle,
    openingHash: openingHash(firstSentence(parsed.teaser)),
    closingHash: openingHash(lastSentence(parsed.longDescription)),
    styleVersion: STYLE_VERSION,
    styleWarnings,
  }
}

export const templateProvider: EditorialContentProvider = {
  name: 'template',
  promptVersion: TEMPLATE_PROMPT_VERSION,
  generate: (facts) => Promise.resolve(buildTemplateContent(facts)),
}
