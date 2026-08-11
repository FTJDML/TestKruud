import { describe, expect, it } from 'vitest'
import {
  checkOverlap,
  jaccard,
  OVERLAP_BLOCK_THRESHOLD,
  OVERLAP_WARN_THRESHOLD,
  overlappingGroups,
  productOverlap,
  textSimilarity,
  tokenize,
  type OverlapCandidate,
} from '@/lib/editorial/overlap'
import { composeHomepage, DEFAULT_HOMEPAGE_LIMITS } from '@/lib/editorial/homepage'
import { evaluateEditorialIndexability } from '@/lib/editorial/quality-gate'
import type { ProductCardView } from '@/types'

const intro =
  'Wij vergeleken vier koffiemolens die wij zelf volgen op maalgraden, bonenreservoir en geluidsniveau, met prijzen die wij dagelijks meten.'

function page(overrides: Partial<OverlapCandidate> = {}): OverlapCandidate {
  return {
    id: 'a',
    slug: 'koffiemolens-vergeleken',
    title: 'Koffiemolens voor thuis vergeleken',
    primaryQuery: 'welke koffiemolen voor thuis past bij mijn espressomachine',
    productIds: ['p1', 'p2', 'p3', 'p4'],
    introduction: intro,
    ...overrides,
  }
}

describe('overlapcontrole', () => {
  it('meldt niets bij een andere vraag en andere producten', () => {
    const verdict = checkOverlap(page(), [
      page({
        id: 'b',
        slug: 'robotstofzuigers-kattenharen',
        title: 'Robotstofzuigers voor kattenharen',
        primaryQuery: 'welke robotstofzuiger pakt kattenharen uit een hoogpolig tapijt',
        productIds: ['r1', 'r2', 'r3'],
        introduction:
          'Kattenharen in een hoogpolig tapijt vragen zuigkracht en een borstel die geen haren opwikkelt.',
      }),
    ])
    expect(verdict.level).toBe('ok')
    expect(verdict.recommendation).toBe('geen')
  })

  it('waarschuwt bij een sterk lijkende primaryQuery', () => {
    const verdict = checkOverlap(page(), [
      page({
        id: 'b',
        slug: 'koffiemolen-espressomachine',
        title: 'Koffiemolen kiezen voor je espressomachine',
        primaryQuery: 'welke koffiemolen past bij mijn espressomachine thuis',
        productIds: ['q1', 'q2', 'q3', 'q4'],
        introduction: 'Een heel andere invalshoek, met andere producten en een andere opbouw van de pagina.',
      }),
    ])
    expect(['warn', 'block']).toContain(verdict.level)
    expect(verdict.reasons.join(' ')).toContain('primaryQuery')
    expect(verdict.matches[0]?.querySimilarity).toBeGreaterThan(0.6)
  })

  it('blokkeert twee vrijwel identieke pagina&apos;s en stelt samenvoegen voor', () => {
    const verdict = checkOverlap(page(), [page({ id: 'b', slug: 'koffiemolens-thuis-vergelijking' })])
    expect(verdict.level).toBe('block')
    expect(verdict.recommendation).toBe('samenvoegen')
    expect(verdict.matches[0]?.score).toBeGreaterThanOrEqual(OVERLAP_BLOCK_THRESHOLD)
  })

  it('stelt een canonical voor wanneer de vraag hetzelfde is maar de selectie verschilt', () => {
    const verdict = checkOverlap(page(), [
      page({
        id: 'b',
        slug: 'koffiemolens-onder-500',
        title: 'Koffiemolens onder 500 euro',
        productIds: ['p1', 'x2', 'x3', 'x4', 'x5', 'x6'],
      }),
    ])
    expect(['warn', 'block']).toContain(verdict.level)
    expect(['canonical', 'noindex', 'samenvoegen']).toContain(verdict.recommendation)
  })

  it('vergelijkt een pagina nooit met zichzelf', () => {
    const self = page()
    expect(checkOverlap(self, [self]).level).toBe('ok')
  })

  it('zet twee bijna identieke pagina&apos;s niet allebei op indexeerbaar', () => {
    const first = page()
    const second = page({ id: 'b', slug: 'koffiemolens-thuis-vergelijking' })
    const both = [first, second]

    // Beide pagina's zijn los in orde, maar de overlapcontrole blokkeert er één
    // (en met dezelfde SEO-title ook de andere).
    const verdicts = both.map((candidate) => checkOverlap(candidate, both))
    expect(verdicts.every((verdict) => verdict.level === 'block')).toBe(true)

    const gateInput = {
      type: 'COMPARISON' as const,
      status: 'PUBLISHED' as const,
      primaryQuery: first.primaryQuery,
      searchIntent: 'COMMERCIAL_INVESTIGATION' as const,
      introduction: 'x'.repeat(240),
      methodology: 'y'.repeat(120),
      selectionCriteria: 'maalgraden, reservoir, geluid, garantie',
      seoTitle: 'Koffiemolens voor thuis vergeleken',
      metaDescription:
        'Vier koffiemolens vergeleken op maalgraden, reservoir en garantie, met dagelijks gemeten prijzen.',
      seoTitleUnique: false,
      metaDescriptionUnique: false,
      reviewedAt: new Date('2026-08-10T10:00:00.000Z'),
      lastFactCheckedAt: new Date('2026-08-10T10:00:00.000Z'),
      budgetMinCents: null,
      budgetMaxCents: null,
      heroImageValid: true,
      products: ['p1', 'p2', 'p3'].map((productId) => ({
        productId,
        status: 'PUBLISHED' as const,
        imageStatus: 'VALID' as const,
        hasActiveOffer: true,
        priceCheckedAt: new Date('2026-08-11T10:00:00.000Z'),
        currentPriceCents: 19_900,
        role: 'SELECTED' as const,
        caveat: 'Het reservoir is klein.',
        exceedsBudget: false,
        budgetNote: null,
      })),
      criterionNames: [],
      criterionValues: [],
      sourceCount: 1,
      disallowedSourceCount: 0,
      featured: { productId: null, label: null, reason: null, caveat: null, alternativeNote: null },
      overlap: verdicts[0]!,
      hasInboundLink: true,
      now: new Date('2026-08-11T12:00:00.000Z'),
    }
    const verdict = evaluateEditorialIndexability(gateInput)
    expect(verdict.indexable).toBe(false)
    if (!verdict.indexable) {
      expect(verdict.reasons.join(' ')).toContain('sterke overlap')
      expect(verdict.reasons.join(' ')).toContain('niet uniek')
    }
  })

  it('groepeert concurrerende pagina&apos;s voor het dashboard', () => {
    const groups = overlappingGroups([
      page(),
      page({ id: 'b', slug: 'koffiemolens-thuis-vergelijking' }),
      page({
        id: 'c',
        slug: 'tuinvondsten',
        title: 'Balkonbarbecues vergeleken',
        primaryQuery: 'welke barbecue past op een klein balkon',
        productIds: ['t1', 't2', 't3'],
        introduction: 'Op een balkon van drie bij één is een barbecue vooral een ruimtevraagstuk.',
      }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.pages.map((entry) => entry.id).sort()).toEqual(['a', 'b'])
    expect(groups[0]?.score).toBeGreaterThan(OVERLAP_WARN_THRESHOLD)
  })

  it('rekent overeenkomsten voorspelbaar uit', () => {
    expect(tokenize('De beste koffiemolen voor thuis')).toEqual(['koffiemolen', 'thuis'])
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1)
    expect(jaccard(['a'], ['b'])).toBe(0)
    expect(productOverlap(['p1', 'p2'], ['p1', 'p2'])).toBe(1)
    expect(productOverlap(['p1'], ['p2'])).toBe(0)
    expect(textSimilarity(intro, intro)).toBe(1)
    expect(textSimilarity(intro, 'Een compleet andere tekst over balkonbarbecues.')).toBeLessThan(0.2)
  })
})

function card(id: string): ProductCardView {
  return {
    id,
    slug: id,
    title: `Product ${id}`,
    category: 'Wonen & Design',
    categorySlug: 'wonen-en-design',
    headline: `Kop ${id}`,
    teaser: 'Teaser',
    imageUrl: '/demo/placeholder.svg',
    imageAlt: 'Product',
    isDemo: false,
    badge: null,
    merchantName: 'Winkel',
    offerId: `${id}-offer`,
    pricing: null,
    saveCount: 0,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  }
}

describe('homepagevulling', () => {
  const pool = (count: number, prefix = 'p') =>
    Array.from({ length: count }, (_, index) => card(`${prefix}${index}`))

  it('haalt het minimum van 32 plaatsingen met genoeg producten', () => {
    const sections = Array.from({ length: 10 }, (_, index) => ({
      key: `s${index}`,
      title: `Sectie ${index}`,
      surface: `home_s${index}`,
      products: pool(4, `s${index}_`),
      limit: 4,
    }))
    const composition = composeHomepage(sections, { heroProductId: 'hero' })
    expect(composition.placements).toBe(41 > DEFAULT_HOMEPAGE_LIMITS.max ? DEFAULT_HOMEPAGE_LIMITS.max : 41)
    expect(composition.placements).toBeGreaterThanOrEqual(DEFAULT_HOMEPAGE_LIMITS.min)
    expect(composition.meetsMinimum).toBe(true)
  })

  it('blijft binnen het maximum', () => {
    const sections = Array.from({ length: 20 }, (_, index) => ({
      key: `s${index}`,
      title: `Sectie ${index}`,
      surface: `home_s${index}`,
      products: pool(8, `s${index}_`),
      limit: 8,
    }))
    const composition = composeHomepage(sections, { heroProductId: 'hero' })
    expect(composition.placements).toBeLessThanOrEqual(DEFAULT_HOMEPAGE_LIMITS.max)
  })

  it('meldt eerlijk wanneer het minimum niet wordt gehaald', () => {
    const composition = composeHomepage(
      [{ key: 's', title: 'Sectie', surface: 'home_s', products: pool(4), limit: 4 }],
      { heroProductId: 'hero' },
    )
    expect(composition.placements).toBe(5)
    expect(composition.meetsMinimum).toBe(false)
  })

  it('laat een product niet twee keer vlak na elkaar zien', () => {
    const shared = pool(4, 'shared_')
    const composition = composeHomepage(
      [
        { key: 'a', title: 'A', surface: 'home_a', products: shared, limit: 4 },
        { key: 'b', title: 'B', surface: 'home_b', products: shared, limit: 4 },
        { key: 'c', title: 'C', surface: 'home_c', products: shared, limit: 4 },
      ],
      {},
    )
    // B kan niets tonen (alles stond net in A) en verdwijnt. Daardoor staat C
    // visueel direct onder A, dus daar gelden dezelfde ids nog steeds als "vlak
    // na elkaar": ook C blijft leeg. Zo staat dezelfde kaart nooit twee keer
    // achter elkaar op de pagina.
    expect(composition.sections.map((section) => section.key)).toEqual(['a'])
    expect(composition.uniqueProducts).toBe(4)
  })

  it('houdt het heroproduct uit de eerste sectie', () => {
    const composition = composeHomepage(
      [{ key: 'a', title: 'A', surface: 'home_a', products: pool(4), limit: 4 }],
      { heroProductId: 'p0' },
    )
    expect(composition.sections[0]?.products.map((product) => product.id)).not.toContain('p0')
    // Hero plus drie resterende producten.
    expect(composition.placements).toBe(4)
  })

  it('laat een sectie weg die haar minimum niet haalt', () => {
    const composition = composeHomepage(
      [
        { key: 'vol', title: 'Vol', surface: 'home_vol', products: pool(4), limit: 4 },
        { key: 'leeg', title: 'Leeg', surface: 'home_leeg', products: [], limit: 4, minimum: 2 },
      ],
      {},
    )
    expect(composition.sections.map((section) => section.key)).toEqual(['vol'])
  })
})
