import type { PublicationStatus } from '@prisma/client'

/**
 * De contentclusters van de launch. Dit is redactionele structuur, geen data:
 * er komen geen producten, prijzen of feiten uit dit bestand. De rijen worden
 * met `pnpm db:seed:clusters` in de database gezet en zijn daarna in
 * `/admin/clusters` te beheren.
 *
 * Een cluster staat pas prominent in de navigatie wanneer het genoeg
 * gepubliceerde producten en genoeg redactionele pagina's heeft; die grenzen
 * staan per cluster in de database.
 */
export type ClusterSeed = {
  slug: string
  title: string
  introduction: string
  primaryTopics: string[]
  categorySlugs: string[]
  seoTitle: string
  metaDescription: string
  displayOrder: number
}

export const clusterSeeds: readonly ClusterSeed[] = [
  {
    slug: 'koffie-en-slimme-keuken',
    title: 'Koffie & Slimme Keuken',
    introduction:
      'Van molens die je bonen eerlijk verdelen tot apparaten die een keuken van vier vierkante meter alsnog compleet maken. Wij volgen de prijzen dagelijks en vergelijken op wat je in brondata kunt nakijken: opbrengst, maalgraad, afmetingen en wat er werkelijk in je aanrecht past.',
    primaryTopics: [
      'koffiemolens',
      'espressomachines',
      'filterkoffie',
      'kleine keukenapparatuur',
      'keukenmachines',
      'slimme ovens',
    ],
    categorySlugs: ['keuken-en-apparaten', 'comfort-en-gemak'],
    seoTitle: 'Koffie & slimme keuken: vergelijkingen en koopgidsen',
    metaDescription:
      'Koffiemolens, espressomachines en slimme keukenapparaten vergeleken op gecontroleerde specificaties, met prijzen die wij dagelijks meten.',
    displayOrder: 1,
  },
  {
    slug: 'smart-home-en-schoonmaak',
    title: 'Smart Home & Schoonmaak',
    introduction:
      'Techniek die je huis rustiger maakt en werk uit handen neemt. Robotstofzuigers, slimme deurbellen, sensoren en luchtreinigers, vergeleken op zuigkracht, geluidsniveau, bakinhoud en wat een app werkelijk toevoegt.',
    primaryTopics: [
      'robotstofzuigers',
      'slimme deurbellen',
      'luchtreinigers',
      'slimme verlichting',
      'sensoren',
      'dweilrobots',
    ],
    categorySlugs: ['smart-home-en-tech', 'comfort-en-gemak'],
    seoTitle: 'Smart home & schoonmaak: robots, deurbellen en sensoren',
    metaDescription:
      'Robotstofzuigers, slimme deurbellen en luchtreinigers vergeleken op gecontroleerde specificaties en actuele, dagelijks gemeten prijzen.',
    displayOrder: 2,
  },
  {
    slug: 'gaming-en-entertainment-thuis',
    title: 'Gaming & Entertainment Thuis',
    introduction:
      'Een woonkamer die af en toe een bioscoop of een gamekamer moet zijn. Projectoren, schermen, stoelen en geluid, vergeleken op helderheid, resolutie, projectieafstand en of het ding in een normale kamer past.',
    primaryTopics: [
      'projectoren',
      'gamingstoelen',
      'thuisbioscoop',
      'arcadekasten',
      'geluid',
      'monitoren',
    ],
    categorySlugs: ['gaming-en-entertainment', 'wonen-en-design'],
    seoTitle: 'Gaming & entertainment thuis: projectoren, stoelen en geluid',
    metaDescription:
      'Projectoren, gamingstoelen en thuisbioscoopproducten vergeleken op gecontroleerde specificaties, met dagelijks gemeten prijzen.',
    displayOrder: 3,
  },
  {
    slug: 'tuin-en-buitenleven',
    title: 'Tuin & Buitenleven',
    introduction:
      'Buiten net zo comfortabel wonen als binnen, ook op een balkon van drie bij één. Barbecues, robotmaaiers, verlichting en meubels, vergeleken op afmetingen, weerbestendigheid en onderhoud.',
    primaryTopics: [
      'robotmaaiers',
      'barbecues',
      'pizzaovens',
      'tuinverlichting',
      'balkonmeubels',
      'terrasverwarming',
    ],
    categorySlugs: ['tuin-en-buitenleven'],
    seoTitle: 'Tuin & buitenleven: barbecues, robotmaaiers en balkonvondsten',
    metaDescription:
      'Barbecues, robotmaaiers en balkonproducten vergeleken op gecontroleerde specificaties en actuele prijzen die wij dagelijks meten.',
    displayOrder: 4,
  },
  {
    slug: 'wonen-design-en-meubels',
    title: 'Wonen, Design & Meubels',
    introduction:
      'Meubels en verlichting die een kamer opnieuw indelen. Wij vergelijken stijl, materiaal, afmetingen, zitplaatsen, montage en onderhoud — en spreken bij smaak geen winnaar uit, want dat is geen meetbaar criterium.',
    primaryTopics: ['banksets', 'fauteuils', 'verlichting', 'tafels', 'woonaccessoires', 'opbergen'],
    categorySlugs: ['wonen-en-design', 'comfort-en-gemak'],
    seoTitle: 'Wonen, design & meubels: collecties en vergelijkingen',
    metaDescription:
      'Banksets, fauteuils, tafels en verlichting vergeleken op materiaal, afmetingen en ruimtegebruik, met dagelijks gemeten prijzen.',
    displayOrder: 5,
  },
  {
    slug: 'speelgoed-hobby-en-cadeaus',
    title: 'Speelgoed, Hobby & Cadeaus',
    introduction:
      'Cadeaus die het uitpakken waard zijn en projecten waar een middag in verdwijnt. Wij gebruiken de leeftijdsindicatie van de fabrikant, benoemen welke accessoires je nog nodig hebt en zeggen eerlijk wanneer iets vooral leuk is om te geven.',
    primaryTopics: ['bouwsets', 'bijzonder speelgoed', 'gezelschapsspellen', 'hobbygereedschap', 'cadeaus onder 25 euro', 'gadgets'],
    categorySlugs: ['speelgoed-en-hobby', 'cadeaus', 'onnodig-maar-geweldig'],
    seoTitle: 'Speelgoed, hobby & cadeaus: gidsen per budget en leeftijd',
    metaDescription:
      'Bouwsets, bijzonder speelgoed en cadeaus per budget, met de leeftijdsindicatie van de fabrikant en dagelijks gemeten prijzen.',
    displayOrder: 6,
  },
]

export type ClusterVisibilityInput = {
  status: PublicationStatus
  visible: boolean
  minProducts: number
  minEditorialPages: number
  publishedProductCount: number
  publishedEditorialPageCount: number
}

export type ClusterVisibilityVerdict =
  | { prominent: true; reasons: [] }
  | { prominent: false; reasons: string[] }

/**
 * Mag dit cluster prominent in de hoofdnavigatie? Een leeg cluster in het menu
 * belooft iets wat er niet is, dus de drempels zijn hard.
 */
export function checkClusterProminence(input: ClusterVisibilityInput): ClusterVisibilityVerdict {
  const reasons: string[] = []
  if (input.status !== 'PUBLISHED') reasons.push(`status is ${input.status}, niet PUBLISHED`)
  if (!input.visible) reasons.push('cluster staat op onzichtbaar')
  if (input.publishedProductCount < input.minProducts) {
    reasons.push(
      `${input.publishedProductCount} van ${input.minProducts} benodigde gepubliceerde producten`,
    )
  }
  if (input.publishedEditorialPageCount < input.minEditorialPages) {
    reasons.push(
      `${input.publishedEditorialPageCount} van ${input.minEditorialPages} benodigde redactionele pagina's`,
    )
  }
  return reasons.length === 0 ? { prominent: true, reasons: [] } : { prominent: false, reasons }
}

export function clusterSeedBySlug(slug: string): ClusterSeed | undefined {
  return clusterSeeds.find((cluster) => cluster.slug === slug)
}
