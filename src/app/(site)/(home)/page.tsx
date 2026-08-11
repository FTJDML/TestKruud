import Link from 'next/link'
import { AdSlot } from '@/components/ads/AdSlot'
import { CategoryTiles } from '@/components/editorial/CategoryTiles'
import { ClusterNav } from '@/components/editorial/ClusterNav'
import { CollectionBanner } from '@/components/editorial/CollectionBanner'
import { EditorialPageCards } from '@/components/editorial/EditorialPageCards'
import { HeroFind } from '@/components/editorial/HeroFind'
import { MethodologyBlock } from '@/components/editorial/MethodologyBlock'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { collectionBySlug } from '@/lib/collections'
import { loadHomepage } from '@/lib/editorial/homepage-data'
import { itemListJsonLd } from '@/lib/seo/jsonld'

/**
 * De editie wisselt één keer per dag; een refresh mag de selectie niet wijzigen.
 * De pagina wordt per request server-side gerenderd: prijzen en controlemomenten
 * blijven daarmee actueel, en een productiebuild heeft geen database nodig
 * (belangrijk voor `docker build`). Zet dit om naar ISR zodra de buildomgeving
 * wél bij de database kan.
 *
 * De secties zelf worden samengesteld in `loadHomepage`, zodat het
 * launchdashboard exact dezelfde vulling kan tonen.
 */
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { edition, homepage, guides, unnecessary, under100 } = await loadHomepage()

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

  const unnecessaryCollection = collectionBySlug('onnodig-maar-geweldig')
  const under100Collection = collectionBySlug('slimmer-wonen-onder-100')
  // De eerste advertentie staat pas na minimaal acht productkaarten.
  const adAfter = homepage.sections.findIndex((section) => section.key === 'new')

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          [edition.hero, ...(homepage.sections[0]?.products ?? [])],
          'Beste deals van vandaag',
        )}
      />

      <Container className="pt-6 sm:pt-8">
        <HeroFind product={edition.hero} editionDate={edition.editionDate} isToday={edition.isToday} />
      </Container>

      <div className="pt-10">
        <ClusterNav />
      </div>

      <Container className="pt-12">
        <SectionHeader
          title="Waar wil je rondkijken?"
          description="Tien categorieën, van rustige woonvondsten tot volstrekt overbodige apparaten."
        />
        <CategoryTiles />
      </Container>

      {homepage.sections.map((section, index) => (
        <div key={section.key}>
          <Container className="pt-14">
            <SectionHeader
              title={section.title}
              {...(section.description ? { description: section.description } : {})}
              {...(section.href ? { href: section.href } : {})}
              {...(section.linkLabel ? { linkLabel: section.linkLabel } : {})}
            />
            {/* Alleen de eerste sectie laadt afbeeldingen direct; de rest lazy. */}
            <ProductGrid
              products={section.products}
              surface={section.surface}
              priorityCount={index === 0 ? 2 : 0}
            />
          </Container>

          {index === adAfter ? (
            <Container className="pt-12">
              <AdSlot slot="home-in-feed-1" variant="in-feed" />
            </Container>
          ) : null}
        </div>
      ))}

      {guides.length > 0 ? (
        <Container className="pt-16">
          <SectionHeader
            title="Nieuwste vergelijkingen en koopgidsen"
            description="Redactionele pagina's met gecontroleerde criteria, bronnen en onze eigen prijsmetingen."
            href="/gidsen"
            linkLabel="Alle gidsen"
          />
          <EditorialPageCards pages={guides} />
        </Container>
      ) : null}

      {unnecessaryCollection && unnecessary.length >= 3 ? (
        <Container className="pt-12">
          <CollectionBanner collection={unnecessaryCollection} products={unnecessary.slice(0, 3)} />
        </Container>
      ) : null}

      {under100Collection && under100.length >= 3 ? (
        <Container className="pt-8">
          <CollectionBanner collection={under100Collection} products={under100.slice(0, 3)} />
        </Container>
      ) : null}

      <Container className="pt-12">
        <AdSlot slot="home-leaderboard" variant="leaderboard" />
      </Container>

      <Container className="pt-16">
        <MethodologyBlock />
      </Container>
    </>
  )
}
