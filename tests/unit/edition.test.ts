import { describe, expect, it } from 'vitest'
import {
  MAX_PER_CATEGORY,
  MAX_PER_MERCHANT,
  MIN_ADDITIONAL_ITEMS,
  isPublishableSelection,
  selectEdition,
  type EditionCandidate,
} from '@/lib/deals/edition'
import type { ScoreInput } from '@/lib/deals/score'
import { editionDate, editionDateKey } from '@/lib/deals/edition-date'

const now = new Date('2026-08-11T12:00:00.000Z')

type CandidateOverrides = Partial<Omit<EditionCandidate, 'score'>> & {
  productId: string
  score?: Partial<ScoreInput>
}

function makeCandidate(overrides: CandidateOverrides): EditionCandidate {
  return {
    productId: overrides.productId,
    offerId: overrides.offerId ?? `${overrides.productId}-offer`,
    merchantId: overrides.merchantId ?? 'merchant-a',
    category: overrides.category ?? 'Wonen & Design',
    title: overrides.title ?? `Product ${overrides.productId}`,
    priceCents: overrides.priceCents ?? 19_900,
    isUnnecessaryButGreat: overrides.isUnnecessaryButGreat ?? false,
    qualifiesAsDeal: overrides.qualifiesAsDeal ?? true,
    score: {
      uniquenessScore: 70,
      storyScore: 70,
      usefulnessScore: 70,
      giftabilityScore: 70,
      discountPercentage: 25,
      hasValidReferencePrice: true,
      discoveredAt: now,
      checkedAt: now,
      visualQualityScore: 60,
      merchantTrustScore: 60,
      ...overrides.score,
    },
  }
}

const categories = [
  'Wonen & Design',
  'Keuken & Apparaten',
  'Smart Home & Tech',
  'Gaming & Entertainment',
  'Tuin & Buitenleven',
  'Auto & Onderweg',
  'Speelgoed & Hobby',
  'Comfort & Gemak',
]

/** Titels zonder overlap, zodat de duplicaatcontrole ze niet samenvoegt. */
const distinctTitles = [
  'Bijzettafel koeling',
  'Loungestoel bouclé',
  'Bureaulamp segment',
  'Pizzaoven gas',
  'IJsmachine compressor',
  'Stoomoven vrijstaand',
  'Sfeerlamp accu',
  'Deurbel pakketmelding',
  'Plantenpot waterstand',
  'Thuisprojector scherpstelling',
  'Arcadekast joystick',
  'Gamingstoel lendensteun',
  'Zwembad filterpomp',
  'Balkonbarbecue windscherm',
  'Robotmaaier perimeterloos',
  'Autocompressor drukmeter',
  'Autostofzuiger kierenzuiger',
  'Koelbox bio',
  'Planetarium tandwielen',
  'Knikkerbaan hout',
  'Robotarm herhaalfunctie',
  'Robotstofzuiger dweilfunctie',
  'Voerdispenser camera',
  'Voetenkussen warmte',
  'Wolkenlamp bliksem',
  'Tafelvuurkorf ethanol',
]

/** Bouwt kandidaten met unieke titels, categorieën en merchants. */
function buildPool(count: number): EditionCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    makeCandidate({
      productId: `p${index}`,
      title: distinctTitles[index % distinctTitles.length] ?? `Losse vondst ${index}`,
      category: categories[index % categories.length] ?? 'Cadeaus',
      merchantId: `merchant-${index % 9}`,
      priceCents: 15_000 + index * 1_000,
    }),
  )
}

describe('editieselectie', () => {
  it('kiest één hero en verdeelt de rest over secties', () => {
    const selection = selectEdition(buildPool(24), now)
    expect(selection.hero).not.toBeNull()
    expect(selection.hero?.section).toBe('HERO')
    expect(selection.items.length).toBeGreaterThanOrEqual(MIN_ADDITIONAL_ITEMS)
    expect(selection.items.some((item) => item.section === 'TODAY')).toBe(true)
    expect(isPublishableSelection(selection)).toBe(true)
  })

  it('publiceert niet met te weinig kandidaten', () => {
    const selection = selectEdition(buildPool(6), now)
    expect(isPublishableSelection(selection)).toBe(false)
  })

  it('sluit producten zonder geldige dealprijs uit', () => {
    const pool = [
      ...buildPool(20),
      makeCandidate({ productId: 'geen-deal', title: 'Product zonder vergelijkingsprijs', qualifiesAsDeal: false }),
    ]
    const selection = selectEdition(pool, now)
    const chosen = [selection.hero, ...selection.items].map((item) => item?.productId)
    expect(chosen).not.toContain('geen-deal')
    expect(selection.skipped.some((entry) => entry.reason === 'geen geldige dealprijs')).toBe(true)
  })

  it('houdt maximaal vier producten per categorie aan', () => {
    const pool = Array.from({ length: 12 }, (_, index) =>
      makeCandidate({
        productId: `k${index}`,
        title: distinctTitles[index] ?? `Keukenvondst ${index}`,
        category: 'Keuken & Apparaten',
        merchantId: `merchant-${index}`,
      }),
    )
    const selection = selectEdition(pool, now)
    const chosen = [selection.hero, ...selection.items].filter((item) => item !== null)
    expect(chosen).toHaveLength(MAX_PER_CATEGORY)
    expect(selection.skipped.some((entry) => entry.reason === 'categorielimiet bereikt')).toBe(true)
  })

  it('houdt maximaal drie producten per merchant aan', () => {
    const pool = Array.from({ length: 10 }, (_, index) =>
      makeCandidate({
        productId: `m${index}`,
        title: distinctTitles[index] ?? `Merchantvondst ${index}`,
        category: index % 2 === 0 ? 'Wonen & Design' : 'Cadeaus',
        merchantId: 'merchant-solo',
      }),
    )
    const selection = selectEdition(pool, now)
    const chosen = [selection.hero, ...selection.items].filter((item) => item !== null)
    expect(chosen).toHaveLength(MAX_PER_MERCHANT)
    expect(selection.skipped.some((entry) => entry.reason === 'merchantlimiet bereikt')).toBe(true)
  })

  it('weert bijna identieke producten en kleurvarianten', () => {
    const pool = [
      makeCandidate({ productId: 'a', title: 'Design loungestoel bouclé zwart', merchantId: 'merchant-1' }),
      makeCandidate({ productId: 'b', title: 'Design loungestoel bouclé wit', merchantId: 'merchant-2' }),
      makeCandidate({ productId: 'c', title: 'Robotstofzuiger met dweilfunctie', merchantId: 'merchant-3' }),
    ]
    const selection = selectEdition(pool, now)
    const chosen = [selection.hero, ...selection.items].filter((item) => item !== null)
    expect(chosen).toHaveLength(2)
    expect(selection.skipped.some((entry) => entry.reason === 'te vergelijkbaar met andere keuze')).toBe(true)
  })

  it('zet goedkope producten in de sectie onder 100 euro', () => {
    const pool = [
      ...buildPool(4),
      makeCandidate({
        productId: 'goedkoop',
        title: 'Handdoekverwarmer badkamer',
        priceCents: 4_900,
        category: 'Cadeaus',
        merchantId: 'merchant-goedkoop',
        // Iets lagere scores, zodat dit product niet de hero wordt.
        score: { uniquenessScore: 50, storyScore: 50, usefulnessScore: 50, giftabilityScore: 50 },
      }),
    ]
    const selection = selectEdition(pool, now)
    const item = selection.items.find((entry) => entry.productId === 'goedkoop')
    expect(item?.section).toBe('UNDER_100')
  })

  it('is stabiel: dezelfde input geeft dezelfde selectie', () => {
    const pool = buildPool(24)
    const first = selectEdition(pool, now)
    const second = selectEdition([...pool].reverse(), now)
    expect(first.hero?.productId).toBe(second.hero?.productId)
    expect(first.items.map((item) => item.productId)).toEqual(second.items.map((item) => item.productId))
  })
})

describe('editiedatum', () => {
  it('gebruikt de Amsterdamse kalenderdag', () => {
    // 23:30 UTC is in Amsterdam al de volgende dag.
    expect(editionDateKey(new Date('2026-08-11T23:30:00.000Z'))).toBe('2026-08-12')
    expect(editionDateKey(new Date('2026-08-11T10:00:00.000Z'))).toBe('2026-08-11')
  })

  it('levert UTC-middernacht voor de DATE-kolom', () => {
    expect(editionDate(new Date('2026-08-11T10:00:00.000Z')).toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('is stabiel gedurende de dag', () => {
    const morning = editionDateKey(new Date('2026-08-11T06:00:00.000Z'))
    const evening = editionDateKey(new Date('2026-08-11T20:00:00.000Z'))
    expect(morning).toBe(evening)
  })
})
