import '../src/lib/load-env'
import type { EditorialPageType, SearchIntent } from '@prisma/client'
import { prisma } from '../src/lib/database/client'
import { isProductionEnv } from '../src/lib/env'
import { publicProductFilter } from '../src/lib/products/visibility'
import { computeDealPricing } from '../src/lib/pricing/deal'
import { toCents } from '../src/lib/pricing/money'
import { buildEditorialPage, type PageDefinition, type PageProductInput } from '../src/lib/editorial/page-builder'

/**
 * Zes redactionele voorbeeldpagina's, gevuld uit de geïmporteerde catalogus.
 *
 * De selectie komt uit de database: publiek zichtbare producten in de juiste
 * categorieën waarvan de titel of de specificaties bij het onderwerp passen. Een
 * budgetpagina neemt alleen producten mee met een recent gecontroleerde prijs
 * binnen de grens. Zijn er te weinig van, dan blijft de pagina een concept met de
 * reden erbij; er wordt niets bijverzonnen om een pagina te vullen.
 *
 *   pnpm launch:editorial
 */
type LaunchPage = PageDefinition & {
  /** Categorieën waarin gezocht wordt. */
  categories: readonly string[]
  /** Minimaal één van deze woorden moet in titel of specificaties staan. */
  keywords: readonly string[]
}

const pages: readonly LaunchPage[] = [
  {
    slug: 'beste-koffiemolens-voor-thuis-onder-500-euro',
    type: 'BEST_OF' as EditorialPageType,
    title: 'Beste koffiemolens voor thuis onder € 500',
    primaryQuery: 'welke koffiemolen voor thuis is de moeite onder vijfhonderd euro',
    searchIntent: 'COMMERCIAL_INVESTIGATION' as SearchIntent,
    clusterSlug: 'koffie-en-slimme-keuken',
    audience: 'wie thuis verse bonen wil malen',
    useCase: 'elke ochtend een paar koppen filterkoffie of espresso',
    budgetMinCents: null,
    budgetMaxCents: 50_000,
    categories: ['Keuken & Apparaten'],
    keywords: ['koffiemolen', 'grinder', 'maalwerk', 'espressomolen'],
    criteria: [
      { name: 'grind-settings', specAliases: ['maalgraden', 'grind settings', 'standen'] },
      { name: 'bean-hopper', specAliases: ['bonenreservoir', 'bean hopper', 'inhoud'] },
      { name: 'burr-type', specAliases: ['maalwerk', 'burr', 'type maalwerk'] },
      { name: 'noise-level', specAliases: ['geluid', 'geluidsniveau', 'noise'] },
    ],
  },
  {
    slug: 'beste-robotstofzuigers-voor-kattenharen-onder-500-euro',
    type: 'BEST_OF' as EditorialPageType,
    title: 'Beste robotstofzuigers voor kattenharen onder € 500',
    primaryQuery: 'welke robotstofzuiger houdt een huis met katten haarvrij',
    searchIntent: 'COMMERCIAL_INVESTIGATION' as SearchIntent,
    clusterSlug: 'smart-home-en-schoonmaak',
    audience: 'huishoudens met katten of honden',
    useCase: 'dagelijks haren van harde vloeren en laagpolig tapijt halen',
    budgetMinCents: null,
    budgetMaxCents: 50_000,
    categories: ['Comfort & Gemak', 'Smart Home & Tech'],
    keywords: ['robotstofzuiger', 'robot vacuum', 'stofzuiger', 'dweil'],
    criteria: [
      { name: 'suction-power', specAliases: ['zuigkracht', 'suction'] },
      { name: 'dustbin-capacity', specAliases: ['stofbak', 'dustbin', 'inhoud'] },
      { name: 'battery-runtime', specAliases: ['looptijd', 'accuduur', 'battery'] },
      { name: 'noise-level', specAliases: ['geluid', 'geluidsniveau', 'noise'] },
      { name: 'app-required', specAliases: ['app', 'bediening'] },
    ],
  },
  {
    slug: 'thuisprojectoren-voor-een-gamekamer-onder-600-euro',
    type: 'USE_CASE_GUIDE' as EditorialPageType,
    title: 'Thuisprojectoren voor een gamekamer onder € 600',
    primaryQuery: 'welke projector past in een gamekamer zonder te veel vertraging',
    searchIntent: 'COMMERCIAL_INVESTIGATION' as SearchIntent,
    clusterSlug: 'gaming-en-entertainment-thuis',
    audience: 'wie op een groot beeld wil spelen',
    useCase: 'een gamekamer waar het licht niet volledig uit kan',
    budgetMinCents: null,
    budgetMaxCents: 60_000,
    categories: ['Gaming & Entertainment'],
    keywords: ['projector', 'beamer'],
    criteria: [
      { name: 'brightness', specAliases: ['helderheid', 'brightness', 'lumen'] },
      { name: 'native-resolution', specAliases: ['resolutie', 'resolution'] },
      { name: 'throw-distance', specAliases: ['projectieafstand', 'throw', 'afstand'] },
      { name: 'noise-level', specAliases: ['geluid', 'geluidsniveau', 'noise'] },
    ],
  },
  {
    slug: 'banksets-met-een-jetset-uitstraling-onder-600-euro',
    type: 'DESIGN_COLLECTION' as EditorialPageType,
    title: 'Banksets met een jetset-uitstraling onder € 600',
    primaryQuery: 'welke bankset geeft een terras een luxe uitstraling zonder luxe prijs',
    searchIntent: 'INSPIRATIONAL' as SearchIntent,
    clusterSlug: 'wonen-design-en-meubels',
    audience: 'wie een klein terras of balkon wil aankleden',
    useCase: 'een zithoek buiten die het hele seizoen blijft staan',
    budgetMinCents: null,
    budgetMaxCents: 60_000,
    categories: ['Wonen & Design', 'Tuin & Buitenleven'],
    keywords: ['bankset', 'loungeset', 'bank', 'sofa', 'fauteuil'],
    criteria: [
      { name: 'material', specAliases: ['materiaal', 'stof', 'frame', 'bekleding'] },
      { name: 'dimensions', specAliases: ['afmetingen', 'breedte', 'diameter', 'hoogte'] },
      { name: 'seats', specAliases: ['zitplaatsen', 'personen', 'seats'] },
      { name: 'weather-resistance', specAliases: ['weerbestendig', 'spatwaterdicht', 'ip'] },
    ],
  },
  {
    slug: 'bijzonder-speelgoed-onder-25-euro',
    type: 'GIFT_GUIDE' as EditorialPageType,
    title: 'Bijzonder speelgoed onder € 25',
    primaryQuery: 'welk bijzonder speelgoed kun je voor minder dan vijfentwintig euro geven',
    searchIntent: 'INSPIRATIONAL' as SearchIntent,
    clusterSlug: 'speelgoed-hobby-en-cadeaus',
    audience: 'wie een cadeau zoekt dat niet in de doos blijft',
    useCase: 'een klein cadeau voor een kinderfeestje',
    budgetMinCents: null,
    budgetMaxCents: 2500,
    categories: ['Speelgoed & Hobby', 'Cadeaus'],
    keywords: ['speelgoed', 'bouwset', 'spel', 'puzzel', 'knikker'],
    criteria: [
      { name: 'age-rating', specAliases: ['leeftijd', 'age'] },
      { name: 'piece-count', specAliases: ['onderdelen', 'stukjes', 'pieces'] },
      { name: 'batteries-included', specAliases: ['batterijen', 'batteries'] },
    ],
  },
  {
    slug: 'producten-waarvan-je-niet-wist-dat-ze-bestonden',
    type: 'DISCOVERY_COLLECTION' as EditorialPageType,
    title: 'Producten waarvan je niet wist dat ze bestonden',
    primaryQuery: 'welke producten voor thuis bestaan er waarvan je het bestaan niet wist',
    searchIntent: 'INSPIRATIONAL' as SearchIntent,
    clusterSlug: 'speelgoed-hobby-en-cadeaus',
    audience: 'wie graag iets tegenkomt dat hij nog nooit zag',
    useCase: null,
    budgetMinCents: null,
    budgetMaxCents: null,
    categories: [
      'Onnodig Maar Geweldig',
      'Cadeaus',
      'Comfort & Gemak',
      'Keuken & Apparaten',
      'Wonen & Design',
    ],
    keywords: [],
    criteria: [],
  },
]

/** Bronnen: catalogusgegevens en onze eigen prijscontroles. */
const sourceDefinitions = [
  {
    sourceType: 'MANUFACTURER_DOCUMENTATION' as const,
    title: 'Catalogusgegevens van de fabrikant',
    factTypes: ['specificaties', 'afmetingen', 'materiaal'],
    notes:
      'Productgegevens en afbeeldingen uit de catalogusexport, aangeleverd door de fabrikant. Geen winkelgegevens.',
  },
  {
    sourceType: 'MANUAL_PRICE_CHECK' as const,
    title: 'Handmatige prijscontrole bij de winkel',
    factTypes: ['prijs', 'voorraad'],
    notes: 'Prijzen die een mens op de winkelpagina heeft nagekeken, met datum en tijd vastgelegd.',
  },
]

const reviewerNotes =
  'Launchpagina, opgebouwd uit de geïmporteerde catalogus. Criteriumwaarden komen uit de specificaties van de fabrikant; prijzen uit handmatige controles. Lees de tekst na voordat je publiceert.'

async function main(): Promise<void> {
  // In productie mag dit script pagina's wél opbouwen, maar niet publiceren: de
  // tekst is een concept en hoort door een mens gelezen te worden in /admin.
  const allowPublish = !isProductionEnv()
  if (!allowPublish) {
    console.info('Productieomgeving: de pagina\'s komen als concept binnen en worden niet gepubliceerd.')
  }

  const now = new Date()
  const sourceIds: string[] = []
  for (const definition of sourceDefinitions) {
    const existing = await prisma.evidenceSource.findFirst({
      where: { title: definition.title },
      select: { id: true },
    })
    const record = existing
      ? await prisma.evidenceSource.update({
          where: { id: existing.id },
          data: { factTypes: definition.factTypes, notes: definition.notes, usageAllowed: true },
        })
      : await prisma.evidenceSource.create({
          data: { ...definition, usageAllowed: true, accessedAt: now, publisher: null },
        })
    sourceIds.push(record.id)
  }

  for (const page of pages) {
    const candidates = await prisma.product.findMany({
      where: publicProductFilter({ primaryCategory: { in: [...page.categories] } }),
      select: {
        id: true,
        title: true,
        specifications: true,
        editorial: { select: { caveat: true, bestFor: true } },
        offers: {
          select: {
            currentPrice: true,
            referencePrice: true,
            referencePriceType: true,
            inStock: true,
            checkedAt: true,
            promotionEndsAt: true,
            staleAt: true,
            merchant: { select: { enabled: true } },
          },
        },
      },
    })

    const matching = candidates.filter((product) => {
      if (page.keywords.length === 0) return true
      const haystack = `${product.title} ${Object.keys(product.specifications as Record<string, string>).join(' ')}`.toLowerCase()
      return page.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
    })

    const inputs: PageProductInput[] = matching.map((product) => {
      const offers = product.offers.filter((offer) => offer.merchant.enabled)
      const active = offers
        .map((offer) => ({ offer, pricing: computeDealPricing(offer, now) }))
        .filter((entry) => entry.pricing.isActive)
        .sort((left, right) => left.pricing.currentPriceCents - right.pricing.currentPriceCents)[0]
      const bestFor = product.editorial?.bestFor
      return {
        productId: product.id,
        caveat: product.editorial?.caveat ?? null,
        bestForAudience: Array.isArray(bestFor) && typeof bestFor[0] === 'string' ? bestFor[0] : null,
        currentPriceCents: active ? active.pricing.currentPriceCents : (toCents(offers[0]?.currentPrice) ?? null),
        specifications: (product.specifications ?? {}) as Record<string, string>,
      }
    })

    // Goedkoopste eerst: dat leest bij een budgetpagina het prettigst.
    inputs.sort((left, right) => (left.currentPriceCents ?? Infinity) - (right.currentPriceCents ?? Infinity))

    const result = await buildEditorialPage(prisma, page, inputs, {
      sourceIds,
      reviewerNotes,
      now,
      allowPublish,
    })
    console.info(
      `${result.slug}: ${result.status}, ${result.products} producten, ${result.verifiedValues} gecontroleerde waarden, ${result.notProvidedValues} × niet opgegeven, ${result.indexable ? 'indexeerbaar' : 'niet indexeerbaar'}`,
    )
    for (const reason of result.reasons.slice(0, 4)) console.info(`    ${reason}`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
