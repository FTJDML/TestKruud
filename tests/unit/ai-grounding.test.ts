import { describe, expect, it } from 'vitest'
import { ANTHROPIC_SYSTEM_PROMPT, buildFactsPrompt } from '@/lib/ai/anthropic'
import {
  buildEvidenceSummary,
  factsFingerprint,
  mayClaimFirstHandExperience,
  type ProductFacts,
} from '@/lib/ai/provider'
import { buildTemplateContent } from '@/lib/ai/template'
import {
  editorialContentSchema,
  findExperienceClaims,
  validateEditorialContent,
} from '@/lib/ai/schema'

/**
 * AI-content mag alleen bestaan uit gecontroleerde feiten. Twee dingen worden
 * hier hard vastgelegd: er wordt nooit eerstehandservaring gesuggereerd zonder
 * echte test, en prijsuitspraken komen kant-en-klaar uit onze eigen analyse.
 */
const facts: ProductFacts = {
  title: 'Nocta Bijzettafel met ingebouwde koeling',
  brand: 'Nocta',
  model: 'CT-40',
  primaryCategory: 'Wonen & Design',
  shortSourceDescription: 'Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad',
  specifications: { Diameter: '40 cm' },
  merchantName: 'Huisvondst',
  currentPriceCents: 29_900,
  isDemo: false,
  merchantCount: 2,
  dataSources: ['merchant-feed', 'eigen-prijsmeting'],
  lastCheckedAt: new Date('2026-08-11T06:00:00.000Z'),
  priceAnalysis: {
    numberOfObservedPrices: 42,
    historyDays: 95,
    statements: ['Deze prijs ligt 18% onder onze 90-dagenmediaan.', 'De prijs is vandaag € 40 gedaald.'],
    hasPriceDrop: true,
    numberOfComparedMerchants: 2,
    differenceToNextMerchantCents: 2_000,
  },
}

/** Geldige content waarin precies één zin eigen ervaring suggereert. */
function payloadWithClaim(sentence: string) {
  const base = buildTemplateContent(facts).content
  return editorialContentSchema.parse({ ...base, teaser: `${base.teaser} ${sentence}` })
}

describe('eerstehandservaring', () => {
  it('mag alleen na een echte test', () => {
    expect(mayClaimFirstHandExperience({ ...facts, experienceType: 'HANDS_ON_TESTED' })).toBe(true)
    expect(mayClaimFirstHandExperience({ ...facts, experienceType: 'DESK_RESEARCHED' })).toBe(false)
    expect(mayClaimFirstHandExperience({ ...facts, experienceType: 'NOT_TESTED' })).toBe(false)
    // Zonder waarde is het antwoord ook nee.
    expect(mayClaimFirstHandExperience(facts)).toBe(false)
  })

  it.each([
    'Wij hebben dit product zelf gebruikt en het werkt prima.',
    'Wij hebben deze tafel getest in onze eigen woonkamer.',
    'In onze test bleef het compartiment koud.',
    'Wij vonden de rand aan de smalle kant.',
    'Tijdens ons gebruik viel het geluid mee.',
    'Na twee weken gebruik zag het er nog goed uit.',
    'Onze ervaring met dit soort meubels is positief.',
  ])('blokkeert "%s" zonder eigen test', (sentence) => {
    const payload = payloadWithClaim(sentence)
    const blockers = findExperienceClaims(payload, 'NOT_TESTED')
    expect(blockers).toHaveLength(1)
    expect(blockers[0]?.field).toBe('teaser')
    expect(blockers[0]?.message).toContain('eigen ervaring')

    // Bureauonderzoek is ook geen eigen ervaring.
    expect(findExperienceClaims(payload, 'DESK_RESEARCHED')).toHaveLength(1)
    // Na een echte test mag het wel.
    expect(findExperienceClaims(payload, 'HANDS_ON_TESTED')).toEqual([])
  })

  it('houdt de kwaliteitspoort dicht voor een verzonnen ervaring', () => {
    const payload = payloadWithClaim('Wij hebben dit product zelf getest.')
    const blocked = validateEditorialContent(payload, { experienceType: 'NOT_TESTED' })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reasons.join(' ')).toContain('eigen ervaring')

    expect(validateEditorialContent(payload, { experienceType: 'HANDS_ON_TESTED' }).ok).toBe(true)
    // Zonder opgave geldt de strengste variant: niet getest.
    expect(validateEditorialContent(payload).ok).toBe(false)
  })

  it('laat gewone zinnen over prijs volgen en aanbieders staan', () => {
    for (const sentence of [
      'Wij volgen de prijs en de voorraad bij deze aanbieder.',
      'Wij controleren dagelijks wat dit product kost.',
      'De verkoop en verzending liggen bij de aanbieder zelf.',
      // Over onze eigen prijsmetingen mag het wel gaan.
      'Wij hebben de prijs 42 dagen gemeten.',
      'Wij vonden geen betrouwbare vergelijkingsprijs bij de aanbieder.',
    ]) {
      expect(findExperienceClaims(payloadWithClaim(sentence), 'NOT_TESTED'), sentence).toEqual([])
    }
  })

  it('schrijft de template zonder eigen ervaring wanneer er niet is getest', () => {
    for (const experienceType of ['NOT_TESTED', 'DESK_RESEARCHED'] as const) {
      const result = buildTemplateContent({ ...facts, experienceType })
      expect(findExperienceClaims(result.content, experienceType), experienceType).toEqual([])
      expect(validateEditorialContent(result.content, { experienceType }).ok, experienceType).toBe(true)
      expect(result.evidenceSummary).toContain('niet zelf getest')
    }
  })

  it('mag de eigen ervaring wél noemen na een echte test', () => {
    const result = buildTemplateContent({ ...facts, experienceType: 'HANDS_ON_TESTED' })
    expect(result.content.teaser).toContain('Wij hebben dit product zelf gebruikt.')
    expect(validateEditorialContent(result.content, { experienceType: 'HANDS_ON_TESTED' }).ok).toBe(true)
    expect(result.evidenceSummary).toContain('zelf getest door de redactie')
  })

  it('zegt de AI in de instructie dat eigen ervaring verboden is', () => {
    expect(ANTHROPIC_SYSTEM_PROMPT).toContain('Suggereer geen eigen ervaring')
    expect(ANTHROPIC_SYSTEM_PROMPT).toContain('geen reviews')

    const notTested = buildFactsPrompt({ ...facts, experienceType: 'NOT_TESTED' })
    expect(notTested).toContain('NIET zelf gebruikt')
    const desk = buildFactsPrompt({ ...facts, experienceType: 'DESK_RESEARCHED' })
    expect(desk).toContain('Bureauonderzoek')
    expect(desk).toContain('NIET zelf gebruikt')
    const tested = buildFactsPrompt({ ...facts, experienceType: 'HANDS_ON_TESTED' })
    expect(tested).toContain('zelf gebruikt; eigen ervaring mag in de tekst')
  })
})

describe('onderbouwing van AI-content', () => {
  it('houdt prijsuitspraken buiten de tekst en laat de AI niets berekenen', () => {
    const prompt = buildFactsPrompt(facts)
    expect(prompt).toContain('42 eigen prijsmeting(en) over 95 dag(en)')
    expect(prompt).toContain('2 vergeleken aanbieder(s)')
    // De zinnen gaan mee als achtergrond, met de instructie ze niet te gebruiken.
    expect(prompt).toContain('alleen als achtergrond, niet in de tekst')
    expect(ANTHROPIC_SYSTEM_PROMPT).toContain('Zet ze niet in de tekst')
    expect(ANTHROPIC_SYSTEM_PROMPT).toContain('de applicatie rekent die zelf')
  })

  it('zet zelf geen prijs of percentage in de opgeslagen tekst', () => {
    // De prijsanalyse hoort op de productpagina, niet in tekst die dagen blijft
    // staan. De kwaliteitspoort blokkeert prijzen en percentages dan ook.
    const result = buildTemplateContent(facts)
    for (const text of [result.content.teaser, result.content.longDescription, result.content.headline]) {
      expect(text).not.toMatch(/€|\d+\s?%/)
    }
    expect(validateEditorialContent(result.content).ok).toBe(true)
    // Het aantal aanbieders mag wel: dat is geen bedrag en verandert niet dagelijks.
    expect(result.content.longDescription).toContain('2 aanbieders')
  })

  it('meldt eerlijk dat er nog geen prijshistorie is', () => {
    const prompt = buildFactsPrompt({ ...facts, priceAnalysis: null })
    expect(prompt).toContain('nog geen eigen prijshistorie')
    expect(prompt).not.toContain('90-dagenmediaan')
  })

  it('geeft alleen feiten mee die wij hebben, zonder verzinsels', () => {
    const prompt = buildFactsPrompt({
      ...facts,
      specifications: {},
      shortSourceDescription: null,
      knownPros: [],
      knownCons: [],
      comparableAlternatives: [],
    })
    expect(prompt).toContain('geen aanvullende specificaties beschikbaar')
    expect(prompt).toContain('Omschrijving van de aanbieder: niet beschikbaar')
    expect(prompt).toContain('Bekende voordelen:\n- geen bekend')
    expect(prompt).toContain('Bekende aandachtspunten:\n- geen bekend')
    expect(ANTHROPIC_SYSTEM_PROMPT).toContain('Verzin geen materialen')
  })

  it('vat de gebruikte feiten samen bij de content', () => {
    const summary = buildEvidenceSummary(facts)
    expect(summary).toContain('42 eigen prijsmeting(en) over 95 dag(en)')
    expect(summary).toContain('2 aanbieders vergeleken')
    expect(summary).toContain('1 gecontroleerde specificatie(s)')
    expect(summary).toContain('niet zelf getest')
  })

  it('vraagt nieuwe tekst wanneer de ervaring verandert', () => {
    const base = factsFingerprint({ ...facts, experienceType: 'NOT_TESTED' })
    expect(factsFingerprint({ ...facts, experienceType: 'HANDS_ON_TESTED' })).not.toBe(base)
    // Een nieuwe prijs vraagt geen nieuwe tekst; een extra aanbieder wel.
    expect(factsFingerprint({ ...facts, currentPriceCents: 19_900, experienceType: 'NOT_TESTED' })).toBe(base)
    expect(factsFingerprint({ ...facts, merchantCount: 3, experienceType: 'NOT_TESTED' })).not.toBe(base)
  })
})
