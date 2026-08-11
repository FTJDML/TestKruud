import { describe, expect, it } from 'vitest'
import {
  dedupeBatch,
  findDuplicate,
  normalizeTitle,
  titleSimilarity,
  variantSignature,
  type DedupeCandidate,
} from '@/lib/deals/dedupe'

function candidate(overrides: Partial<DedupeCandidate> & { title: string }): DedupeCandidate {
  return {
    id: overrides.id ?? overrides.title,
    merchantSlug: overrides.merchantSlug ?? 'winkel-a',
    externalId: overrides.externalId ?? null,
    ean: overrides.ean ?? null,
    brand: overrides.brand ?? null,
    model: overrides.model ?? null,
    title: overrides.title,
  }
}

describe('titelnormalisatie', () => {
  it('verwijdert hoofdletters, leestekens en dubbele spaties', () => {
    expect(normalizeTitle('Nocta  Bijzettafel, met Koeling!')).toBe('nocta bijzettafel koeling')
  })

  it('verwijdert maten en kleuren', () => {
    expect(normalizeTitle('Loungestoel 80 cm zwart')).toBe(normalizeTitle('Loungestoel wit'))
    expect(normalizeTitle('Waterkoker 1,7 l')).toBe('waterkoker')
  })

  it('behandelt diacritische tekens als hun basisletter', () => {
    expect(normalizeTitle('Café Latte machine')).toBe('cafe latte machine')
  })
})

describe('deduplicatievolgorde', () => {
  const existing = [
    candidate({ id: 'p1', title: 'Nocta Bijzettafel met koeling', ean: '8712345000011', brand: 'Nocta', model: 'CT-40' }),
    candidate({ id: 'p2', title: 'Fornello Piccolo pizzaoven', externalId: 'KK-3101', merchantSlug: 'winkel-b' }),
  ]

  it('1. matcht op exacte EAN, ook met streepjes', () => {
    const match = findDuplicate(candidate({ title: 'Heel andere titel', ean: '8712-3450-00011' }), existing)
    expect(match?.strategy).toBe('ean')
    expect(match?.match.id).toBe('p1')
  })

  it('2. matcht op merk plus modelnummer', () => {
    const match = findDuplicate(
      candidate({ title: 'Bijzettafel koelbox editie', brand: 'nocta', model: 'ct40' }),
      existing,
    )
    expect(match?.strategy).toBe('brand-model')
  })

  it('3. matcht op extern ID binnen dezelfde merchant', () => {
    const match = findDuplicate(
      candidate({ title: 'Pizzaoven', externalId: 'KK-3101', merchantSlug: 'winkel-b' }),
      existing,
    )
    expect(match?.strategy).toBe('merchant-external-id')
  })

  it('matcht niet op extern ID van een andere merchant', () => {
    const match = findDuplicate(
      candidate({ title: 'Volledig ander product', externalId: 'KK-3101', merchantSlug: 'winkel-c' }),
      existing,
    )
    expect(match).toBeNull()
  })

  it('4. matcht op genormaliseerde titel', () => {
    const match = findDuplicate(candidate({ title: 'nocta   bijzettafel met KOELING' }), existing)
    expect(match?.strategy).toBe('normalized-title')
  })

  it('5. matcht fuzzy als laatste hulpmiddel', () => {
    const match = findDuplicate(
      candidate({ title: 'Gazon Robot slimme robotmaaier zonder perimeterdraad tuinen' }),
      [candidate({ id: 'p3', title: 'Gazon Robot slimme robotmaaier zonder perimeterdraad' })],
    )
    expect(match?.strategy).toBe('fuzzy-title')
    expect(titleSimilarity('Fornello Piccolo pizzaoven', 'Fornello Piccolo pizzaoven')).toBe(1)
  })

  it('matcht niet fuzzy wanneer de titels te veel verschillen', () => {
    const match = findDuplicate(
      candidate({ title: 'Fornello Piccolo pizzaoven draagbaar' }),
      [candidate({ id: 'p4', title: 'Gelato Uno compacte ijsmachine' })],
    )
    expect(match).toBeNull()
  })

  it('voegt duidelijk verschillende producten niet samen', () => {
    expect(findDuplicate(candidate({ title: 'Robotstofzuiger met dweilfunctie' }), existing)).toBeNull()
  })
})

describe('varianten', () => {
  it('houdt maatvarianten uit elkaar', () => {
    const existing = [candidate({ id: 'p1', title: 'Opblaasbaar zwembad 305 cm' })]
    const match = findDuplicate(candidate({ title: 'Opblaasbaar zwembad 366 cm' }), existing)
    expect(match).toBeNull()
    expect(variantSignature('Opblaasbaar zwembad 305 cm')).not.toBe(
      variantSignature('Opblaasbaar zwembad 366 cm'),
    )
  })

  it('dedupliceert een batch en meldt de duplicaten', () => {
    const result = dedupeBatch([
      candidate({ title: 'Slimme sfeerlamp', ean: '8712345000073' }),
      candidate({ title: 'Slimme  sfeerlamp!', ean: '8712345000073' }),
      candidate({ title: 'Slimme deurbel', ean: '8712345000080' }),
    ])
    expect(result.unique).toHaveLength(2)
    expect(result.duplicates).toHaveLength(1)
    expect(result.duplicates[0]?.match.strategy).toBe('ean')
  })
})
