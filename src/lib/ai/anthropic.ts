import Anthropic from '@anthropic-ai/sdk'
import { serverEnv } from '@/lib/env'
import { errorMessage, logger } from '@/lib/logger'
import {
  firstSentence,
  lastSentence,
  openingHash,
  openingStyleDescriptions,
} from '@/lib/ai/style/openings'
import { checkVoice, STYLE_VERSION, type StyleContentType } from '@/lib/ai/style/voice'
import {
  buildEvidenceSummary,
  type EditorialContentProvider,
  type EditorialGenerationResult,
  type ProductFacts,
} from '@/lib/ai/provider'
import {
  checkContentStyle,
  editorialContentJsonSchema,
  editorialContentSchema,
} from '@/lib/ai/schema'
import { buildTemplateContent } from '@/lib/ai/template'

export const ANTHROPIC_PROMPT_VERSION = 'anthropic-2026-08-nl-2'

/** Geëxporteerd zodat tests de afspraken in de instructie kunnen controleren. */
export const ANTHROPIC_SYSTEM_PROMPT = `Je bent redacteur bij HomeAndLivingDeals.nl, een Nederlands
discovery-commerce magazine voor bijzondere, slimme en soms licht absurde producten
voor in en om het huis.

Tone of voice: nieuwsgierig, menselijk, kort, licht geestig, soms enthousiast,
concreet, warm en geloofwaardig. Niet schreeuwerig, niet overdreven commercieel,
en nooit alsof je het product zelf hebt getest.

Regels:
- Schrijf uitsluitend Nederlands.
- Gebruik precies één concrete gebruikssituatie.
- Leg uit wat het product bijzonder maakt.
- Voeg één eerlijk aandachtspunt toe dat je uit de gegeven productfeiten kunt afleiden.
- Verzin geen materialen, afmetingen, functies, schaarste of einddatums.
- Noem geen prijzen, kortingen, percentages of bespaarde bedragen; de applicatie rekent die zelf.
- Geen overdreven superlatieven en geen "must-have"; maximaal één uitroepteken per tekst.
- Schrijf geen reviews, sterren of gebruikerservaringen.
- Neem geen fabrikantentekst letterlijk over.
- Suggereer geen eigen ervaring, tenzij bij de feiten staat dat wij het product zelf
  hebben getest. Zonder die vermelding: geen uitspraken over hoe iets voelt, klinkt,
  ruikt, hoe stil het is, hoe stevig het is of hoe lang het meegaat.
- Geef geen kwaliteits- of duurzaamheidsoordeel dat niet uit de gegeven feiten volgt.
- Onze eigen prijsmetingen staan als achtergrond bij de feiten. Zet ze niet in de tekst
  en bereken er niets uit: de website toont ze los, rechtstreeks uit de meetgegevens.

Leestekens en spelling:
- Schrijf correct Nederlands. Voeg nooit spelfouten, tikfouten of nepspreektaal toe;
  tekst hoeft niet "menselijker" gemaakt te worden en wij misleiden geen enkel systeem.
- Gebruik geen em dash (—) en geen en dash (–) als tussenzin, en geen koppelteken als
  onderbreking tussen zinsdelen. Maak er twee korte zinnen van of gebruik een komma.
- Correcte Nederlandse koppeltekens in samenstellingen blijven staan: 90-dagenprijs,
  wifi-router, prijs-kwaliteitverhouding.
- Maximaal één uitroepteken in een tekst, en geen enkel uitroepteken in de seoTitle of
  de metaDescription. Geen emoji, geen kapitalen.

Vermijd deze standaardtaal, tenzij zij inhoudelijk onvermijdelijk is: gamechanger,
must-have, naar een hoger niveau tillen, naadloos, ongeëvenaarde ervaring,
revolutionair, perfect voor iedereen, "of je nu ... of ...", in de wereld van,
laten we erin duiken, de ultieme, combineert stijl en functionaliteit,
is meer dan alleen, een vleugje, ontdek de perfecte balans,
"niet alleen ..., maar ook ...", "ideaal voor zowel ... als ...".

Zonder eigen test niet schrijven: "dat zit lekker", "wij vonden", "voelt stevig",
"werkt uitstekend", "is verrassend stil", "smaakt beter", "we hebben getest",
"na een week gebruik". Gebruik in plaats daarvan: "daar wil je zo in neerploffen",
"ziet er comfortabel uit", "volgens de fabrikant", "op basis van de opgegeven
specificaties", "vooral interessant voor", "lijkt bedoeld voor", of "zonder eigen
meting kunnen we dit niet bevestigen".

Een informele opening ("Woww...", "Kijk...", "Pohh...", "Oké, dit is slim.") mag
alleen wanneer de opdracht dat expliciet toestaat, en dan maximaal één keer. Nooit in
de seoTitle of de metaDescription.

Lengterichtlijnen: headline maximaal 75 tekens, teaser 45-70 woorden,
longDescription 120-220 woorden, seoTitle maximaal 60 tekens,
metaDescription maximaal 155 tekens.

De scores (0-100) beoordelen het product zelf: uniqueness (hoe verrassend),
story (hoeveel er over te vertellen valt), usefulness (hoe bruikbaar),
giftability (hoe cadeauwaardig).`

export function buildFactsPrompt(facts: ProductFacts): string {
  const specifications = Object.entries(facts.specifications ?? {})
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')

  const experience =
    facts.experienceType === 'HANDS_ON_TESTED'
      ? 'De redactie heeft dit product zelf gebruikt; eigen ervaring mag in de tekst.'
      : facts.experienceType === 'DESK_RESEARCHED'
        ? 'Bureauonderzoek: wij hebben dit product NIET zelf gebruikt. Suggereer geen eigen ervaring.'
        : 'Wij hebben dit product NIET zelf gebruikt. Suggereer geen eigen ervaring.'

  const analysis = facts.priceAnalysis
  const analysisLines = analysis
    ? [
        `- ${analysis.numberOfObservedPrices} eigen prijsmeting(en) over ${analysis.historyDays} dag(en)`,
        `- ${analysis.numberOfComparedMerchants} vergeleken aanbieder(s)`,
        ...analysis.statements.map((statement) => `- alleen als achtergrond, niet in de tekst: "${statement}"`),
      ].join('\n')
    : '- nog geen eigen prijshistorie'

  const list = (values: readonly string[] | undefined, empty: string) =>
    values && values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : `- ${empty}`

  const openingInstruction = facts.openingStyle
    ? `Openingsstijl voor de teaser: ${facts.openingStyle} (${openingStyleDescriptions[facts.openingStyle]}).`
    : 'Kies zelf een opening die bij het product en de feiten past.'
  const informalInstruction = facts.allowInformalOpening
    ? 'Een informele opening mag hier, maximaal één en alleen in de teaser.'
    : 'Geen informele opening in deze tekst.'

  return `Schrijf redactionele content voor dit product. Gebruik alleen onderstaande feiten.

${openingInstruction}
${informalInstruction}

Titel: ${facts.title}
Merk: ${facts.brand ?? 'onbekend'}
Model: ${facts.model ?? 'onbekend'}
Categorie: ${facts.primaryCategory}
Aanbieder: ${facts.merchantName}
Aantal aanbieders dat wij volgen: ${facts.merchantCount ?? 1}
Databronnen: ${(facts.dataSources ?? ['merchant-feed']).join(', ')}
Prijs laatst gecontroleerd: ${facts.lastCheckedAt ? facts.lastCheckedAt.toISOString() : 'onbekend'}
Ervaring: ${experience}
Omschrijving van de aanbieder: ${facts.shortSourceDescription ?? 'niet beschikbaar'}
Gecontroleerde specificaties:
${specifications.length > 0 ? specifications : '- geen aanvullende specificaties beschikbaar'}
Onze eigen prijsanalyse:
${analysisLines}
Bekende voordelen:
${list(facts.knownPros, 'geen bekend')}
Bekende aandachtspunten:
${list(facts.knownCons, 'geen bekend')}
Vergelijkbare producten die wij volgen:
${list(facts.comparableAlternatives, 'geen bekend')}

Antwoord uitsluitend met JSON volgens het opgegeven schema.`
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
}

/**
 * Anthropic-provider. Valideert de output met Zod, doet maximaal één
 * gecontroleerde retry en valt daarna terug op templatecontent. Er wordt nooit
 * kapotte JSON opgeslagen, en deze code loopt nooit tijdens een paginaweergave.
 */
export function createAnthropicProvider(): EditorialContentProvider {
  const env = serverEnv()
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  async function attempt(facts: ProductFacts, retryHint?: string): Promise<EditorialGenerationResult> {
    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: ANTHROPIC_SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: editorialContentJsonSchema,
        },
      },
      messages: [
        {
          role: 'user',
          content: retryHint
            ? `${buildFactsPrompt(facts)}\n\nJe vorige antwoord was ongeldig: ${retryHint}`
            : buildFactsPrompt(facts),
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      throw new Error('model weigerde het verzoek')
    }

    const raw = extractText(response.content)
    const parsed = editorialContentSchema.safeParse(JSON.parse(raw) as unknown)
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
    }

    const warnings = checkContentStyle(parsed.data).map((issue) => `${issue.field}: ${issue.message}`)
    const contentType: StyleContentType = facts.priceAnalysis?.hasPriceDrop ? 'DEAL' : 'GENERIC'
    const styleWarnings = [
      ...checkVoice(parsed.data.teaser, {
        surface: 'TEASER',
        contentType,
        ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
        ...(facts.allowInformalOpening === undefined
          ? {}
          : { allowInformalOpening: facts.allowInformalOpening }),
      }),
      ...checkVoice(parsed.data.longDescription, {
        surface: 'BODY',
        contentType,
        ...(facts.experienceType ? { experienceType: facts.experienceType } : {}),
      }),
      ...checkVoice(parsed.data.seoTitle, { surface: 'SEO_TITLE', contentType }),
      ...checkVoice(parsed.data.metaDescription, { surface: 'META_DESCRIPTION', contentType }),
    ].map((issue) => `${issue.surface}: ${issue.message}`)

    return {
      content: parsed.data,
      provider: 'anthropic',
      promptVersion: ANTHROPIC_PROMPT_VERSION,
      // Echte AI-content wordt altijd door een mens beoordeeld voordat zij
      // indexeerbaar is. Stijlafwijkingen komen daar als waarschuwing bij.
      needsReview: true,
      warnings,
      model: env.ANTHROPIC_MODEL,
      evidenceSummary: buildEvidenceSummary(facts),
      openingStyle: facts.openingStyle ?? null,
      openingHash: openingHash(firstSentence(parsed.data.teaser)),
      closingHash: openingHash(lastSentence(parsed.data.longDescription)),
      styleVersion: STYLE_VERSION,
      styleWarnings,
    }
  }

  return {
    name: 'anthropic',
    promptVersion: ANTHROPIC_PROMPT_VERSION,
    async generate(facts) {
      if (!env.ANTHROPIC_API_KEY) {
        logger.warn('ANTHROPIC_API_KEY ontbreekt; val terug op templatecontent', {
          title: facts.title,
        })
        return fallback(facts, 'geen API-key beschikbaar')
      }
      try {
        return await attempt(facts)
      } catch (firstError) {
        const reason = errorMessage(firstError)
        logger.warn('AI-content ongeldig, één retry', { title: facts.title, reason })
        try {
          return await attempt(facts, reason)
        } catch (secondError) {
          const secondReason = errorMessage(secondError)
          logger.error('AI-content opnieuw ongeldig; templatecontent gebruikt', {
            title: facts.title,
            reason: secondReason,
          })
          return fallback(facts, secondReason)
        }
      }
    },
  }
}

function fallback(facts: ProductFacts, reason: string): EditorialGenerationResult {
  const result = buildTemplateContent(facts)
  return {
    ...result,
    needsReview: true,
    warnings: [...result.warnings, `anthropic-fallback: ${reason}`],
  }
}
