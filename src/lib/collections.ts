import type { EditionSection } from '@prisma/client'

/** Redactionele collecties; een product mag in meerdere collecties staan. */
export type Collection = {
  slug: string
  name: string
  tagline: string
  intro: string
  /** Sectie in de dagelijkse editie die bij deze collectie hoort. */
  section: EditionSection | null
  /** Zachte accentachtergrond voor het promotieblok. */
  tone: 'coral' | 'sand' | 'mint'
}

export const collections: readonly Collection[] = [
  {
    slug: 'onnodig-maar-geweldig',
    name: 'Onnodig, maar geweldig',
    tagline: 'Volstrekt overbodig. Precies daarom leuk.',
    intro:
      'Deze producten lossen geen enkel probleem op dat je vandaag had. Ze zijn er voor de verwondering, het gesprek en het moment waarop iemand vraagt: waar heb je dat gevonden?',
    section: 'UNNECESSARY_BUT_GREAT',
    tone: 'coral',
  },
  {
    slug: 'slimmer-wonen-onder-100',
    name: 'Slimmer wonen onder €100',
    tagline: 'Kleine upgrades, meteen merkbaar.',
    intro:
      'Je hoeft je huis niet te verbouwen om het beter te laten werken. Deze vondsten kosten minder dan honderd euro en veranderen toch iets in je dagelijkse routine.',
    section: 'UNDER_100',
    tone: 'mint',
  },
  {
    slug: 'redactiefavorieten',
    name: 'Redactiefavorieten',
    tagline: 'De vondsten die wij zelf blijven openen.',
    intro:
      'Geselecteerd op originaliteit, verhaal en bruikbaarheid — niet op commissie. Dit zijn de producten die in onze eigen lijst bleven staan.',
    section: 'EDITORS_PICK',
    tone: 'sand',
  },
]

const bySlug = new Map(collections.map((collection) => [collection.slug, collection]))

export function collectionBySlug(slug: string): Collection | undefined {
  return bySlug.get(slug)
}

export const collectionSlugs: readonly string[] = collections.map((collection) => collection.slug)
