import {
  categoryNamesFor,
  getClusters,
  getPublishedEditorialPages,
} from '@/lib/database/editorial-queries'
import {
  getCollectionProducts,
  getCurrentEdition,
  getNewProducts,
  getPopularProducts,
  getProductsForCategories,
} from '@/lib/database/queries'
import { composeHomepage, type HomepageComposition, type HomepageSectionInput } from '@/lib/editorial/homepage'
import { homepagePlacementsFromEnv } from '@/lib/env'
import type { ClusterView, EditionView, EditorialPageCardView, ProductCardView } from '@/types'

/**
 * De homepage op één plek samengesteld.
 *
 * Zowel de homepage zelf als het launchdashboard leest hier: zo kan het
 * dashboard het echte aantal plaatsingen laten zien in plaats van een schatting.
 */
export const homepageClusterSections = [
  { slug: 'koffie-en-slimme-keuken', title: 'Koffie & slimme keuken' },
  { slug: 'smart-home-en-schoonmaak', title: 'Smart home' },
  { slug: 'gaming-en-entertainment-thuis', title: 'Gaming & entertainment' },
  { slug: 'wonen-design-en-meubels', title: 'Wonen & design' },
  { slug: 'tuin-en-buitenleven', title: 'Tuin & buitenleven' },
] as const

export type HomepageData = {
  edition: EditionView | null
  homepage: HomepageComposition
  guides: EditorialPageCardView[]
  clusters: ClusterView[]
  /** Producten voor de collectiebanners onderaan. */
  unnecessary: ProductCardView[]
  under100: ProductCardView[]
}

export async function loadHomepage(): Promise<HomepageData> {
  const [edition, popular, newest, unnecessary, under100, clusters, guides] = await Promise.all([
    getCurrentEdition(),
    getPopularProducts(6),
    getNewProducts(16),
    getCollectionProducts('onnodig-maar-geweldig', 8),
    getCollectionProducts('slimmer-wonen-onder-100', 8),
    getClusters(),
    getPublishedEditorialPages({ limit: 3 }),
  ])

  const empty = composeHomepage([], { limits: homepagePlacementsFromEnv() })
  if (!edition || !edition.hero) {
    return { edition, homepage: empty, guides, clusters, unnecessary, under100 }
  }

  const clusterProducts = await Promise.all(
    homepageClusterSections.map(async (section) => {
      const cluster = clusters.find((entry) => entry.slug === section.slug)
      if (!cluster) return { ...section, products: [] as ProductCardView[] }
      return {
        ...section,
        products: await getProductsForCategories(categoryNamesFor(cluster.categorySlugs), 8),
      }
    }),
  )

  const sections: HomepageSectionInput[] = [
    {
      key: 'best_deals',
      title: 'Beste deals van vandaag',
      description: 'Producten met een echte vergelijkingsprijs, gecontroleerd op voorraad en versheid.',
      surface: 'home_best_deals',
      // BEST_DEALS zijn geverifieerde deals; `today` is de historische naam uit
      // oudere edities en hoort in dezelfde sectie.
      products: [...edition.bestDeals, ...edition.today],
      limit: 8,
      minimum: 1,
      href: '/nieuw',
      linkLabel: 'Alle nieuwe vondsten',
    },
    {
      key: 'price_drops',
      title: 'Nieuwste prijsdalingen',
      description: 'Prijzen die wij zelf zagen dalen sinds onze vorige meting.',
      surface: 'home_latest_price_drops',
      products: edition.latestPriceDrops,
      limit: 4,
    },
    {
      key: 'new',
      title: 'Nieuw ontdekt',
      description: 'De laatste producten die wij hebben toegevoegd.',
      surface: 'home_new',
      products: newest,
      limit: 4,
      href: '/nieuw',
      linkLabel: 'Bekijk alles',
    },
    ...clusterProducts.map((section) => {
      const cluster = clusters.find((entry) => entry.slug === section.slug)
      return {
        key: `cluster_${section.slug}`,
        title: section.title,
        ...(cluster ? { description: `${cluster.introduction.slice(0, 140)}…` } : {}),
        surface: `home_${section.slug.replace(/-/g, '_')}`,
        products: section.products,
        limit: 4,
        minimum: 2,
        href: `/thema/${section.slug}`,
        linkLabel: 'Bekijk het thema',
      }
    }),
    {
      key: 'under_100',
      title: 'Deals onder €100',
      description: 'Kleine upgrades met een merkbaar effect, allemaal onder de honderd euro.',
      surface: 'home_under_100',
      products: [...edition.under100, ...under100],
      limit: 4,
      href: '/collectie/slimmer-wonen-onder-100',
      linkLabel: 'Hele collectie',
    },
    {
      key: 'unnecessary',
      title: 'Onnodig maar geweldig',
      description: 'Volstrekt overbodig. Precies daarom leuk.',
      surface: 'home_unnecessary',
      products: [...edition.unnecessaryButGreat, ...unnecessary],
      limit: 4,
      href: '/collectie/onnodig-maar-geweldig',
      linkLabel: 'Hele collectie',
    },
    {
      key: 'editors',
      title: popular.isReal ? 'Populair bij bezoekers' : 'Redactiefavorieten',
      description: popular.isReal
        ? 'Gebaseerd op wat bezoekers daadwerkelijk bewaren en aanklikken.'
        : 'Er is nog te weinig echte bezoekersdata, dus tonen we onze eigen favorieten in plaats van verzonnen aantallen.',
      surface: popular.isReal ? 'home_popular' : 'home_editors',
      products: [...popular.items, ...edition.editorsPick],
      limit: 4,
    },
    {
      key: 'discovery',
      title: 'Bijzondere vondsten',
      description:
        'Producten die opvallen zonder dat er een vergelijkingsprijs bij hoort. Geen korting, wel de moeite.',
      surface: 'home_discovery',
      products: edition.discovery,
      limit: 4,
    },
  ]

  return {
    edition,
    homepage: composeHomepage(sections, {
      heroProductId: edition.hero.id,
      limits: homepagePlacementsFromEnv(),
    }),
    guides,
    clusters,
    unnecessary,
    under100,
  }
}
