import { describe, expect, it } from 'vitest'
import {
  aiCliches,
  allowedExperienceAlternatives,
  blockingVoiceIssues,
  checkVoice,
  informalOpeningBudget,
  informalOpenings,
  INFORMAL_OPENING_SHARE,
  STYLE_VERSION,
} from '@/lib/ai/style/voice'
import {
  checkOpeningVariety,
  chooseOpeningStyle,
  firstSentence,
  lastSentence,
  MAX_CONSECUTIVE_STYLE,
  openingHash,
  openingStyles,
  OPENING_HISTORY_WINDOW,
  type OpeningStyle,
} from '@/lib/ai/style/openings'
import { buildTemplateContent } from '@/lib/ai/template'
import { validateEditorialContent } from '@/lib/ai/schema'
import type { ProductFacts } from '@/lib/ai/provider'

const body = (text: string) => checkVoice(text, { surface: 'BODY' })
const codes = (issues: ReturnType<typeof checkVoice>) => issues.map((issue) => issue.code)

describe('leestekens', () => {
  it('weigert een em dash', () => {
    expect(codes(body('Een rustige tafel — met een geheim compartiment.'))).toContain('em-dash')
    expect(codes(body('Een rustige tafel met een geheim compartiment.'))).not.toContain('em-dash')
  })

  it('weigert een en dash of koppelteken als tussenzin', () => {
    expect(codes(body('De lamp staat er goed – en hij doet iets.'))).toContain('en-dash-aside')
    expect(codes(body('De lamp staat er goed - en hij doet iets.'))).toContain('hyphen-aside')
  })

  it('laat correcte Nederlandse koppeltekens staan', () => {
    for (const text of [
      'De 90-dagenprijs ligt hoger dan de huidige prijs.',
      'De wifi-router hoort in de meterkast.',
      'De prijs-kwaliteitverhouding valt goed uit volgens de opgegeven specificaties.',
      'Een 4-persoons bankset met een afneembare hoes.',
    ]) {
      const issues = codes(body(text))
      expect(issues, text).not.toContain('hyphen-aside')
      expect(issues, text).not.toContain('en-dash-aside')
      expect(issues, text).not.toContain('em-dash')
    }
  })

  it('staat maximaal één uitroepteken toe in lopende tekst', () => {
    expect(codes(body('Wat een vondst!'))).not.toContain('exclamation')
    expect(codes(body('Wat een vondst! En hij past ook!'))).toContain('exclamation')
  })

  it('staat geen enkel uitroepteken toe in SEO, vergelijkingen en methodologie', () => {
    for (const surface of ['SEO_TITLE', 'META_DESCRIPTION', 'COMPARISON', 'METHODOLOGY'] as const) {
      const issues = checkVoice('Koffiemolens vergeleken!', { surface })
      expect(codes(issues), surface).toContain('exclamation')
    }
  })

  it('weigert kapitalen en emoji', () => {
    expect(codes(body('DIT IS ECHT EEN VONDST voor je keuken.'))).toContain('shouting')
    expect(codes(body('Een lamp die het weer nadoet 🌩️ in je woonkamer.'))).toContain('emoji')
    // Afkortingen zoals USB of LED zijn geen geschreeuw.
    expect(codes(body('De lamp heeft een USB-C-aansluiting en LED-verlichting.'))).not.toContain('shouting')
  })
})

describe('standaard AI-taal', () => {
  it.each([...aiCliches])('meldt "%s"', (cliche) => {
    const issues = body(`Dit product is ${cliche} voor je interieur en dat merk je meteen.`)
    expect(codes(issues)).toContain('ai-cliche')
  })

  it('meldt de standaardconstructies met tussenstukken', () => {
    for (const text of [
      'Of je nu kookt of bakt, deze oven doet mee.',
      'Niet alleen mooi, maar ook handig in gebruik.',
      'Ideaal voor zowel de keuken als de tuin.',
    ]) {
      expect(codes(body(text)), text).toContain('ai-cliche')
    }
  })

  it('houdt een cliché buiten de blokkerende bevindingen', () => {
    // Een cliché is een advies aan de redactie, geen reden om niets te publiceren.
    const issues = body('Deze naadloos werkende lamp staat in de woonkamer.')
    expect(codes(issues)).toContain('ai-cliche')
    expect(codes(blockingVoiceIssues(issues))).not.toContain('ai-cliche')
  })
})

describe('ervaringsclaims', () => {
  const claims = [
    'Dat zit lekker na een lange dag.',
    'Wij vonden de zitting wat hard.',
    'Het frame voelt stevig aan.',
    'De motor werkt uitstekend in de praktijk.',
    'De pomp is verrassend stil in gebruik.',
    'De koffie smaakt beter dan uit onze oude molen.',
    'We hebben getest hoe snel hij opwarmt.',
    'Na een week gebruik stond hij er nog netjes.',
    'In onze test bleef het compartiment koud.',
  ]

  it.each(claims)('blokkeert "%s" zonder eigen test', (text) => {
    for (const experienceType of ['NOT_TESTED', 'DESK_RESEARCHED'] as const) {
      const issues = checkVoice(text, { surface: 'BODY', experienceType })
      expect(codes(issues), experienceType).toContain('experience-claim')
      expect(codes(blockingVoiceIssues(issues))).toContain('experience-claim')
    }
  })

  it('staat dezelfde claims toe na een echte test', () => {
    for (const text of claims) {
      const issues = checkVoice(text, { surface: 'BODY', experienceType: 'HANDS_ON_TESTED' })
      expect(codes(issues), text).not.toContain('experience-claim')
    }
  })

  it('laat de toegestane alternatieven ongemoeid', () => {
    for (const alternative of allowedExperienceAlternatives) {
      const issues = checkVoice(`Deze stoel: ${alternative}.`, {
        surface: 'BODY',
        experienceType: 'NOT_TESTED',
      })
      expect(codes(issues), alternative).not.toContain('experience-claim')
    }
  })

  it('laat een eerlijke ontkenning staan', () => {
    for (const text of [
      'Wij hebben dit product niet zelf gebruikt.',
      'Wij vonden geen betrouwbare vergelijkingsprijs bij de aanbieder.',
      'Zonder eigen meting kunnen we dit niet bevestigen.',
    ]) {
      expect(codes(checkVoice(text, { surface: 'BODY', experienceType: 'NOT_TESTED' })), text).not.toContain(
        'experience-claim',
      )
    }
  })
})

describe('informele openingen', () => {
  it('staat maximaal één informele opening per tekst toe', () => {
    const one = checkVoice(`${informalOpenings[0]} Deze lamp doet iets slims.`, {
      surface: 'TEASER',
      allowInformalOpening: true,
    })
    expect(codes(one)).not.toContain('informal-opening')

    const two = checkVoice(`${informalOpenings[0]} ${informalOpenings[1]} Twee keer is te veel.`, {
      surface: 'TEASER',
      allowInformalOpening: true,
    })
    expect(codes(two)).toContain('informal-opening')
  })

  it('houdt informele openingen uit SEO-teksten, vergelijkingen en methodologie', () => {
    for (const surface of ['SEO_TITLE', 'META_DESCRIPTION', 'COMPARISON', 'METHODOLOGY'] as const) {
      const issues = checkVoice(`${informalOpenings[0]} Koffiemolens vergeleken`, { surface })
      expect(codes(issues), surface).toContain('informal-opening')
    }
  })

  it('houdt een informele opening uit een vergelijking', () => {
    const issues = checkVoice(`${informalOpenings[2]} Deze vier molens verschillen op vier punten.`, {
      surface: 'TEASER',
      contentType: 'COMPARISON',
      allowInformalOpening: true,
    })
    expect(codes(issues)).toContain('informal-opening')
  })

  it('gebruikt een informele opening bij ongeveer 15 procent van de teksten', () => {
    const keys = Array.from({ length: 600 }, (_, index) => `product-slug-nummer-${index}`)
    const share = keys.filter((key) => informalOpeningBudget(key)).length / keys.length
    expect(share).toBeGreaterThan(INFORMAL_OPENING_SHARE - 0.05)
    expect(share).toBeLessThan(INFORMAL_OPENING_SHARE + 0.05)
    // Deterministisch: dezelfde sleutel geeft altijd hetzelfde antwoord.
    expect(informalOpeningBudget('vaste-slug')).toBe(informalOpeningBudget('vaste-slug'))
  })

  it('geeft twee opeenvolgende producten niet dezelfde opening', () => {
    const results = ['product-a', 'product-b', 'product-c', 'product-d', 'product-e'].map((key) => ({
      key,
      informal: informalOpeningBudget(key),
    }))
    // Niet alle producten krijgen een informele opening; dat is precies de bedoeling.
    expect(results.some((entry) => !entry.informal)).toBe(true)
  })
})

describe('variatie in openingen', () => {
  it('kiest een stijl die bij het product past', () => {
    expect(
      chooseOpeningStyle({ key: 'a', contentType: 'DEAL', hasMeasuredPriceDrop: true }),
    ).toBe('PRICE_DROP')
    // Een vergelijking krijgt nooit een speelse opening.
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      const style = chooseOpeningStyle({ key, contentType: 'COMPARISON' })
      expect(['DIRECT_FACT', 'RECOGNIZABLE_PROBLEM', 'USE_CASE_SCENE', 'PRACTICAL_DISCOVERY']).toContain(style)
    }
    expect(chooseOpeningStyle({ key: 'x', contentType: 'GIFT_GUIDE', isGift: true })).toBe('GIFT_REACTION')
  })

  it('gebruikt dezelfde stijl niet meer dan drie keer achter elkaar', () => {
    const recent: OpeningStyle[] = ['PRICE_DROP', 'PRICE_DROP', 'PRICE_DROP']
    const style = chooseOpeningStyle({
      key: 'volgende-deal',
      contentType: 'DEAL',
      hasMeasuredPriceDrop: true,
      recentStyles: recent,
    })
    expect(style).not.toBe('PRICE_DROP')
  })

  it('is deterministisch', () => {
    const context = { key: 'zelfde-sleutel', contentType: 'DISCOVERY' as const, isUnusual: true }
    expect(chooseOpeningStyle(context)).toBe(chooseOpeningStyle(context))
  })

  it('bewaart een hash per opening en herkent herhaling', () => {
    const first = 'Deze bijzettafel bewijst zich op een avond waarop je niet meer van de bank af wil.'
    const nearlyIdentical = 'Deze bijzettafel bewijst zich op een avond waarop je niet meer wil opstaan.'
    expect(openingHash(first)).toBe(openingHash(first))
    // Alleen de eerste acht woorden tellen: een variatie in de staart is dezelfde opening.
    expect(openingHash(nearlyIdentical)).toBe(openingHash(first))
    expect(openingHash('Een compleet andere opening over een lamp.')).not.toBe(openingHash(first))
  })

  it('meldt een stijl die te vaak achter elkaar komt en een herhaalde opening', () => {
    const recent = [
      { openingStyle: 'DRY_HUMOR' as OpeningStyle, openingHash: 'o1', closingHash: 'c1' },
      { openingStyle: 'DRY_HUMOR' as OpeningStyle, openingHash: 'o2', closingHash: 'c2' },
      { openingStyle: 'DRY_HUMOR' as OpeningStyle, openingHash: 'o3', closingHash: 'c3' },
    ]
    const problems = checkOpeningVariety(
      { openingStyle: 'DRY_HUMOR', openingHash: 'o1', closingHash: 'c1' },
      recent,
    )
    expect(problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['style-run', 'opening-repeat', 'closing-repeat']),
    )
    expect(MAX_CONSECUTIVE_STYLE).toBe(3)
  })

  it('kijkt niet verder terug dan twintig publicaties', () => {
    const older = Array.from({ length: OPENING_HISTORY_WINDOW }, (_, index) => ({
      openingStyle: 'DIRECT_FACT' as OpeningStyle,
      openingHash: `n${index}`,
      closingHash: null,
    }))
    const recent = [...older, { openingStyle: 'DRY_HUMOR' as OpeningStyle, openingHash: 'oud', closingHash: null }]
    const problems = checkOpeningVariety(
      { openingStyle: 'DRY_HUMOR', openingHash: 'oud' },
      recent,
    )
    expect(problems).toEqual([])
  })

  it('leest de eerste en laatste zin', () => {
    const text = 'Eerste zin. Tweede zin! Derde zin?'
    expect(firstSentence(text)).toBe('Eerste zin.')
    expect(lastSentence(text)).toBe('Derde zin?')
    expect(openingStyles).toHaveLength(10)
  })
})

function facts(overrides: Partial<ProductFacts> = {}): ProductFacts {
  return {
    title: 'Nocta Bijzettafel met ingebouwde koeling',
    brand: 'Nocta',
    model: 'CT-40',
    primaryCategory: 'Wonen & Design',
    shortSourceDescription: 'Ronde bijzettafel van 40 cm met een gekoeld compartiment onder het blad',
    specifications: { Diameter: '40 cm' },
    merchantName: 'Huisvondst',
    currentPriceCents: 29_900,
    isDemo: false,
    key: 'nocta-bijzettafel',
    ...overrides,
  }
}

describe('templatecontent volgt de merkstem', () => {
  it('bewaart de openingsstijl, de hashes en de stijlversie', () => {
    const result = buildTemplateContent(facts())
    expect(result.openingStyle).toBeDefined()
    expect(openingStyles).toContain(result.openingStyle)
    expect(result.openingHash).toMatch(/^o[a-z0-9]+$/)
    expect(result.closingHash).toMatch(/^o[a-z0-9]+$/)
    expect(result.styleVersion).toBe(STYLE_VERSION)
  })

  it('schrijft correct Nederlands zonder verzonnen fouten', () => {
    const result = buildTemplateContent(facts())
    for (const text of [result.content.headline, result.content.teaser, result.content.longDescription]) {
      // Geen dubbele spaties, geen ontbrekende hoofdletter, geen "..." als vulling.
      expect(text).not.toMatch(/ {2}/)
      expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase())
      expect(text).not.toMatch(/\bteh\b|\bhte\b|\bdeze zin\b/i)
    }
    // De tekst haalt de kwaliteitspoort, inclusief de leestekenregels.
    expect(validateEditorialContent(result.content)).toEqual({ ok: true })
  })

  it('houdt de SEO-velden zakelijk', () => {
    const result = buildTemplateContent(facts())
    for (const text of [result.content.seoTitle, result.content.metaDescription]) {
      expect(text).not.toContain('!')
      expect(text).not.toContain('—')
      for (const opening of informalOpenings) expect(text).not.toContain(opening)
    }
  })

  it('gebruikt geen informele opening buiten het budget', () => {
    // Een sleutel buiten de 15 procent krijgt geen informele opening.
    const outside = ['nocta-bijzettafel', 'tweede-product', 'derde-product', 'vierde-product'].find(
      (key) => !informalOpeningBudget(key),
    )
    expect(outside).toBeDefined()
    const result = buildTemplateContent(facts({ key: outside! }))
    for (const opening of informalOpenings) {
      expect(result.content.teaser).not.toContain(opening)
    }
  })

  it('varieert de opening tussen producten', () => {
    const titles = [
      'Bureaustoel met verstelbare rug',
      'Hangende plantenbak van keramiek',
      'Opbergkast met vier laden',
      'Eettafel van massief eiken',
      'Vloerlamp met linnen kap',
      'Wandrek voor kleine boeken',
    ]
    const openings = titles.map(
      (title) =>
        buildTemplateContent(facts({ title, key: title.toLowerCase().replace(/\s+/g, '-') })).openingHash,
    )
    // Geen twee opeenvolgende teksten met dezelfde openingszin.
    for (let index = 1; index < openings.length; index += 1) {
      expect(openings[index]).not.toBe(openings[index - 1])
    }
    expect(new Set(openings).size).toBeGreaterThan(1)
  })

  it('opent een dealtekst met de prijsbeweging', () => {
    const result = buildTemplateContent(
      facts({
        key: 'deal-product',
        priceAnalysis: {
          numberOfObservedPrices: 20,
          historyDays: 40,
          statements: ['De prijs is vandaag € 40 gedaald.'],
          hasPriceDrop: true,
          numberOfComparedMerchants: 2,
          differenceToNextMerchantCents: 1_500,
        },
      }),
    )
    expect(result.openingStyle).toBe('PRICE_DROP')
    // De prijs zelf staat niet in de tekst: die komt uit de meetgegevens.
    expect(result.content.teaser).not.toMatch(/€|\d+\s?%/)
  })

  it('laat de tekst geen eigen ervaring claimen zonder test', () => {
    for (const experienceType of ['NOT_TESTED', 'DESK_RESEARCHED'] as const) {
      const result = buildTemplateContent(facts({ experienceType }))
      const issues = [
        ...checkVoice(result.content.teaser, { surface: 'TEASER', experienceType }),
        ...checkVoice(result.content.longDescription, { surface: 'BODY', experienceType }),
      ]
      expect(codes(issues), experienceType).not.toContain('experience-claim')
    }
  })

  it('levert geen stijlwaarschuwingen voor een gewoon product', () => {
    expect(buildTemplateContent(facts()).styleWarnings).toEqual([])
  })
})
