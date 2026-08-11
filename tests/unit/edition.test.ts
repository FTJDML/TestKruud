import { describe, expect, it } from 'vitest'
import {
  DEAL_SECTIONS,
  DEFAULT_EDITION_LIMITS,
  isPublishableSelection,
  selectEdition,
  type EditionCandidate,
} from '@/lib/deals/edition'

const { maxPerCategory: MAX_PER_CATEGORY, maxPerMerchant: MAX_PER_MERCHANT } = DEFAULT_EDITION_LIMITS
const MIN_ADDITIONAL_ITEMS = DEFAULT_EDITION_LIMITS.minAdditionalItems
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
    expect(selection.items.some((item) => item.section === 'BEST_DEALS')).toBe(true)
    expect(isPublishableSelection(selection)).toBe(true)
  })

  it('publiceert niet met te weinig kandidaten', () => {
    const selection = selectEdition(buildPool(6), now)
    expect(isPublishableSelection(selection)).toBe(false)
  })

  it('houdt een product zonder geldige dealprijs uit de dealssecties', () => {
    const pool = [
      ...buildPool(20),
      makeCandidate({ productId: 'geen-deal', title: 'Product zonder vergelijkingsprijs', qualifiesAsDeal: false }),
    ]
    const selection = selectEdition(pool, now)

    // Het product mag wel in de editie staan, maar nooit als hero en nooit in
    // een sectie die een geverifieerde deal belooft.
    expect(selection.hero?.productId).not.toBe('geen-deal')
    const item = selection.items.find((entry) => entry.productId === 'geen-deal')
    if (item) {
      expect(['DISCOVERY', 'UNNECESSARY_BUT_GREAT', 'EDITORS_PICK']).toContain(item.section)
      expect(['BEST_DEALS', 'LATEST_PRICE_DROPS']).not.toContain(item.section)
    }
  })

  it('zet een verse prijsdaling in LATEST_PRICE_DROPS', () => {
    const pool = [
      ...buildPool(20),
      makeCandidate({
        productId: 'gedaald',
        title: 'Product met verse prijsdaling',
        dealDetectedAt: new Date(now.getTime() - 60 * 60 * 1000),
      }),
    ]
    const selection = selectEdition(pool, now)
    const chosen = [selection.hero, ...selection.items].find((item) => item?.productId === 'gedaald')
    expect(chosen).toBeDefined()
    expect(['HERO', 'LATEST_PRICE_DROPS']).toContain(chosen?.section)
  })

  it('respecteert een aangepast minimum en maximum', () => {
    const pool = buildPool(24)
    const strict = selectEdition(pool, now, {
      maxPerCategory: 4,
      maxPerMerchant: 3,
      minAdditionalItems: 8,
      targetAdditionalItems: 10,
      maxAdditionalItems: 10,
    })
    expect(strict.items.length).toBeLessThanOrEqual(10)
    expect(
      isPublishableSelection(strict, {
        maxPerCategory: 4,
        maxPerMerchant: 3,
        minAdditionalItems: 8,
        targetAdditionalItems: 10,
        maxAdditionalItems: 10,
      }),
    ).toBe(true)
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

  it('haalt het minimum van acht aanvullende producten of publiceert niet', () => {
    // Precies genoeg kandidaten voor hero plus het minimum.
    const genoeg = selectEdition(buildPool(MIN_ADDITIONAL_ITEMS + 1), now)
    expect(genoeg.hero).not.toBeNull()
    expect(genoeg.items.length).toBeGreaterThanOrEqual(MIN_ADDITIONAL_ITEMS)
    expect(isPublishableSelection(genoeg)).toBe(true)

    // Eén kandidaat te weinig: dan blijft de vorige editie staan.
    const teWeinig = selectEdition(buildPool(MIN_ADDITIONAL_ITEMS), now)
    expect(teWeinig.items.length).toBeLessThan(MIN_ADDITIONAL_ITEMS)
    expect(isPublishableSelection(teWeinig)).toBe(false)

    // Ook een editie zonder hero wordt niet gepubliceerd.
    const zonderHero = selectEdition(
      buildPool(20).map((candidate) => ({ ...candidate, qualifiesAsDeal: false })),
      now,
    )
    expect(zonderHero.hero).toBeNull()
    expect(isPublishableSelection(zonderHero)).toBe(false)
  })

  it('laat dezelfde uitstekende deal meerdere dagen terugkomen', () => {
    const pool = buildPool(24)
    const vandaag = selectEdition(pool, now)
    const morgen = selectEdition(pool, new Date(now.getTime() + 24 * 60 * 60 * 1000))
    const overmorgen = selectEdition(pool, new Date(now.getTime() + 48 * 60 * 60 * 1000))

    // Dezelfde beste deal mag opnieuw hero zijn: hem verstoppen om de
    // afwisseling helpt de bezoeker niet.
    expect(morgen.hero?.productId).toBe(vandaag.hero?.productId)
    expect(overmorgen.hero?.productId).toBe(vandaag.hero?.productId)
    expect(isPublishableSelection(morgen)).toBe(true)
    expect(isPublishableSelection(overmorgen)).toBe(true)
    // Er is niets in de selectie dat een product uitsluit omdat het gisteren al
    // in de editie stond.
    expect(morgen.skipped.map((entry) => entry.reason)).not.toContain('stond gisteren al in de editie')
  })

  it('tilt een oud product met een verse prijsdaling weer naar boven', () => {
    const oud = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000)
    const pool = [
      ...buildPool(12).map((candidate) => ({
        ...candidate,
        score: { ...candidate.score, discoveredAt: oud },
      })),
      makeCandidate({
        productId: 'oud-met-daling',
        title: 'Tafelvuurkorf ethanol',
        merchantId: 'merchant-daling',
        category: 'Cadeaus',
        dealDetectedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        score: {
          discoveredAt: oud,
          lastPriceChangeAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          dealDetectedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        },
      }),
    ]
    const selection = selectEdition(pool, now)
    const chosen = [selection.hero, ...selection.items].find((item) => item?.productId === 'oud-met-daling')
    expect(chosen).toBeDefined()
    // Zonder de verse daling zou dit product met dezelfde scores onderaan staan.
    const zonderDaling = selectEdition(
      pool.map((candidate) =>
        candidate.productId === 'oud-met-daling'
          ? {
              ...candidate,
              dealDetectedAt: null,
              score: { ...candidate.score, dealDetectedAt: null, lastPriceChangeAt: null },
            }
          : candidate,
      ),
      now,
    )
    const zonder = [zonderDaling.hero, ...zonderDaling.items].find(
      (item) => item?.productId === 'oud-met-daling',
    )
    expect(chosen!.score).toBeGreaterThan(zonder!.score)
  })

  it('belooft in DISCOVERY geen korting die er niet is', () => {
    const pool = [
      ...buildPool(16),
      makeCandidate({
        productId: 'discovery',
        title: 'Wolkenlamp bliksem',
        merchantId: 'merchant-discovery',
        category: 'Onnodig Maar Geweldig',
        qualifiesAsDeal: false,
        score: {
          // Zonder referentieprijs is er geen kortingspercentage; dat mag de
          // score niet stilzwijgend opkrikken.
          discountPercentage: null,
          hasValidReferencePrice: false,
        },
      }),
    ]
    const selection = selectEdition(pool, now)
    const item = selection.items.find((entry) => entry.productId === 'discovery')
    expect(item).toBeDefined()
    expect(DEAL_SECTIONS).not.toContain(item?.section)
    expect(selection.hero?.productId).not.toBe('discovery')
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
