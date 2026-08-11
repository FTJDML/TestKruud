/** De tien hoofdcategorieën. Een product heeft precies één primaire categorie. */
export type Category = {
  slug: string
  name: string
  /** Korte redactionele introductie op de categoriepagina. */
  intro: string
  /** Compacte weergave in de categoriebalk. */
  shortName: string
  /** Of de categorie in de compacte balk/kaartenrij op de homepage staat. */
  primary: boolean
}

export const categories: readonly Category[] = [
  {
    slug: 'wonen-en-design',
    name: 'Wonen & Design',
    shortName: 'Wonen',
    primary: true,
    intro:
      'Meubels en woonobjecten die iets extra doen: een stoel waar je in wegzakt, een tafel met een geheim of een lamp die een kamer opnieuw indeelt.',
  },
  {
    slug: 'keuken-en-apparaten',
    name: 'Keuken & Apparaten',
    shortName: 'Keuken',
    primary: true,
    intro:
      'Apparaten die koken leuker maken in plaats van ingewikkelder. Van stoomovens tot ijsmachines die op je aanrecht passen.',
  },
  {
    slug: 'smart-home-en-tech',
    name: 'Smart Home & Tech',
    shortName: 'Smart home',
    primary: true,
    intro:
      'Techniek die je huis rustiger maakt: licht dat meedenkt, deurbellen die iets zinnigs melden en sensoren die je daarna vergeet.',
  },
  {
    slug: 'gaming-en-entertainment',
    name: 'Gaming & Entertainment',
    shortName: 'Gaming',
    primary: true,
    intro:
      'Van projectoren die een muur in een bioscoop veranderen tot arcadekasten die precies op je bureau passen.',
  },
  {
    slug: 'tuin-en-buitenleven',
    name: 'Tuin & Buitenleven',
    shortName: 'Tuin',
    primary: true,
    intro:
      'Buiten beter wonen: barbecues voor een balkon, tuinrobots die het gras onthouden en zwembaden die een zomer maken.',
  },
  {
    slug: 'auto-en-onderweg',
    name: 'Auto & Onderweg',
    shortName: 'Onderweg',
    primary: true,
    intro:
      'Compacte oplossingen voor de auto en de weg: stofzuigers, compressors en dingen die een lange rit korter laten voelen.',
  },
  {
    slug: 'speelgoed-en-hobby',
    name: 'Speelgoed & Hobby',
    shortName: 'Hobby',
    primary: true,
    intro:
      'Bouwsets, spellen en projecten waar zowel kinderen als volwassenen een middag in verdwijnen.',
  },
  {
    slug: 'comfort-en-gemak',
    name: 'Comfort & Gemak',
    shortName: 'Comfort',
    primary: true,
    intro:
      'Kleine upgrades met een groot effect op je dag: warmte, stilte, een betere stoel of een taak die zichzelf doet.',
  },
  {
    slug: 'onnodig-maar-geweldig',
    name: 'Onnodig Maar Geweldig',
    shortName: 'Onnodig',
    primary: false,
    intro:
      'Producten die niemand nodig heeft en die je toch blijft bekijken. Onze favoriete categorie, om eerlijk te zijn.',
  },
  {
    slug: 'cadeaus',
    name: 'Cadeaus',
    shortName: 'Cadeaus',
    primary: false,
    intro:
      'Vondsten die goed uitpakken: verrassend genoeg om te onthouden, praktisch genoeg om echt te gebruiken.',
  },
]

const bySlug = new Map(categories.map((category) => [category.slug, category]))
const byName = new Map(categories.map((category) => [category.name, category]))

export function categoryBySlug(slug: string): Category | undefined {
  return bySlug.get(slug)
}

export function categoryByName(name: string): Category | undefined {
  return byName.get(name)
}

export function categorySlugForName(name: string): string {
  return byName.get(name)?.slug ?? 'cadeaus'
}

export function primaryCategories(): readonly Category[] {
  return categories.filter((category) => category.primary)
}

export const categoryNames: readonly string[] = categories.map((category) => category.name)
