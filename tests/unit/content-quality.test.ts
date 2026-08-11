import { describe, expect, it } from 'vitest'
import { looksDutch, scoreLanguage } from '@/lib/ai/language'
import { validateEditorialContent, findContentBlockers } from '@/lib/ai/schema'
import { buildTemplateContent } from '@/lib/ai/template'
import type { EditorialContentPayload } from '@/lib/ai/schema'
import type { ProductFacts } from '@/lib/ai/provider'

const facts: ProductFacts = {
  title: 'Nocta Bijzettafel met ingebouwde koeling',
  brand: 'Nocta',
  model: 'CT-40',
  primaryCategory: 'Wonen & Design',
  shortSourceDescription: 'Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad',
  specifications: { Diameter: '40 cm' },
  merchantName: 'Huisvondst',
  currentPriceCents: 29_900,
  isDemo: true,
}

/** Geldige content als vertrekpunt; elke test bederft precies één veld. */
function payload(overrides: Partial<EditorialContentPayload> = {}): EditorialContentPayload {
  return {
    headline: 'Deze bijzettafel verstopt een koelkast naast je bank',
    teaser:
      'Aan de buitenkant lijkt het een rustige ronde bijzettafel. Binnenin houdt hij vier liter drinken koud, terwijl de rand ook als laadpunt voor je telefoon werkt. Handig op een avond waarop je niet meer wilt opstaan voor iets koud.',
    longDescription:
      'Op het eerste gezicht is dit een gewone bijzettafel voor de woonkamer. Kijk je beter, dan blijkt er een gekoeld compartiment onder het blad te zitten. Het verschil zit in het moment waarop je het gebruikt: op een lange avond op de bank merk je waarom iemand dit heeft gemaakt. Huisvondst verkoopt en verzendt dit product; wij verkopen zelf niets en controleren alleen de prijs. Specificaties, garantie en levertijd staan op de productpagina van de aanbieder.',
    whyItStandsOut: 'Twee functies die je nooit in hetzelfde meubel verwacht, achter een rustige vorm.',
    bestFor: ['lange avonden op de bank', 'kleine woonkamers'],
    caveat: 'Er zit een compressor in: in een stille kamer hoor je hem zachtjes aanslaan.',
    seoTitle: 'Bijzettafel met koeling en USB-C',
    metaDescription:
      'Ronde bijzettafel met een gekoeld compartiment van vier liter en USB-C in de rand. Prijs dagelijks gecontroleerd.',
    tags: ['wonen', 'design'],
    uniquenessScore: 70,
    storyScore: 65,
    usefulnessScore: 60,
    giftabilityScore: 55,
    ...overrides,
  }
}

describe('taalcontrole', () => {
  it('herkent Nederlandse brontekst', () => {
    expect(looksDutch('Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad')).toBe(true)
    expect(looksDutch('Comfortabele stoel voor dagelijks werk aan het bureau')).toBe(true)
  })

  it('herkent Engelse brontekst', () => {
    expect(looksDutch('Comfortable yellow chair for daily work')).toBe(false)
    expect(
      looksDutch('The desk organiser is perfect for storing all kinds of small things on your desk'),
    ).toBe(false)
  })

  it('geeft een heel kort fragment het voordeel van de twijfel', () => {
    expect(looksDutch('Zwart eiken')).toBe(true)
    expect(scoreLanguage('Zwart eiken').words).toBe(2)
  })
})

describe('kwaliteitspoort voor redactionele content', () => {
  it('laat geldige Nederlandse content door', () => {
    expect(validateEditorialContent(payload())).toEqual({ ok: true })
    expect(findContentBlockers(payload())).toEqual([])
  })

  it('blokkeert lege tekst', () => {
    const result = validateEditorialContent(payload({ whyItStandsOut: '   ' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(' ')).toContain('whyItStandsOut: veld is leeg')
  })

  it('blokkeert placeholders, lorem ipsum en HTML', () => {
    for (const value of [
      'Lorem ipsum dolor sit amet consectetur en dat is het',
      'Deze tekst bevat nog een TODO voor de redactie van deze pagina',
      'Een tekst met {{productnaam}} die niet is ingevuld door de generator',
      'Een tekst met <strong>opmaak</strong> die hier niet in een veld hoort',
    ]) {
      const result = validateEditorialContent(payload({ whyItStandsOut: value }))
      expect(result.ok, value).toBe(false)
    }
  })

  it('blokkeert tekst die niet Nederlands is', () => {
    const result = validateEditorialContent(
      payload({
        whyItStandsOut:
          'This side table hides a fridge and that is the kind of product you will remember for a while',
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(' ')).toContain('niet Nederlands')
  })

  it('blokkeert prijzen en kortingspercentages in redactionele tekst', () => {
    const withPercentage = validateEditorialContent(
      payload({ headline: 'Nu 25% korting op deze bijzettafel met koeling' }),
    )
    expect(withPercentage.ok).toBe(false)
    const withPrice = validateEditorialContent(
      payload({ headline: 'Deze bijzettafel kost nu € 299 bij de aanbieder' }),
    )
    expect(withPrice.ok).toBe(false)
  })

  it('blokkeert gekopieerde en herhaalde tekst', () => {
    const copied = validateEditorialContent(payload({ teaser: payload().headline }))
    expect(copied.ok).toBe(false)

    const repeated = 'Dit is precies dezelfde zin over dit product. '
    const result = validateEditorialContent(payload({ longDescription: repeated.repeat(4) }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reasons.join(' ')).toContain('herhaald')
  })

  it('blokkeert een veld in volledige hoofdletters', () => {
    const result = validateEditorialContent(payload({ headline: 'DEZE BIJZETTAFEL IS EEN KOELKAST' }))
    expect(result.ok).toBe(false)
  })
})

describe('templatecontent haalt de kwaliteitspoort', () => {
  it('is geldig voor een product met Nederlandse brondata', () => {
    const result = buildTemplateContent(facts)
    expect(validateEditorialContent(result.content)).toEqual({ ok: true })
    expect(result.content.teaser).toContain('bijzettafel')
  })

  it('neemt Engelse brondata niet over in de Nederlandse tekst', () => {
    const result = buildTemplateContent({
      ...facts,
      title: 'Office Chair',
      brand: null,
      model: null,
      shortSourceDescription: 'Comfortable yellow chair for daily work',
      specifications: {},
    })
    expect(result.content.teaser).not.toContain('Comfortable yellow chair')
    expect(result.content.longDescription).not.toContain('Comfortable yellow chair')
    expect(validateEditorialContent(result.content)).toEqual({ ok: true })
  })

  it('herhaalt geen vaste vulzinnen over alle producten', () => {
    const titles = [
      'Bureaustoel met verstelbare rug',
      'Hangende plantenbak van keramiek',
      'Opbergkast met vier laden',
      'Eettafel van massief eiken',
      'Vloerlamp met linnen kap',
      'Wandrek voor kleine boeken',
    ]
    const descriptions = titles.map(
      (title) =>
        buildTemplateContent({
          ...facts,
          title,
          brand: null,
          model: null,
          specifications: {},
          // Zonder brondata blijft alleen de sjabloontekst over; dat is precies
          // wat hier niet mag herhalen.
          shortSourceDescription: null,
        }).content.longDescription,
    )

    // Geen enkele zin mag in élke beschrijving voorkomen.
    const sentencesOfFirst = (descriptions[0] ?? '')
      .split(/(?<=\.)\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 30)
    const inAll = sentencesOfFirst.filter((sentence) =>
      descriptions.every((description) => description.includes(sentence)),
    )
    expect(inAll).toEqual([])
  })
})
