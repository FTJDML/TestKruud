import Link from 'next/link'
import { AdSlot } from '@/components/ads/AdSlot'
import { CategoryTiles } from '@/components/editorial/CategoryTiles'
import { CollectionBanner } from '@/components/editorial/CollectionBanner'
import { HeroFind } from '@/components/editorial/HeroFind'
import { MethodologyBlock } from '@/components/editorial/MethodologyBlock'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { collectionBySlug } from '@/lib/collections'
import {
  getCollectionProducts,
  getCurrentEdition,
  getNewProducts,
  getPopularProducts,
} from '@/lib/database/queries'
import { itemListJsonLd } from '@/lib/seo/jsonld'

/**
 * De editie wisselt één keer per dag; een refresh mag de selectie niet wijzigen.
 * De pagina wordt per request server-side gerenderd: prijzen en controlemomenten
 * blijven daarmee actueel, en een productiebuild heeft geen database nodig
 * (belangrijk voor `docker build`). Zet dit om naar ISR zodra de buildomgeving
 * wél bij de database kan.
 */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [edition, popular, newest, unnecessary, under100] = await Promise.all([
    getCurrentEdition(),
    getPopularProducts(4),
    getNewProducts(16),
    getCollectionProducts('onnodig-maar-geweldig', 6),
    getCollectionProducts('slimmer-wonen-onder-100', 6),
  ])

  if (!edition || !edition.hero) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Nog geen editie van vandaag"
          description="De dagelijkse selectie wordt nog samengesteld. Start de dagelijkse job met pnpm job:daily of bekijk alle nieuwe vondsten."
        >
          <Link
            href="/nieuw"
            className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-semibold text-white hover:bg-accent"
          >
            Bekijk nieuwe vondsten
          </Link>
        </EmptyState>
      </Container>
    )
  }

  // BEST_DEALS zijn geverifieerde deals; `today` is de historische naam en komt
  // uit oudere edities. Beide horen in dezelfde sectie.
  const dealProducts = [...edition.bestDeals, ...edition.today, ...edition.editorsPick].slice(0, 8)
  const priceDrops = edition.latestPriceDrops.filter(
    (product) => !dealProducts.some((entry) => entry.id === product.id),
  )
  const moreProducts = [...edition.under100, ...edition.unnecessaryButGreat, ...edition.editorsPick.slice(2)]
    .filter((product, index, all) => all.findIndex((entry) => entry.id === product.id) === index)
    .filter((product) => !dealProducts.some((entry) => entry.id === product.id))
    .filter((product) => !priceDrops.some((entry) => entry.id === product.id))
    .slice(0, 12)

  // Een product komt maximaal één keer in een productraster op de homepage voor.
  const shownIds = new Set([
    edition.hero.id,
    ...dealProducts.map((product) => product.id),
    ...priceDrops.map((product) => product.id),
    ...moreProducts.map((product) => product.id),
  ])
  const discoveryItems = edition.discovery.filter((product) => !shownIds.has(product.id))
  for (const product of discoveryItems) shownIds.add(product.id)
  const popularItems = popular.items.filter((product) => !shownIds.has(product.id))
  for (const product of popularItems) shownIds.add(product.id)
  const newestItems = newest.filter((product) => !shownIds.has(product.id)).slice(0, 4)

  const unnecessaryCollection = collectionBySlug('onnodig-maar-geweldig')
  const under100Collection = collectionBySlug('slimmer-wonen-onder-100')

  return (
    <>
      <JsonLd data={itemListJsonLd([edition.hero, ...dealProducts], 'Beste deals van vandaag')} />

      <Container className="pt-6 sm:pt-8">
        <HeroFind product={edition.hero} editionDate={edition.editionDate} isToday={edition.isToday} />
      </Container>

      <Container className="pt-12">
        <SectionHeader
          title="Waar wil je rondkijken?"
          description="Tien categorieën, van rustige woonvondsten tot volstrekt overbodige apparaten."
        />
        <CategoryTiles />
      </Container>

      <Container className="pt-14">
        <SectionHeader
          title="Beste deals van vandaag"
          description="Producten met een echte vergelijkingsprijs, gecontroleerd op voorraad en versheid."
          href="/nieuw"
          linkLabel="Alle nieuwe vondsten"
        />
        <ProductGrid products={dealProducts} surface="home_best_deals" priorityCount={2} />
      </Container>

      {priceDrops.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="Nieuwste prijsdalingen"
            description="Prijzen die wij zelf zagen dalen sinds onze vorige meting."
          />
          <ProductGrid products={priceDrops} surface="home_latest_price_drops" />
        </Container>
      ) : null}

      {/* Eerste advertentiepositie: pas na acht productkaarten. */}
      <Container className="pt-12">
        <AdSlot slot="home-in-feed-1" variant="in-feed" />
      </Container>

      {unnecessaryCollection && unnecessary.length >= 3 ? (
        <Container className="pt-12">
          <CollectionBanner collection={unnecessaryCollection} products={unnecessary} />
        </Container>
      ) : null}

      {under100Collection && under100.length >= 3 ? (
        <Container className="pt-8">
          <CollectionBanner collection={under100Collection} products={under100} />
        </Container>
      ) : null}

      {moreProducts.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="Meer vondsten"
            description="Nog een reeks producten uit de editie van vandaag, inclusief de goedkopere upgrades."
          />
          <ProductGrid products={moreProducts} surface="home_more" />
        </Container>
      ) : null}

      {discoveryItems.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="Bijzondere vondsten"
            description="Producten die opvallen zonder dat er een vergelijkingsprijs bij hoort. Geen korting, wel de moeite."
          />
          <ProductGrid products={discoveryItems} surface="home_discovery" />
        </Container>
      ) : null}

      {/* Eén advertentie tussen de redactionele secties. */}
      <Container className="pt-12">
        <AdSlot slot="home-leaderboard" variant="leaderboard" />
      </Container>

      {popularItems.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title={popular.isReal ? 'Populaire producten' : 'Redactiefavorieten'}
            description={
              popular.isReal
                ? 'Gebaseerd op wat bezoekers daadwerkelijk bewaren en aanklikken.'
                : 'Er is nog te weinig echte bezoekersdata, dus tonen we onze eigen favorieten in plaats van verzonnen aantallen.'
            }
          />
          <ProductGrid
            products={popularItems}
            surface={popular.isReal ? 'home_popular' : 'home_editors'}
          />
        </Container>
      ) : null}

      {newestItems.length > 0 ? (
        <Container className="pt-14">
          <SectionHeader
            title="Net binnengekomen"
            description="De laatste producten die wij hebben toegevoegd, ongeacht de editie van vandaag."
            href="/nieuw"
            linkLabel="Bekijk alles"
          />
          <ProductGrid products={newestItems} surface="home_new" />
        </Container>
      ) : null}

      <Container className="pt-16">
        <MethodologyBlock />
      </Container>
    </>
  )
}
