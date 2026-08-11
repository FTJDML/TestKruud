import { z } from 'zod'
import type { EditorialPageType, ExperienceType, SearchIntent } from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { searchIntentLabels } from '@/lib/editorial/archetypes'
import { formatMoney } from '@/lib/pricing/money'
import { looksDutch } from '@/lib/ai/language'

/**
 * AI-drafts voor redactionele pagina's.
 *
 * Wat de AI mag: structureren, begrijpelijk samenvatten, een hook schrijven,
 * verschillen uitleggen die uit de gegeven feiten volgen, en een SEO-title,
 * meta description en FAQ-vragen voorstellen.
 *
 * Wat de AI niet mag: specificaties verzinnen, testen suggereren die niet zijn
 * uitgevoerd, gebruikerservaring verzinnen, prijzen of kortingen berekenen, een
 * affiliateproduct laten winnen, veiligheid of geschiktheid verzinnen, of
 * publiceren. Elke draft komt op `NEEDS_REVIEW`.
 *
 * De feiten hieronder zijn de enige input. Er zit bewust geen veld voor
 * commissie, netwerk of vergoeding in: die informatie bereikt de generatie niet.
 */
export type EditorialProductFacts = {
  productId: string
  title: string
  brand: string | null
  /** Actuele prijs in centen, zoals wij die hebben gemeten. */
  currentPriceCents: number | null
  /** Gecontroleerde criteriumwaarden; ontbrekende waarden staan er niet in. */
  verifiedCriteria: Array<{ label: string; value: string; unit: string | null }>
  /** Criteria waarvan de bron niets levert; de AI mag die niet invullen. */
  missingCriteria: string[]
  /** Bekend aandachtspunt uit brondata of van de redactie. */
  knownCaveat: string | null
  experienceType: ExperienceType
  isAlternative: boolean
}

export type EditorialDraftFacts = {
  type: EditorialPageType
  primaryQuery: string
  searchIntent: SearchIntent
  audience: string | null
  useCase: string | null
  budgetMinCents: number | null
  budgetMaxCents: number | null
  /** Criteria van de pagina, met hun uitleg. */
  criteria: Array<{ label: string; explanation: string; unit: string | null }>
  products: EditorialProductFacts[]
  /** Goedgekeurde bronnen; alleen brontypen en titels. */
  sources: Array<{ typeLabel: string; title: string }>
  /** Hebben wij zelf getest? Alleen waar met een vastgelegde eigen test. */
  handsOnTested: boolean
}

/** Wat een draft oplevert. Alle velden zijn voorstellen voor de redactie. */
export const editorialDraftSchema = z.object({
  introduction: z.string().min(200),
  methodology: z.string().min(80),
  selectionCriteria: z.string().min(40),
  conclusion: z.string().min(60),
  seoTitle: z.string().min(15).max(70),
  metaDescription: z.string().min(50).max(170),
  frequentlyAskedQuestions: z
    .array(z.object({ question: z.string().min(10), answer: z.string().min(20) }))
    .max(6),
})

export type EditorialDraft = z.infer<typeof editorialDraftSchema>

export type EditorialDraftResult = {
  draft: EditorialDraft
  provider: string
  model: string | null
  /** Altijd true: een draft is nooit publicabel zonder mens. */
  needsReview: true
  warnings: string[]
}

/**
 * Zinnen die eigen ervaring suggereren; zonder eigen test niet toegestaan.
 *
 * De negatieve lookahead op "niet" is nodig omdat de eerlijke variant — "wij
 * hebben deze producten niet zelf gebruikt" — juist wél mag en zelfs gewenst is.
 */
const firstHandPatterns = [
  /\bwij hebben\b(?![^.!?]*\bniet\b)[^.!?]{0,60}\b(getest|gebruikt|geprobeerd|uitgeprobeerd)\b/i,
  /(?<!niet )\bzelf (getest|gebruikt|geprobeerd)\b/i,
  /\bin (onze|mijn) (test|ervaring)\b/i,
  /\bonze (eigen )?(test|ervaring)\b/i,
]

/**
 * Controleert een draft op de dingen die een taalmodel niet mag doen. Dit is
 * geen stijladvies: wat hier terugkomt, blokkeert opslaan.
 */
export function findDraftProblems(draft: EditorialDraft, facts: EditorialDraftFacts): string[] {
  const problems: string[] = []
  /**
   * Lopende tekst. `selectionCriteria` staat hier niet in: dat is een opsomming
   * van criteriumdefinities ("Maalgraden: aantal instelbare standen"), geen
   * proza, en een lijst labels leest niet als Nederlandse tekst.
   */
  const texts = [
    draft.introduction,
    draft.methodology,
    draft.conclusion,
    ...draft.frequentlyAskedQuestions.map((faq) => faq.answer),
  ]

  for (const text of texts) {
    if (!looksDutch(text)) {
      problems.push('tekst lijkt niet Nederlands')
      break
    }
  }

  if (!facts.handsOnTested) {
    for (const text of texts) {
      if (firstHandPatterns.some((pattern) => pattern.test(text))) {
        problems.push('suggereert een eigen test die niet is uitgevoerd')
        break
      }
    }
  }

  // Percentages en bedragen horen niet in de redactionele tekst: de applicatie
  // rekent en toont die zelf, en een opgeslagen bedrag is morgen verouderd.
  for (const text of [draft.introduction, draft.methodology, draft.conclusion]) {
    if (/\d+\s?%/.test(text)) {
      problems.push('kortingspercentages horen niet in de tekst')
      break
    }
  }

  // Een criterium dat de bron niet levert, mag niet in de lopende tekst opduiken
  // als vaststaand feit ("Bonenreservoir: 250 gram"). Het criterium noemen mag
  // wel — dat gebeurt in de methodologie en in de criteriumlijst.
  const missing = new Set(facts.products.flatMap((product) => product.missingCriteria))
  for (const label of missing) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const claimsValue = new RegExp(`${escaped}\\s*[:=]\\s*\\S`, 'i')
    if (texts.some((text) => claimsValue.test(text))) {
      problems.push(`vult het ontbrekende criterium "${label}" alsnog in`)
    }
  }

  if (!draft.introduction.toLowerCase().includes(facts.primaryQuery.toLowerCase().split(' ')[0] ?? '')) {
    problems.push('introductie sluit niet aan op de primaryQuery')
  }

  return [...new Set(problems)]
}

function budgetSentence(facts: EditorialDraftFacts): string {
  if (facts.budgetMaxCents === null) return ''
  const upper = formatMoney(facts.budgetMaxCents)
  const lower = facts.budgetMinCents !== null ? formatMoney(facts.budgetMinCents) : null
  return lower
    ? `Alles in deze lijst kostte bij onze laatste controle tussen ${lower} en ${upper}.`
    : `Alles in deze lijst kostte bij onze laatste controle minder dan ${upper}.`
}

/**
 * Deterministische draft uit de gegeven feiten. Geen externe dienst nodig, en
 * bruikbaar als vertrekpunt voor de redactie: de tekst benoemt alleen wat er in
 * de feiten staat, inclusief wat er ontbreekt.
 */
export function buildTemplateDraft(facts: EditorialDraftFacts): EditorialDraftResult {
  const archetype = archetypeFor(facts.type)
  const selected = facts.products.filter((product) => !product.isAlternative)
  const criteriaNames = facts.criteria.map((criterion) => criterion.label.toLowerCase())
  const audience = facts.audience ?? 'wie hier iets zoekt'

  const introduction = [
    `${facts.primaryQuery.charAt(0).toUpperCase()}${facts.primaryQuery.slice(1)}: wij vergeleken ${selected.length} producten die wij zelf volgen.`,
    budgetSentence(facts),
    criteriaNames.length > 0
      ? `De vergelijking gaat over ${criteriaNames.slice(0, 4).join(', ')} — allemaal gegevens die in de brondata staan en dus na te kijken zijn.`
      : 'Wij kijken naar wat er in de brondata te controleren valt en laten de rest weg.',
    facts.useCase ? `Uitgangspunt is één situatie: ${facts.useCase}.` : '',
    `Deze pagina is bedoeld voor ${audience}. Wat wij niet weten, staat er ook niet: ontbreekt een gegeven bij de aanbieder, dan blijft het veld leeg in plaats van dat wij het invullen.`,
    facts.handsOnTested
      ? 'Van de producten in deze lijst hebben wij er zelf minimaal één gebruikt; dat staat bij de bronnen.'
      : 'Wij hebben deze producten niet zelf gebruikt: de vergelijking rust op gecontroleerde brondata en op onze eigen prijsmetingen.',
  ]
    .filter((sentence) => sentence.length > 0)
    .join(' ')

  const methodology = [
    `Wij vergeleken ${facts.products.length} producten en namen er ${selected.length} op.`,
    criteriaNames.length > 0
      ? `Per product controleerden wij ${criteriaNames.join(', ')}; een waarde die de bron niet levert, laten wij leeg.`
      : 'Wij controleerden de productgegevens die de aanbieder levert.',
    'De prijzen zijn onze eigen metingen bij de aanbieder en worden dagelijks opnieuw gecontroleerd.',
    archetype.allowsBestClaim
      ? 'Een aanbeveling hangt altijd aan een criterium en aan een doelgroep, niet aan een algemeen oordeel.'
      : 'Wij spreken hier geen winnaar uit: de belangrijkste verschillen gaan over smaak, en dat is niet te meten.',
    'Of een aanbieder ons een vergoeding betaalt, speelt bij de selectie geen rol.',
  ].join(' ')

  const selectionCriteria =
    facts.criteria.length > 0
      ? facts.criteria.map((criterion) => `${criterion.label}: ${criterion.explanation}`).join('\n')
      : 'Gecontroleerde productgegevens, een actieve aanbieding en een geldige productafbeelding.'

  const conclusion = [
    selected.length > 0
      ? `Voor ${audience} is de keuze vooral een afweging tussen ${criteriaNames[0] ?? 'de eigenschappen'} en prijs.`
      : '',
    'Bij elk product staat waarom het is opgenomen en waar het tekortschiet; die combinatie is bruikbaarder dan een ranglijst.',
    'Prijzen wijzigen dagelijks — de bedragen op deze pagina zijn onze laatste meting.',
  ]
    .filter((sentence) => sentence.length > 0)
    .join(' ')

  const faqs = [
    {
      question: `Waarop is deze ${archetype.label.toLowerCase()} gebaseerd?`,
      answer: `Op gecontroleerde brondata van de aanbieders en op onze eigen prijsmetingen. Wij vergeleken ${facts.products.length} producten; wat een bron niet levert, vullen wij niet zelf in.`,
    },
    {
      question: 'Hebben jullie deze producten zelf gebruikt?',
      answer: facts.handsOnTested
        ? 'Van minimaal één product in deze lijst hebben wij een eigen test vastgelegd; dat staat bij de bronnen.'
        : 'Nee. Wij vergelijken op gecontroleerde specificaties en op onze eigen prijsmetingen, en doen geen uitspraken over hoe iets aanvoelt.',
    },
    ...(facts.budgetMaxCents !== null
      ? [
          {
            question: `Wat kun je verwachten binnen dit budget?`,
            answer: `Alles in deze lijst viel bij onze laatste controle binnen de grens. Ligt een product er bewust boven, dan staat bij dat product waarom.`,
          },
        ]
      : []),
  ]

  const seoTitle = truncateTo(`${capitalize(facts.primaryQuery)}`, 60)
  const metaDescription = truncateTo(
    `${capitalize(facts.primaryQuery)}: ${selected.length} producten vergeleken op gecontroleerde specificaties, met prijzen die wij dagelijks meten.`,
    155,
  )

  const draft = editorialDraftSchema.parse({
    introduction,
    methodology,
    selectionCriteria,
    conclusion,
    seoTitle,
    metaDescription,
    frequentlyAskedQuestions: faqs,
  })

  return {
    draft,
    provider: 'template',
    model: null,
    needsReview: true,
    warnings: findDraftProblems(draft, facts),
  }
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

function truncateTo(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Instructie voor een taalmodel. Geëxporteerd zodat een test haar kan lezen. */
export const EDITORIAL_DRAFT_SYSTEM_PROMPT = `Je schrijft concepten voor redactionele
pagina's van HomeAndLivingDeals.nl: vergelijkingen, koopgidsen en collecties.

Je levert een concept. Een redacteur beoordeelt het daarna; niets van wat je
schrijft gaat automatisch online.

Wat je mag:
- de gegeven feiten structureren en begrijpelijk samenvatten;
- een korte redactionele hook schrijven;
- verschillen uitleggen die rechtstreeks uit de gegeven criteriumwaarden volgen;
- een SEO-title en meta description voorstellen;
- FAQ-vragen voorstellen die met de inhoud van deze pagina te beantwoorden zijn.

Wat je nooit mag:
- productspecificaties, afmetingen, materialen of functies verzinnen;
- een ontbrekende criteriumwaarde alsnog invullen; ontbreekt die, dan noem je haar niet;
- suggereren dat wij een product hebben getest wanneer dat niet bij de feiten staat;
- gebruikerservaringen, geluidsbeleving of duurzaamheidsoordelen verzinnen;
- prijzen, kortingen, percentages of besparingen berekenen of noemen; de applicatie
  toont die zelf uit onze eigen metingen;
- veiligheid of geschiktheid voor een leeftijd verzinnen; gebruik alleen de
  opgegeven leeftijdsindicatie van de fabrikant;
- een product aanbevelen omdat er een vergoeding aan hangt — die informatie krijg
  je niet en zij mag geen rol spelen;
- dezelfde pagina in tientallen zoekvarianten herhalen.

Schrijf uitsluitend Nederlands, rustig en concreet, zonder uitroeptekens en zonder
superlatieven. Zeg eerlijk wat wij niet weten.`

/** De feiten als tekst voor het model; alleen wat gecontroleerd is. */
export function buildDraftPrompt(facts: EditorialDraftFacts): string {
  const products = facts.products
    .map((product) => {
      const criteria = product.verifiedCriteria
        .map((entry) => `    - ${entry.label}: ${entry.value}${entry.unit ? ` ${entry.unit}` : ''}`)
        .join('\n')
      return [
        `- ${product.title}${product.brand ? ` (${product.brand})` : ''}${product.isAlternative ? ' [alternatief]' : ''}`,
        `    - gecontroleerde criteria:${criteria.length > 0 ? `\n${criteria}` : ' geen'}`,
        product.missingCriteria.length > 0
          ? `    - niet opgegeven door de bron (niet noemen als feit): ${product.missingCriteria.join(', ')}`
          : '',
        product.knownCaveat ? `    - bekend aandachtspunt: ${product.knownCaveat}` : '',
        `    - eigen ervaring: ${product.experienceType === 'HANDS_ON_TESTED' ? 'zelf gebruikt' : 'niet zelf gebruikt'}`,
      ]
        .filter((line) => line.length > 0)
        .join('\n')
    })
    .join('\n')

  return `Type pagina: ${archetypeFor(facts.type).label}
Zoekvraag van de bezoeker: ${facts.primaryQuery}
Zoekintentie: ${searchIntentLabels[facts.searchIntent]}
Doelgroep: ${facts.audience ?? 'niet opgegeven'}
Situatie: ${facts.useCase ?? 'niet opgegeven'}
Budget: ${facts.budgetMaxCents === null ? 'geen grens opgegeven' : budgetSentence(facts)}
Zelf getest: ${facts.handsOnTested ? 'ja, vastgelegd' : 'nee'}

Vergelijkingscriteria:
${facts.criteria.map((criterion) => `- ${criterion.label}: ${criterion.explanation}`).join('\n') || '- geen criteria opgegeven'}

Producten:
${products || '- geen producten opgegeven'}

Goedgekeurde bronnen:
${facts.sources.map((source) => `- ${source.typeLabel}: ${source.title}`).join('\n') || '- geen bronnen opgegeven'}

Antwoord uitsluitend met JSON: introduction, methodology, selectionCriteria,
conclusion, seoTitle, metaDescription, frequentlyAskedQuestions (question, answer).`
}
