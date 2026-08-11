import { describe, expect, it } from 'vitest'
import type { EditorialPageType } from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { checkFeaturedProduct, labelsForType } from '@/lib/editorial/featured'
import { evaluateEditorialIndexability, evaluateProductIndexability } from '@/lib/editorial/quality-gate'
import { numericFromValue, rankProducts } from '@/lib/editorial/ranking'
import type { EditorialGateInput } from '@/lib/editorial/quality-gate'

const now = new Date('2026-08-11T12:00:00.000Z')
const recently = new Date(now.getTime() - 60 * 60 * 1000)

function product(overrides: Partial<EditorialGateInput['products'][number]> = {}) {
  return {
    productId: 'p1',
    status: 'PUBLISHED' as const,
    imageStatus: 'VALID' as const,
    hasActiveOffer: true,
    priceCheckedAt: recently,
    currentPriceCents: 24_900,
    role: 'SELECTED' as const,
    caveat: 'De doserlade is klein; naschenken hoort erbij.',
    exceedsBudget: false,
    budgetNote: null,
    ...overrides,
  }
}

/** Vier producten met vier gecontroleerde criteria: een geldige vergelijking. */
function validInput(overrides: Partial<EditorialGateInput> = {}): EditorialGateInput {
  const criterionNames = ['grind-settings', 'bean-hopper', 'noise-level', 'warranty']
  const products = ['p1', 'p2', 'p3', 'p4'].map((productId) => product({ productId }))
  const criterionValues = products.flatMap((entry) =>
    criterionNames.map((criterionName) => ({
      productId: entry.productId,
      criterionName,
      value: '40',
      verificationStatus: 'VERIFIED' as const,
      hasSource: true,
      sourceRequired: true,
    })),
  )

  return {
    type: 'COMPARISON',
    status: 'PUBLISHED',
    primaryQuery: 'welke koffiemolen past bij mijn espressomachine',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
    introduction: 'x'.repeat(240),
    methodology: 'y'.repeat(120),
    selectionCriteria: 'Maalgraden, bonenreservoir, geluidsniveau en garantie.',
    seoTitle: 'Koffiemolens voor thuis vergeleken',
    metaDescription: 'Vier koffiemolens vergeleken op maalgraden, reservoir en garantie, met dagelijkse prijzen.',
    seoTitleUnique: true,
    metaDescriptionUnique: true,
    reviewedAt: recently,
    lastFactCheckedAt: recently,
    budgetMinCents: null,
    budgetMaxCents: null,
    heroImageValid: true,
    products,
    criterionNames,
    criterionValues,
    sourceCount: 2,
    disallowedSourceCount: 0,
    featured: {
      productId: 'p2',
      label: 'Beste voor beginners',
      reason: 'Van de vier molens heeft deze de meeste maalgraden bij het kleinste bonenreservoir.',
      caveat: 'Het reservoir is klein: bijvullen hoort bij het gebruik.',
      alternativeNote: null,
    },
    overlap: null,
    hasInboundLink: true,
    now,
    ...overrides,
  }
}

describe('quality gate voor redactionele pagina&apos;s', () => {
  it('laat een complete vergelijking door', () => {
    const verdict = evaluateEditorialIndexability(validInput())
    expect(verdict).toEqual({ indexable: true, reasons: [] })
  })

  it.each([
    ['status', { status: 'DRAFT' as const }, 'niet PUBLISHED'],
    ['review', { reviewedAt: null }, 'review'],
    ['primaryQuery', { primaryQuery: 'kort' }, 'primaryQuery'],
    ['methodologie', { methodology: null }, 'methodologie'],
    ['bronnen', { sourceCount: 0 }, 'geen bronnen'],
    ['fact-check', { lastFactCheckedAt: null }, 'fact-check'],
    ['unieke SEO-title', { seoTitleUnique: false }, 'SEO-title is niet uniek'],
    ['interne link', { hasInboundLink: false }, 'verweesde pagina'],
  ])('blokkeert zonder %s', (_name, overrides, expected) => {
    const verdict = evaluateEditorialIndexability(validInput(overrides as Partial<EditorialGateInput>))
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' | ')).toContain(expected)
  })

  it('vraagt het minimumaantal producten per archetype', () => {
    const types: EditorialPageType[] = ['COMPARISON', 'GIFT_GUIDE', 'DISCOVERY_COLLECTION']
    for (const type of types) {
      const minimum = archetypeFor(type).minProducts
      const tooFew = Array.from({ length: minimum - 1 }, (_, index) => product({ productId: `p${index}` }))
      const verdict = evaluateEditorialIndexability(
        validInput({ type, products: tooFew, criterionNames: [], criterionValues: [] }),
      )
      expect(verdict.indexable, type).toBe(false)
      if (!verdict.indexable) {
        expect(verdict.reasons.join(' ')).toContain(`minimaal ${minimum} producten`)
      }
    }
    // Een vergelijking vraagt er minimaal drie; twee is dus te weinig.
    expect(archetypeFor('COMPARISON').minProducts).toBe(3)
  })

  it('vraagt minimaal vier echte vergelijkingscriteria', () => {
    const input = validInput()
    const verdict = evaluateEditorialIndexability({
      ...input,
      criterionNames: input.criterionNames.slice(0, 3),
      criterionValues: input.criterionValues.filter(
        (value) => value.criterionName !== 'warranty',
      ),
    })
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('minimaal 4 vergelijkingscriteria')
  })

  it('vult een ontbrekende criteriumwaarde niet aan maar blokkeert indexering', () => {
    const input = validInput()
    // Eén waarde weggehaald: de tabel toont "Niet opgegeven" en de pagina wacht.
    const withoutOne = input.criterionValues.filter(
      (value) => !(value.productId === 'p3' && value.criterionName === 'noise-level'),
    )
    const verdict = evaluateEditorialIndexability({ ...input, criterionValues: withoutOne })
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('nog niet ingevuld')

    // Een ongecontroleerde waarde telt ook niet als bekend.
    const unverified = input.criterionValues.map((value) =>
      value.productId === 'p3' ? { ...value, verificationStatus: 'UNVERIFIED' as const } : value,
    )
    const second = evaluateEditorialIndexability({ ...input, criterionValues: unverified })
    expect(second.indexable).toBe(false)
    if (!second.indexable) expect(second.reasons.join(' ')).toContain('niet gecontroleerd')

    // Expliciet "niet opgegeven" is wél een geldige, eerlijke uitkomst.
    const notProvided = input.criterionValues.map((value) =>
      value.productId === 'p3' && value.criterionName === 'noise-level'
        ? { ...value, value: null, verificationStatus: 'NOT_PROVIDED' as const, hasSource: false }
        : value,
    )
    expect(evaluateEditorialIndexability({ ...input, criterionValues: notProvided }).indexable).toBe(true)
  })

  it('blokkeert een gecontroleerde waarde zonder bron', () => {
    const input = validInput()
    const withoutSource = input.criterionValues.map((value) =>
      value.productId === 'p1' ? { ...value, hasSource: false } : value,
    )
    const verdict = evaluateEditorialIndexability({ ...input, criterionValues: withoutSource })
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('missen een bron')
  })

  it('weigert een budgetgids met een product boven budget zonder markering', () => {
    const base = validInput({
      type: 'BUDGET_GUIDE',
      budgetMaxCents: 50_000,
      criterionNames: ['grind-settings', 'bean-hopper', 'warranty'],
    })
    const products = base.products.map((entry, index) =>
      index === 0 ? { ...entry, currentPriceCents: 62_500 } : entry,
    )
    const criterionValues = products.flatMap((entry) =>
      ['grind-settings', 'bean-hopper', 'warranty'].map((criterionName) => ({
        productId: entry.productId,
        criterionName,
        value: '10',
        verificationStatus: 'VERIFIED' as const,
        hasSource: true,
        sourceRequired: true,
      })),
    )

    const verdict = evaluateEditorialIndexability({ ...base, products, criterionValues })
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('boven het budget zonder uitleg')

    // Mét markering én uitleg mag het product wel mee.
    const marked = products.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            exceedsBudget: true,
            budgetNote: 'Net boven de grens, maar de enige met een gesloten maalwerk.',
          }
        : entry,
    )
    expect(
      evaluateEditorialIndexability({ ...base, products: marked, criterionValues }).indexable,
    ).toBe(true)
  })

  it('blokkeert een budgetgids zonder budgetgrens', () => {
    const verdict = evaluateEditorialIndexability(validInput({ type: 'BUDGET_GUIDE', budgetMaxCents: null }))
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('budgetgrens')
  })

  it('weigert een product zonder aandachtspunt of met een verouderde prijs', () => {
    const noCaveat = validInput()
    noCaveat.products = noCaveat.products.map((entry, index) =>
      index === 1 ? { ...entry, caveat: null } : entry,
    )
    const first = evaluateEditorialIndexability(noCaveat)
    expect(first.indexable).toBe(false)
    if (!first.indexable) expect(first.reasons.join(' ')).toContain('missen een aandachtspunt')

    const stale = validInput()
    stale.products = stale.products.map((entry, index) =>
      index === 0
        ? { ...entry, priceCheckedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
        : entry,
    )
    const second = evaluateEditorialIndexability(stale)
    expect(second.indexable).toBe(false)
    if (!second.indexable) expect(second.reasons.join(' ')).toContain('te oude prijscontrole')
  })

  it('blokkeert bij sterke overlap met bestaande content', () => {
    const verdict = evaluateEditorialIndexability(
      validInput({
        overlap: {
          level: 'block',
          recommendation: 'samenvoegen',
          matches: [],
          reasons: ['bijna dezelfde producten als "Koffiemolens onder 500 euro"'],
        },
      }),
    )
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('sterke overlap')
  })
})

describe('uitgelicht product', () => {
  const base = {
    pageType: 'COMPARISON' as EditorialPageType,
    productId: 'p2',
    label: 'Beste voor beginners',
    reason: 'Deze molen heeft de meeste maalgraden van de vier en het kleinste footprint.',
    caveat: 'Het bonenreservoir is klein.',
    alternativeNote: 'Wie veel achter elkaar maalt, kiest beter het grotere model.',
    verifiedCriteriaCount: 4,
    hasAudienceOrUseCase: true,
    hasMethodology: true,
    alternativeCount: 2,
  }

  it('vraagt minimaal één aandachtspunt', () => {
    expect(checkFeaturedProduct(base)).toEqual([])
    const problems = checkFeaturedProduct({ ...base, caveat: null })
    expect(problems.map((problem) => problem.field)).toContain('featuredCaveat')
    expect(problems.map((problem) => problem.message).join(' ')).toContain('aandachtspunt')
  })

  it('vraagt een reden die aan criteria hangt en een doelgroep', () => {
    expect(checkFeaturedProduct({ ...base, reason: 'Gewoon goed.' }).length).toBeGreaterThan(0)
    expect(checkFeaturedProduct({ ...base, hasAudienceOrUseCase: false }).length).toBeGreaterThan(0)
    expect(checkFeaturedProduct({ ...base, verifiedCriteriaCount: 1 }).length).toBeGreaterThan(0)
  })

  it('vraagt bij alternatieven wanneer een alternatief beter past', () => {
    const problems = checkFeaturedProduct({ ...base, alternativeNote: null })
    expect(problems.map((problem) => problem.field)).toContain('featuredAlternativeNote')
  })

  it('staat "beste overall" niet toe bij smaak of zonder methodologie', () => {
    const design = checkFeaturedProduct({
      ...base,
      pageType: 'DESIGN_COLLECTION',
      label: 'Beste overall',
    })
    expect(design.map((problem) => problem.message).join(' ')).toContain('smaak')
    expect(labelsForType('DESIGN_COLLECTION')).not.toContain('Beste overall')

    const withoutMethodology = checkFeaturedProduct({
      ...base,
      label: 'Beste overall',
      hasMethodology: false,
    })
    expect(withoutMethodology.map((problem) => problem.message).join(' ')).toContain('methodologie')
  })

  it('controleert niets wanneer er geen uitgelicht product is', () => {
    expect(checkFeaturedProduct({ ...base, productId: null })).toEqual([])
  })
})

describe('rangorde binnen een vergelijking', () => {
  const criteria = (values: Record<string, number | null>) =>
    Object.entries(values).map(([criterionName, numericValue]) => ({
      criterionName,
      numericValue,
      higherIsBetter: criterionName === 'noise-level' ? false : true,
      verified: true,
    }))

  it('rangschikt op gecontroleerde criteria', () => {
    const ranked = rankProducts([
      {
        productId: 'goedkoop',
        values: criteria({ 'grind-settings': 10, 'noise-level': 70 }),
        currentPriceCents: 9_900,
        priceConfidence: 'LOW',
      },
      {
        productId: 'beste',
        values: criteria({ 'grind-settings': 40, 'noise-level': 60 }),
        currentPriceCents: 49_900,
        priceConfidence: 'LOW',
      },
    ])
    expect(ranked[0]?.productId).toBe('beste')
  })

  it('laat een affiliatevergoeding de score niet beïnvloeden', () => {
    // De score kent geen commissie, netwerk of merchant: dezelfde criteria geven
    // dezelfde score, ongeacht welke extra velden er aan een object hangen.
    const values = criteria({ 'grind-settings': 30, 'noise-level': 65 })
    const plain = rankProducts([
      { productId: 'a', values, currentPriceCents: 19_900, priceConfidence: 'MEDIUM' },
      {
        productId: 'b',
        values: criteria({ 'grind-settings': 20, 'noise-level': 65 }),
        currentPriceCents: 19_900,
        priceConfidence: 'MEDIUM',
      },
    ])
    const withCommission = rankProducts([
      {
        // Extra velden worden genegeerd: de functie leest ze niet.
        ...({ commissionPercentage: 15, affiliateNetwork: 'AWIN' } as unknown as Record<string, never>),
        productId: 'a',
        values,
        currentPriceCents: 19_900,
        priceConfidence: 'MEDIUM',
      },
      {
        ...({ commissionPercentage: 0 } as unknown as Record<string, never>),
        productId: 'b',
        values: criteria({ 'grind-settings': 20, 'noise-level': 65 }),
        currentPriceCents: 19_900,
        priceConfidence: 'MEDIUM',
      },
    ])
    expect(withCommission).toEqual(plain)

    // En het product met de betere criteria staat bovenaan, niet dat met de
    // hoogste vergoeding.
    expect(plain[0]?.productId).toBe('a')
  })

  it('geeft een ongecontroleerde of onmeetbare waarde geen voordeel', () => {
    const ranked = rankProducts([
      {
        productId: 'gecontroleerd',
        values: [
          { criterionName: 'grind-settings', numericValue: 20, higherIsBetter: true, verified: true },
        ],
        currentPriceCents: 19_900,
        priceConfidence: null,
      },
      {
        productId: 'ongecontroleerd',
        values: [
          { criterionName: 'grind-settings', numericValue: 60, higherIsBetter: true, verified: false },
          { criterionName: 'material', numericValue: null, higherIsBetter: null, verified: true },
        ],
        currentPriceCents: 19_900,
        priceConfidence: null,
      },
    ])
    expect(ranked[0]?.productId).toBe('gecontroleerd')
    expect(ranked.find((entry) => entry.productId === 'ongecontroleerd')?.comparableCriteria).toBe(0)
  })

  it('leest getallen uit tekst en weigert een gok', () => {
    expect(numericFromValue('1,4 kg')).toBeCloseTo(1.4)
    expect(numericFromValue('40 standen')).toBe(40)
    expect(numericFromValue('ja')).toBe(1)
    expect(numericFromValue('nee')).toBe(0)
    expect(numericFromValue('roestvrij staal')).toBeNull()
    expect(numericFromValue(null)).toBeNull()
    expect(numericFromValue('')).toBeNull()
  })
})

describe('quality gate voor productpagina&apos;s', () => {
  const base = {
    status: 'PUBLISHED' as const,
    imageStatus: 'VALID' as const,
    hasEditorial: true,
    editorialReviewedAt: recently,
    activeOfferCount: 1,
    specificationCount: 3,
    observedPriceCount: 12,
    ownTextLength: 900,
    sourceTextLength: 200,
    experienceType: 'NOT_TESTED' as const,
    isDemo: false,
    demoContentEnabled: false,
    hasCategoryLink: true,
    hasClusterLink: true,
  }

  it('laat een product met eigen inhoud door', () => {
    expect(evaluateProductIndexability(base)).toEqual({ indexable: true, reasons: [] })
  })

  it('weigert een pagina die vooral merchanttekst is', () => {
    const verdict = evaluateProductIndexability({ ...base, ownTextLength: 210, sourceTextLength: 200 })
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('overgenomen merchanttekst')
  })

  it('weigert zonder actieve aanbieding, zonder review en zonder eigen gegevens', () => {
    expect(evaluateProductIndexability({ ...base, activeOfferCount: 0 }).indexable).toBe(false)
    expect(evaluateProductIndexability({ ...base, editorialReviewedAt: null }).indexable).toBe(false)
    expect(
      evaluateProductIndexability({ ...base, specificationCount: 0, observedPriceCount: 1 }).indexable,
    ).toBe(false)
  })

  it('indexeert nooit demo-inhoud', () => {
    const verdict = evaluateProductIndexability({ ...base, isDemo: true, demoContentEnabled: true })
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) expect(verdict.reasons.join(' ')).toContain('demo')
  })

  it('weigert een product dat niet vanuit een categorie of cluster te vinden is', () => {
    expect(evaluateProductIndexability({ ...base, hasCategoryLink: false }).indexable).toBe(false)
    expect(evaluateProductIndexability({ ...base, hasClusterLink: false }).indexable).toBe(false)
  })
})
