import { describe, expect, it } from 'vitest'
import { checkContentStyle, editorialContentSchema } from '@/lib/ai/schema'
import { buildTemplateContent } from '@/lib/ai/template'
import { factsFingerprint, type ProductFacts } from '@/lib/ai/provider'
import { wordCount } from '@/lib/utils'

const facts: ProductFacts = {
  title: 'Nocta Bijzettafel met ingebouwde koeling',
  brand: 'Nocta',
  model: 'CT-40',
  primaryCategory: 'Wonen & Design',
  shortSourceDescription: 'Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad',
  specifications: { Diameter: '40 cm', Koelcompartiment: '4 liter' },
  merchantName: 'Huisvondst',
  currentPriceCents: 29_900,
  isDemo: true,
}

const validPayload = {
  headline: 'Deze bijzettafel verstopt een koelkast naast je bank',
  teaser:
    'Aan de buitenkant lijkt het een rustige ronde bijzettafel. Binnenin houdt hij vier liter drinken koud, terwijl de rand ook als laadpunt voor je telefoon werkt. Volstrekt overbodig, totdat je op één avond niet meer wilt opstaan voor iets koud. De aanbieder noemt achtendertig decibel, dus je hoort hem zachtjes meedraaien in een stille kamer.',
  longDescription: 'x'.repeat(400),
  whyItStandsOut: 'Twee functies die je nooit in hetzelfde meubel verwacht, achter een rustige vorm.',
  bestFor: ['lange avonden op de bank', 'kleine woonkamers'],
  caveat: 'Er zit een compressor in: in een stille kamer hoor je hem zachtjes aanslaan.',
  seoTitle: 'Nocta bijzettafel met koeling en USB-C',
  metaDescription:
    'Ronde bijzettafel met een gekoeld compartiment van 4 liter en USB-C in de rand. Prijs dagelijks gecontroleerd.',
  tags: ['wonen', 'design'],
  uniquenessScore: 92,
  storyScore: 90,
  usefulnessScore: 64,
  giftabilityScore: 78,
}

describe('validatie van AI-output', () => {
  it('accepteert geldige content', () => {
    expect(editorialContentSchema.safeParse(validPayload).success).toBe(true)
  })

  it('weigert ontbrekende velden', () => {
    const withoutCaveat: Record<string, unknown> = { ...validPayload }
    delete withoutCaveat.caveat
    expect(editorialContentSchema.safeParse(withoutCaveat).success).toBe(false)
  })

  it('weigert scores buiten 0 tot 100', () => {
    expect(editorialContentSchema.safeParse({ ...validPayload, uniquenessScore: 140 }).success).toBe(false)
    expect(editorialContentSchema.safeParse({ ...validPayload, storyScore: -1 }).success).toBe(false)
  })

  it('weigert een te lange meta description', () => {
    expect(editorialContentSchema.safeParse({ ...validPayload, metaDescription: 'a'.repeat(200) }).success).toBe(
      false,
    )
  })

  it('weigert een leeg bestFor-veld', () => {
    expect(editorialContentSchema.safeParse({ ...validPayload, bestFor: [] }).success).toBe(false)
  })

  it('weigert kapotte JSON-structuren', () => {
    expect(editorialContentSchema.safeParse('geen object').success).toBe(false)
    expect(editorialContentSchema.safeParse(null).success).toBe(false)
  })
})

describe('stijlcontrole', () => {
  it('meldt uitroeptekens en kortingspercentages in redactionele tekst', () => {
    const issues = checkContentStyle({
      ...editorialContentSchema.parse(validPayload),
      headline: 'Nu 25% korting op deze tafel!',
    })
    expect(issues.some((issue) => issue.message.includes('uitroeptekens'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('kortingspercentages'))).toBe(true)
  })

  it('meldt de bewering dat wij zelf hebben getest', () => {
    const issues = checkContentStyle({
      ...editorialContentSchema.parse(validPayload),
      teaser: `${validPayload.teaser} Wij hebben dit getest en het werkt goed.`,
    })
    expect(issues.some((issue) => issue.message.includes('getest'))).toBe(true)
  })
})

describe('templateprovider', () => {
  it('levert geldige content zonder externe dienst', () => {
    const result = buildTemplateContent(facts)
    expect(editorialContentSchema.safeParse(result.content).success).toBe(true)
    expect(result.provider).toBe('template')
    // Templatecontent is voorlopig en moet altijd beoordeeld worden.
    expect(result.needsReview).toBe(true)
  })

  it('houdt zich aan de lengterichtlijnen', () => {
    const result = buildTemplateContent(facts)
    expect(wordCount(result.content.teaser)).toBeGreaterThanOrEqual(45)
    expect(wordCount(result.content.teaser)).toBeLessThanOrEqual(70)
    expect(wordCount(result.content.longDescription)).toBeGreaterThanOrEqual(120)
    expect(wordCount(result.content.longDescription)).toBeLessThanOrEqual(220)
    expect(result.content.headline.length).toBeLessThanOrEqual(75)
    expect(result.content.seoTitle.length).toBeLessThanOrEqual(60)
    expect(result.content.metaDescription.length).toBeLessThanOrEqual(155)
  })

  it('noemt geen prijzen of percentages', () => {
    const result = buildTemplateContent(facts)
    for (const text of [result.content.teaser, result.content.longDescription, result.content.headline]) {
      expect(text).not.toMatch(/€|\d+\s?%/)
    }
  })

  it('is deterministisch', () => {
    expect(buildTemplateContent(facts).content).toEqual(buildTemplateContent(facts).content)
  })

  it('geeft producten binnen dezelfde categorie niet allemaal dezelfde kop', () => {
    const titles = [
      'Bureaustoel met verstelbare rug',
      'Hangende plantenbak van keramiek',
      'Opbergkast met vier laden',
      'Eettafel van massief eiken',
      'Vloerlamp met linnen kap',
      'Wandrek voor kleine boeken',
    ]
    const headlines = titles.map(
      (title) => buildTemplateContent({ ...facts, title, brand: null, model: null }).content.headline,
    )
    expect(new Set(headlines).size).toBeGreaterThan(1)
  })

  it('beweert niets over afmetingen of materialen in het aandachtspunt', () => {
    const result = buildTemplateContent({ ...facts, primaryCategory: 'Wonen & Design' })
    expect(result.content.caveat).not.toMatch(/\d+\s?(cm|mm|kg|liter)/i)
  })
})

describe('vingerafdruk van productfeiten', () => {
  it('verandert wanneer belangrijke feiten wijzigen', () => {
    const base = factsFingerprint(facts)
    expect(factsFingerprint({ ...facts })).toBe(base)
    expect(factsFingerprint({ ...facts, title: 'Andere titel' })).not.toBe(base)
    expect(factsFingerprint({ ...facts, specifications: { Diameter: '50 cm' } })).not.toBe(base)
  })

  it('verandert niet door een prijswijziging', () => {
    expect(factsFingerprint({ ...facts, currentPriceCents: 19_900 })).toBe(factsFingerprint(facts))
  })
})
