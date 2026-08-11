import { describe, expect, it } from 'vitest'
import {
  buildDraftPrompt,
  buildTemplateDraft,
  editorialDraftSchema,
  EDITORIAL_DRAFT_SYSTEM_PROMPT,
  findDraftProblems,
  type EditorialDraftFacts,
} from '@/lib/ai/editorial-draft'
import { parseEditorialBriefs, editorialBriefTemplate, slugFromTitle } from '@/lib/csv/editorial-brief'
import { parseProductImport, productImportTemplate } from '@/lib/csv/product-import'

function facts(overrides: Partial<EditorialDraftFacts> = {}): EditorialDraftFacts {
  return {
    type: 'COMPARISON',
    primaryQuery: 'welke koffiemolen past bij mijn espressomachine',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
    audience: 'thuisbaristas met een espressomachine',
    useCase: 'espresso zetten op een klein aanrecht',
    budgetMinCents: null,
    budgetMaxCents: 50_000,
    criteria: [
      { label: 'Maalgraden', explanation: 'Aantal instelbare standen.', unit: 'standen' },
      { label: 'Bonenreservoir', explanation: 'Inhoud in gram.', unit: 'g' },
    ],
    products: [
      {
        productId: 'p1',
        title: 'Voorbeeldmolen 40',
        brand: 'Voorbeeldmerk',
        currentPriceCents: 24_900,
        verifiedCriteria: [{ label: 'Maalgraden', value: '40', unit: 'standen' }],
        missingCriteria: ['Bonenreservoir'],
        knownCaveat: 'De doserlade is klein.',
        experienceType: 'NOT_TESTED',
        isAlternative: false,
      },
      {
        productId: 'p2',
        title: 'Voorbeeldmolen 60',
        brand: 'Voorbeeldmerk',
        currentPriceCents: 39_900,
        verifiedCriteria: [
          { label: 'Maalgraden', value: '60', unit: 'standen' },
          { label: 'Bonenreservoir', value: '250', unit: 'g' },
        ],
        missingCriteria: [],
        knownCaveat: null,
        experienceType: 'NOT_TESTED',
        isAlternative: false,
      },
      {
        productId: 'p3',
        title: 'Voorbeeldmolen mini',
        brand: null,
        currentPriceCents: 14_900,
        verifiedCriteria: [{ label: 'Maalgraden', value: '20', unit: 'standen' }],
        missingCriteria: ['Bonenreservoir'],
        knownCaveat: null,
        experienceType: 'NOT_TESTED',
        isAlternative: true,
      },
    ],
    sources: [{ typeLabel: 'documentatie van de fabrikant', title: 'Handleiding Voorbeeldmolen 40' }],
    handsOnTested: false,
    ...overrides,
  }
}

describe('AI-draft voor een redactionele pagina', () => {
  it('levert een geldig concept dat altijd review nodig heeft', () => {
    const result = buildTemplateDraft(facts())
    expect(editorialDraftSchema.safeParse(result.draft).success).toBe(true)
    expect(result.needsReview).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('claimt geen eigen ervaring zonder eigen test', () => {
    const notTested = buildTemplateDraft(facts())
    expect(notTested.draft.introduction).toContain('niet zelf gebruikt')
    expect(findDraftProblems(notTested.draft, facts())).toEqual([])

    // Een draft die het wél beweert, wordt geweigerd.
    const claiming = {
      ...notTested.draft,
      introduction: `${notTested.draft.introduction} Wij hebben deze molens zelf getest.`,
    }
    const problems = findDraftProblems(claiming, facts())
    expect(problems.join(' ')).toContain('eigen test')

    // Met een vastgelegde eigen test mag de tekst er wel over gaan.
    expect(findDraftProblems(claiming, facts({ handsOnTested: true }))).toEqual([])
  })

  it('noemt in de methodologie dat vergoeding geen rol speelt', () => {
    const result = buildTemplateDraft(facts())
    expect(result.draft.methodology).toContain('vergoeding')
    expect(result.draft.methodology).toContain('geen rol')
  })

  it('rekent zelf geen prijzen of percentages uit', () => {
    const result = buildTemplateDraft(facts())
    for (const text of [
      result.draft.introduction,
      result.draft.methodology,
      result.draft.conclusion,
    ]) {
      expect(text).not.toMatch(/\d+\s?%/)
    }
    // Een percentage in de tekst wordt geweigerd.
    const withPercentage = { ...result.draft, conclusion: 'Deze molen is 20% goedkoper.' }
    expect(findDraftProblems(withPercentage, facts()).join(' ')).toContain('kortingspercentages')
  })

  it('weigert een draft die een ontbrekend criterium alsnog invult', () => {
    const result = buildTemplateDraft(facts())
    const invented = {
      ...result.draft,
      conclusion: `${result.draft.conclusion} Bonenreservoir: 250 gram bij alle drie.`,
    }
    expect(findDraftProblems(invented, facts()).join(' ')).toContain('Bonenreservoir')
  })

  it('geeft de AI alleen gecontroleerde feiten en benoemt wat ontbreekt', () => {
    const prompt = buildDraftPrompt(facts())
    expect(prompt).toContain('Maalgraden: 40 standen')
    expect(prompt).toContain('niet opgegeven door de bron (niet noemen als feit): Bonenreservoir')
    expect(prompt).toContain('[alternatief]')
    expect(prompt).toContain('niet zelf gebruikt')
    expect(prompt).toContain('documentatie van de fabrikant')
  })

  it('verbiedt in de instructie precies wat niet mag', () => {
    for (const rule of [
      'productspecificaties, afmetingen, materialen of functies verzinnen',
      'een ontbrekende criteriumwaarde alsnog invullen',
      'prijzen, kortingen, percentages of besparingen berekenen',
      'omdat er een vergoeding aan hangt',
      'veiligheid of geschiktheid voor een leeftijd verzinnen',
      'Een redacteur beoordeelt het daarna',
    ]) {
      expect(EDITORIAL_DRAFT_SYSTEM_PROMPT).toContain(rule)
    }
  })

  it('past de tekst aan het archetype aan', () => {
    const design = buildTemplateDraft(facts({ type: 'DESIGN_COLLECTION' }))
    expect(design.draft.methodology).toContain('geen winnaar')
    const comparison = buildTemplateDraft(facts())
    expect(comparison.draft.methodology).toContain('doelgroep')
  })
})

describe('editorial brief-import', () => {
  it('leest het eigen sjabloon foutloos', () => {
    const { briefs, errors } = parseEditorialBriefs(editorialBriefTemplate())
    expect(errors).toEqual([])
    expect(briefs).toHaveLength(1)
    expect(briefs[0]?.pageType).toBe('COMPARISON')
    expect(briefs[0]?.selectedProductIds).toEqual(['prod_1', 'prod_2', 'prod_3', 'prod_4'])
    expect(briefs[0]?.comparisonCriteria).toHaveLength(4)
    expect(briefs[0]?.budgetMaxCents).toBe(50_000)
    expect(briefs[0]?.scheduledPublishAt?.toISOString().slice(0, 10)).toBe('2026-09-01')
  })

  it('weigert een regel met een onbekend archetype of zonder vraag', () => {
    const csv = [
      'pageType,workingTitle,primaryQuery',
      'ONBEKEND,Een titel die lang genoeg is,welke molen past hier',
      'COMPARISON,Een titel die lang genoeg is,kort',
    ].join('\n')
    const { briefs, errors } = parseEditorialBriefs(csv)
    expect(briefs).toHaveLength(0)
    expect(errors).toHaveLength(2)
    expect(errors[0]?.line).toBe(2)
  })

  it('weigert een uitgelicht product dat niet in de selectie staat', () => {
    const csv = [
      'pageType,workingTitle,primaryQuery,selectedProductIds,featuredProductId',
      'COMPARISON,Koffiemolens voor thuis vergeleken,welke koffiemolen past bij mij,prod_1;prod_2,prod_9',
    ].join('\n')
    const { briefs, errors } = parseEditorialBriefs(csv)
    expect(briefs).toHaveLength(0)
    expect(errors[0]?.message).toContain('featuredProductId')
  })

  it('maakt een leesbare slug', () => {
    expect(slugFromTitle('Koffiemolens onder €500 vergeleken')).toBe('koffiemolens-onder-500-vergeleken')
    expect(slugFromTitle('Bankséts mét accénten')).toBe('banksets-met-accenten')
  })
})

describe('productimport', () => {
  it('leest het eigen sjabloon foutloos', () => {
    const { rows, errors } = parseProductImport(productImportTemplate())
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.currentPriceCents).toBe(24_900)
    expect(rows[0]?.referencePriceCents).toBe(29_900)
    expect(rows[0]?.shippingCostCents).toBe(495)
    expect(rows[0]?.inStock).toBe(true)
    expect(rows[0]?.specifications).toEqual({ Maalgraden: '40', Bonenreservoir: '250 g' })
  })

  it('weigert rijen zonder prijs, afbeelding of URL', () => {
    const csv = [
      'merchantSlug,externalId,title,category,price,url,imageUrl,imageAlt',
      'winkel,1,Een product met een nette titel,Keuken & Apparaten,,https://a.example/p,https://a.example/i.jpg,Alt',
      'winkel,2,Een product met een nette titel,Keuken & Apparaten,10,,https://a.example/i.jpg,Alt',
      'winkel,3,Een product met een nette titel,Keuken & Apparaten,10,https://a.example/p,,Alt',
    ].join('\n')
    const { rows, errors } = parseProductImport(csv)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(3)
  })

  it('bewaart geen referentieprijs die niet hoger is dan de prijs', () => {
    const csv = [
      'merchantSlug,externalId,title,category,price,referencePrice,url,imageUrl,imageAlt',
      'winkel,1,Een product met een nette titel,Keuken & Apparaten,"49,95","39,95",https://a.example/p,https://a.example/i.jpg,Alt',
    ].join('\n')
    const { rows } = parseProductImport(csv)
    expect(rows[0]?.referencePriceCents).toBeNull()
    expect(rows[0]?.referencePriceType).toBeNull()
  })

  it('behandelt onbekende voorraad niet als op voorraad', () => {
    const csv = [
      'merchantSlug,externalId,title,category,price,url,imageUrl,imageAlt,inStock',
      'winkel,1,Een product met een nette titel,Keuken & Apparaten,10,https://a.example/p,https://a.example/i.jpg,Alt,misschien',
    ].join('\n')
    const { rows } = parseProductImport(csv)
    expect(rows[0]?.inStock).toBe(false)
  })
})
