import Anthropic from '@anthropic-ai/sdk'
import { serverEnv } from '@/lib/env'
import { errorMessage, logger } from '@/lib/logger'
import type {
  EditorialContentProvider,
  EditorialGenerationResult,
  ProductFacts,
} from '@/lib/ai/provider'
import {
  checkContentStyle,
  editorialContentJsonSchema,
  editorialContentSchema,
} from '@/lib/ai/schema'
import { buildTemplateContent } from '@/lib/ai/template'

export const ANTHROPIC_PROMPT_VERSION = 'anthropic-2026-08-nl-1'

const systemPrompt = `Je bent redacteur bij HomeAndLivingDeals.nl, een Nederlands
discovery-commerce magazine voor bijzondere, slimme en soms licht absurde producten
voor in en om het huis.

Tone of voice: nieuwsgierig, menselijk, kort, licht geestig, warm en geloofwaardig.
Niet schreeuwerig en nooit alsof je het product zelf hebt getest.

Regels:
- Schrijf uitsluitend Nederlands.
- Gebruik precies één concrete gebruikssituatie.
- Leg uit wat het product bijzonder maakt.
- Voeg één eerlijk aandachtspunt toe dat je uit de gegeven productfeiten kunt afleiden.
- Verzin geen materialen, afmetingen, functies, schaarste of einddatums.
- Noem geen prijzen, kortingen, percentages of bespaarde bedragen; de applicatie rekent die zelf.
- Geen uitroeptekens, geen overdreven superlatieven, geen "must-have".
- Schrijf geen reviews, sterren of gebruikerservaringen.
- Neem geen fabrikantentekst letterlijk over.

Lengterichtlijnen: headline maximaal 75 tekens, teaser 45-70 woorden,
longDescription 120-220 woorden, seoTitle maximaal 60 tekens,
metaDescription maximaal 155 tekens.

De scores (0-100) beoordelen het product zelf: uniqueness (hoe verrassend),
story (hoeveel er over te vertellen valt), usefulness (hoe bruikbaar),
giftability (hoe cadeauwaardig).`

function factsToPrompt(facts: ProductFacts): string {
  const specifications = Object.entries(facts.specifications ?? {})
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')

  return `Schrijf redactionele content voor dit product. Gebruik alleen onderstaande feiten.

Titel: ${facts.title}
Merk: ${facts.brand ?? 'onbekend'}
Model: ${facts.model ?? 'onbekend'}
Categorie: ${facts.primaryCategory}
Aanbieder: ${facts.merchantName}
Omschrijving van de aanbieder: ${facts.shortSourceDescription ?? 'niet beschikbaar'}
Specificaties uit brondata:
${specifications.length > 0 ? specifications : '- geen aanvullende specificaties beschikbaar'}

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
      system: systemPrompt,
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
            ? `${factsToPrompt(facts)}\n\nJe vorige antwoord was ongeldig: ${retryHint}`
            : factsToPrompt(facts),
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
    return {
      content: parsed.data,
      provider: 'anthropic',
      promptVersion: ANTHROPIC_PROMPT_VERSION,
      // Stijlafwijkingen betekenen review, geen afkeuring.
      needsReview: warnings.length > 0,
      warnings,
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
