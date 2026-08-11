import '../src/lib/load-env'
import type { EditorialPageType, SearchIntent } from '@prisma/client'
import { prisma } from '../src/lib/database/client'
import { isProductionEnv } from '../src/lib/env'
import { archetypeFor } from '../src/lib/editorial/archetypes'
import { categoryNamesFor } from '../src/lib/database/editorial-queries'
import { publicProductFilter } from '../src/lib/products/visibility'
import { refreshIndexability } from '../src/lib/editorial/service'
import { OPENING_HISTORY_WINDOW } from '../src/lib/ai/style/openings'
import {
  buildTemplateDraft,
  findDraftProblems,
  type EditorialDraftFacts,
} from '../src/lib/ai/editorial-draft'

/**
 * Seed voor een **stagingomgeving**.
 *
 * De demo-seed (`pnpm db:seed`) levert producten, prijzen en productteksten,
 * maar geen redactionele pagina's: die maakt de redactie normaal zelf in
 * `/admin/redactie`. Daardoor zijn een vergelijking, een budgetgids en een
 * collectie op een verse database niet te bekijken.
 *
 * Dit script vult dat gat voor staging, en alleen daar. Regels:
 *
 * - Het weigert te lopen in productie.
 * - Het verzint geen feiten. Elke criteriumwaarde komt uit
 *   `Product.specifications` van de fixtureproducten. Levert de brondata een
 *   waarde niet, dan komt de waarde als `NOT_PROVIDED` in de database en toont
 *   de tabel "Niet opgegeven".
 * - Aandachtspunten per product komen uit de bestaande redactionele content van
 *   het product; er wordt geen nieuw aandachtspunt bedacht.
 * - De lopende tekst komt uit de bestaande templategenerator, dezelfde die de
 *   admin gebruikt. Wijst de draftcontrole de tekst af, dan stopt het script.
 * - `indexable` wordt niet gezet, maar berekend door de quality gate.
 *
 * De reviewvelden worden wél gevuld, met een reviewernotitie die zegt dat dit
 * stagingdata is en geen echte redactionele controle. Zonder die velden blijft
 * de indexeringspoort dicht en is niet te testen wat er in productie gebeurt.
 */

/** Eén criteriumwaarde, afgeleid uit de specificaties van het product. */
type CriterionMapping = {
  criterionName: string
  /**
   * Specificatiesleutels waaruit de waarde komt, in volgorde. Levert de brondata
   * geen van deze sleutels, dan wordt de waarde NOT_PROVIDED.
   */
  from: readonly string[]
  /** Optioneel: maakt van de gevonden waarden één leesbare cel. */
  format?: (values: Record<string, string>) => string
}

type PageProductSeed = {
  slug: string
  /** Criteriumwaarden voor dit product; ontbrekende sleutels worden NOT_PROVIDED. */
  mappings?: readonly CriterionMapping[]
  label?: string
}

type PageSeed = {
  slug: string
  type: EditorialPageType
  title: string
  primaryQuery: string
  searchIntent: SearchIntent
  clusterSlug: string
  audience: string
  useCase: string | null
  budgetMinCents: number | null
  budgetMaxCents: number | null
  criterionNames: readonly string[]
  products: readonly PageProductSeed[]
  /** Alleen bij een archetype dat een onderbouwde keuze toestaat. */
  featured?: {
    slug: string
    label: string
    reason: string
    alternativeNote: string | null
  }
}

/** Bronnen. Geen eigen test: die claim mag deze staging niet maken. */
const feedSource = {
  key: 'staging-fixture-feed',
  sourceType: 'MERCHANT_FEED' as const,
  title: 'Productgegevens uit de fixturefeed van de stagingomgeving',
  publisher: null,
  factTypes: ['specificaties', 'afmetingen', 'materiaal'],
  notes:
    'Fixturedata van de stagingomgeving. Geen productiegegevens en geen live feed van een echte aanbieder.',
}

const priceSource = {
  key: 'staging-price-history',
  sourceType: 'OWN_PRICE_HISTORY' as const,
  title: 'Onze eigen prijsmetingen in de stagingomgeving',
  publisher: null,
  factTypes: ['prijs'],
  notes: 'Prijzen uit de fixturedata; in productie zijn dit onze eigen metingen bij de aanbieder.',
}

const pageSeeds: readonly PageSeed[] = [
  {
    slug: 'mechanische-bouwsets-vergelijken',
    type: 'COMPARISON',
    title: 'Mechanische bouwsets vergeleken op onderdelen, materiaal en bouwtijd',
    primaryQuery: 'welke mechanische bouwset houdt langer bezig dan één middag',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
    clusterSlug: 'speelgoed-hobby-en-cadeaus',
    audience: 'wie graag met zijn handen bouwt',
    useCase: 'een bouwproject voor een regenachtig weekend',
    budgetMinCents: null,
    budgetMaxCents: null,
    criterionNames: ['piece-count', 'assembly', 'material', 'dimensions'],
    products: [
      {
        slug: 'sterrenwacht-bouwset-mechanisch-planetarium',
        mappings: [
          { criterionName: 'piece-count', from: ['Onderdelen'] },
          {
            criterionName: 'assembly',
            from: ['Bouwtijd', 'Aandrijving'],
            format: (values) =>
              [values.Bouwtijd ? `bouwtijd ${values.Bouwtijd}` : '', values.Aandrijving]
                .filter((part) => (part ?? '').length > 0)
                .join(', '),
          },
          { criterionName: 'material', from: ['Materiaal'] },
          {
            criterionName: 'dimensions',
            from: ['Diameter'],
            format: (values) => `${values.Diameter} diameter`,
          },
        ],
      },
      {
        slug: 'mechano-arm-robotarm-bouwpakket',
        mappings: [
          {
            criterionName: 'assembly',
            from: ['Bouwtijd', 'Bediening'],
            format: (values) =>
              [values.Bouwtijd ? `bouwtijd ${values.Bouwtijd}` : '', values.Bediening]
                .filter((part) => (part ?? '').length > 0)
                .join(', '),
          },
        ],
      },
      {
        slug: 'knikkerlijn-grand-houten-knikkerbaan',
        mappings: [
          { criterionName: 'piece-count', from: ['Onderdelen'] },
          { criterionName: 'material', from: ['Materiaal'] },
          {
            criterionName: 'dimensions',
            from: ['Hoogte'],
            format: (values) => `${values.Hoogte} hoog`,
          },
        ],
      },
    ],
    featured: {
      slug: 'sterrenwacht-bouwset-mechanisch-planetarium',
      label: 'Meest complete keuze',
      reason:
        'Van de drie sets levert deze de meeste onderdelen en de langste bouwtijd, en dat zijn precies de twee criteria waarop wij hier vergelijken. Voor wie een project van een hele middag wil, is dat het verschil.',
      alternativeNote: null,
    },
  },
  {
    slug: 'slim-in-huis-onder-100-euro',
    type: 'BUDGET_GUIDE',
    title: 'Slim in huis onder 100 euro',
    primaryQuery: 'wat kun je onder honderd euro aan slimme hulp in huis halen',
    searchIntent: 'COMMERCIAL_INVESTIGATION',
    clusterSlug: 'smart-home-en-schoonmaak',
    audience: 'wie klein wil beginnen met slimme apparaten',
    useCase: 'een eerste slim apparaat zonder abonnement',
    budgetMinCents: 3000,
    budgetMaxCents: 10000,
    criterionNames: ['app-required', 'power', 'dimensions'],
    products: [
      {
        slug: 'warmvoet-kussen-verwarmd-voetenkussen-voor-onder-het-bureau',
        mappings: [
          { criterionName: 'power', from: ['Vermogen'] },
          { criterionName: 'dimensions', from: ['Afmetingen'] },
        ],
      },
      {
        slug: 'botanica-pot-slimme-plantenpot-met-waterstand',
        mappings: [
          {
            criterionName: 'dimensions',
            from: ['Diameter'],
            format: (values) => `${values.Diameter} diameter`,
          },
        ],
      },
      {
        slug: 'lumen-halo-slimme-sfeerlamp',
        mappings: [
          {
            criterionName: 'app-required',
            from: ['Bediening'],
            format: (values) => `ja, ${values.Bediening}`,
          },
        ],
      },
      {
        slug: 'snoetje-automatische-voerdispenser-met-camera',
        mappings: [
          {
            criterionName: 'app-required',
            from: ['App'],
            format: (values) => `ja, ${values.App}`,
          },
        ],
      },
    ],
  },
  {
    slug: 'designvondsten-voor-een-kleine-woonkamer',
    type: 'DESIGN_COLLECTION',
    title: 'Designvondsten voor een kleine woonkamer',
    primaryQuery: 'welke designstukken passen in een kleine woonkamer',
    searchIntent: 'INSPIRATIONAL',
    clusterSlug: 'wonen-design-en-meubels',
    audience: 'wie weinig vierkante meters heeft en toch iets bijzonders wil',
    useCase: 'een woonkamer van rond de twintig vierkante meter',
    budgetMinCents: null,
    budgetMaxCents: null,
    criterionNames: ['material', 'dimensions', 'weight'],
    products: [
      {
        slug: 'atelier-noord-wolkstoel-fauteuil',
        mappings: [
          {
            criterionName: 'material',
            from: ['Stof', 'Frame'],
            format: (values) =>
              [values.Stof, values.Frame ? `frame van ${values.Frame}` : '']
                .filter((part) => (part ?? '').length > 0)
                .join(', '),
          },
          {
            criterionName: 'dimensions',
            from: ['Breedte', 'Zithoogte'],
            format: (values) =>
              [
                values.Breedte ? `${values.Breedte} breed` : '',
                values.Zithoogte ? `zithoogte ${values.Zithoogte}` : '',
              ]
                .filter((part) => part.length > 0)
                .join(', '),
          },
          { criterionName: 'weight', from: ['Gewicht'] },
        ],
      },
      {
        slug: 'nocta-bijzettafel-met-ingebouwde-koeling',
        mappings: [
          {
            criterionName: 'dimensions',
            from: ['Hoogte', 'Diameter'],
            format: (values) =>
              [
                values.Hoogte ? `${values.Hoogte} hoog` : '',
                values.Diameter ? `${values.Diameter} diameter` : '',
              ]
                .filter((part) => part.length > 0)
                .join(', '),
          },
        ],
      },
      {
        slug: 'atelier-noord-segment-modulaire-bureaulamp',
        mappings: [{ criterionName: 'material', from: ['Materiaal'] }],
      },
      {
        slug: 'nimbus-wolkenlamp-met-bliksemeffect',
        mappings: [
          { criterionName: 'material', from: ['Materiaal'] },
          {
            criterionName: 'dimensions',
            from: ['Breedte'],
            format: (values) => `${values.Breedte} breed`,
          },
        ],
      },
    ],
  },
  {
    slug: 'keukenvondsten-die-je-niet-verwacht',
    type: 'DISCOVERY_COLLECTION',
    title: 'Keukenvondsten die je niet verwacht',
    primaryQuery: 'welke apparaten voor keuken en huis kende je nog niet',
    searchIntent: 'INSPIRATIONAL',
    clusterSlug: 'koffie-en-slimme-keuken',
    audience: 'wie graag iets tegenkomt waarvan hij het bestaan niet wist',
    useCase: null,
    budgetMinCents: null,
    budgetMaxCents: null,
    // Een vondstencollectie vergelijkt niet op criteria: hier gaat het om de
    // vondst zelf, met een eerlijk aandachtspunt per product.
    criterionNames: [],
    products: [
      { slug: 'gelato-uno-compacte-ijsmachine' },
      { slug: 'fornello-piccolo-draagbare-pizzaoven' },
      { slug: 'nordwind-vapor-stoomoven-38-liter' },
      { slug: 'stofveeg-ronde-robotstofzuiger-met-dweilfunctie' },
    ],
  },
]

const reviewerNotes =
  'Stagingdata: automatisch klaargezet zodat de indexeringspoort, de vergelijkingstabel en de collectietemplates te bekijken zijn. Dit is geen echte redactionele controle.'

async function main(): Promise<void> {
  if (isProductionEnv()) {
    console.error('Deze seed is voor staging. In productie wordt hij niet uitgevoerd.')
    process.exitCode = 1
    return
  }

  const now = new Date()

  const sources = new Map<string, string>()
  for (const source of [feedSource, priceSource]) {
    const existing = await prisma.evidenceSource.findFirst({
      where: { title: source.title },
      select: { id: true },
    })
    const record = existing
      ? await prisma.evidenceSource.update({
          where: { id: existing.id },
          data: { factTypes: source.factTypes, notes: source.notes, usageAllowed: true },
        })
      : await prisma.evidenceSource.create({
          data: {
            sourceType: source.sourceType,
            title: source.title,
            publisher: source.publisher,
            factTypes: source.factTypes,
            notes: source.notes,
            usageAllowed: true,
            accessedAt: now,
          },
        })
    sources.set(source.key, record.id)
  }

  for (const seed of pageSeeds) {
    await seedPage(seed, sources, now)
  }

  await activateClusters()
}

/** Eerste doelgroep uit de bestaande content; nooit een nieuwe verzinnen. */
function firstAudience(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const first = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0)
  return typeof first === 'string' ? first.trim() : null
}

async function seedPage(
  seed: PageSeed,
  sources: Map<string, string>,
  now: Date,
): Promise<void> {
  const archetype = archetypeFor(seed.type)
  const cluster = await prisma.contentCluster.findUnique({
    where: { slug: seed.clusterSlug },
    select: { id: true },
  })
  if (!cluster) {
    console.warn(`Cluster ${seed.clusterSlug} bestaat niet; sla ${seed.slug} over.`)
    return
  }

  const products = await prisma.product.findMany({
    where: { slug: { in: seed.products.map((entry) => entry.slug) } },
    select: {
      id: true,
      slug: true,
      title: true,
      brand: true,
      specifications: true,
      experienceType: true,
      editorial: { select: { caveat: true, bestFor: true, experienceType: true } },
    },
  })
  const productBySlug = new Map(products.map((product) => [product.slug, product]))

  const missing = seed.products.filter((entry) => !productBySlug.has(entry.slug))
  if (missing.length > 0) {
    console.warn(
      `Ontbrekende producten voor ${seed.slug}: ${missing.map((entry) => entry.slug).join(', ')}. Sla deze pagina over.`,
    )
    return
  }

  const criteria = await prisma.comparisonCriterion.findMany({
    where: { name: { in: [...seed.criterionNames] } },
  })
  if (criteria.length !== seed.criterionNames.length) {
    console.warn(`Niet alle criteria bestaan voor ${seed.slug}; sla deze pagina over.`)
    return
  }
  const criterionByName = new Map(criteria.map((criterion) => [criterion.name, criterion]))

  /** Waarden per product: uit de brondata of expliciet niet opgegeven. */
  const values = seed.products.map((entry) => {
    const product = productBySlug.get(entry.slug)!
    const specifications = (product.specifications ?? {}) as Record<string, unknown>
    const cells = seed.criterionNames.map((criterionName) => {
      const mapping = entry.mappings?.find((item) => item.criterionName === criterionName)
      if (!mapping) return { criterionName, value: null }
      const found: Record<string, string> = {}
      for (const key of mapping.from) {
        const raw = specifications[key]
        if (typeof raw === 'string' && raw.trim().length > 0) found[key] = raw.trim()
      }
      if (Object.keys(found).length === 0) return { criterionName, value: null }
      const value = mapping.format
        ? mapping.format(found)
        : (found[mapping.from[0] ?? ''] ?? Object.values(found)[0] ?? '')
      const trimmed = value.trim()
      return { criterionName, value: trimmed.length > 0 ? trimmed : null }
    })
    return { productId: product.id, slug: entry.slug, cells }
  })

  // De pagina bestaat nog niet, of wordt met dezelfde slug bijgewerkt: alle
  // afgeleide gegevens worden opnieuw opgebouwd.
  const existing = await prisma.editorialPage.findUnique({
    where: { slug: seed.slug },
    select: { id: true },
  })

  const base = {
    type: seed.type,
    title: seed.title,
    clusterId: cluster.id,
    primaryQuery: seed.primaryQuery,
    searchIntent: seed.searchIntent,
    audience: seed.audience,
    useCase: seed.useCase,
    budgetMinCents: seed.budgetMinCents,
    budgetMaxCents: seed.budgetMaxCents,
  }

  const page = existing
    ? await prisma.editorialPage.update({ where: { id: existing.id }, data: base })
    : await prisma.editorialPage.create({
        data: {
          ...base,
          slug: seed.slug,
          // Tekst en SEO-velden komen hieronder uit de templategenerator.
          introduction: 'wordt hieronder gevuld',
          seoTitle: seed.title,
          metaDescription: seed.title,
          status: 'DRAFT',
        },
      })

  await prisma.editorialPageProduct.deleteMany({ where: { editorialPageId: page.id } })
  await prisma.editorialPageCriterion.deleteMany({ where: { editorialPageId: page.id } })
  await prisma.productCriterionValue.deleteMany({ where: { editorialPageId: page.id } })

  for (const [index, entry] of seed.products.entries()) {
    const product = productBySlug.get(entry.slug)!
    const caveat = product.editorial?.caveat ?? null
    if (archetype.requiresPerProductCaveat && (caveat ?? '').trim().length < 10) {
      console.warn(`${entry.slug} heeft geen aandachtspunt in zijn content; de poort zal dat melden.`)
    }
    const verified = values
      .find((item) => item.slug === entry.slug)!
      .cells.filter((cell) => cell.value !== null)
    const recommendation =
      verified.length > 0
        ? `Opgenomen op gecontroleerde gegevens: ${verified
            .map((cell) => `${criterionByName.get(cell.criterionName)?.label ?? cell.criterionName} ${cell.value}`)
            .join('; ')}.`
        : null

    await prisma.editorialPageProduct.create({
      data: {
        editorialPageId: page.id,
        productId: product.id,
        role: 'SELECTED',
        position: index,
        bestForAudience: firstAudience(product.editorial?.bestFor),
        recommendation,
        caveat,
        label: entry.label ?? null,
        exceedsBudget: false,
        budgetNote: null,
      },
    })
  }

  for (const [index, criterionName] of seed.criterionNames.entries()) {
    await prisma.editorialPageCriterion.create({
      data: { editorialPageId: page.id, criterionName, displayOrder: index },
    })
  }

  for (const entry of values) {
    for (const cell of entry.cells) {
      const provided = cell.value !== null
      await prisma.productCriterionValue.create({
        data: {
          editorialPageId: page.id,
          productId: entry.productId,
          criterionName: cell.criterionName,
          value: cell.value,
          // Een waarde uit de brondata krijgt de feedbron; ontbreekt de waarde,
          // dan staat dat er als NOT_PROVIDED en niet als een gok.
          sourceId: provided ? (sources.get(feedSource.key) ?? null) : null,
          verificationStatus: provided ? 'VERIFIED' : 'NOT_PROVIDED',
          verifiedAt: provided ? now : null,
        },
      })
    }
  }

  await prisma.editorialPageSource.deleteMany({ where: { editorialPageId: page.id } })
  for (const key of [feedSource.key, priceSource.key]) {
    const sourceId = sources.get(key)
    if (!sourceId) continue
    await prisma.editorialPageSource.create({
      data: { editorialPageId: page.id, sourceId },
    })
  }

  // Tekst uit dezelfde generator die de admin gebruikt, met de openingen van de
  // eerder gemaakte pagina's zodat niet elke pagina hetzelfde begint.
  const recentOpenings = await prisma.editorialPage.findMany({
    where: { id: { not: page.id }, openingHash: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: OPENING_HISTORY_WINDOW,
    select: { openingStyle: true, openingHash: true, closingHash: true },
  })

  const facts: EditorialDraftFacts = {
    type: seed.type,
    primaryQuery: seed.primaryQuery,
    searchIntent: seed.searchIntent,
    audience: seed.audience,
    useCase: seed.useCase,
    budgetMinCents: seed.budgetMinCents,
    budgetMaxCents: seed.budgetMaxCents,
    criteria: seed.criterionNames.map((name) => {
      const criterion = criterionByName.get(name)!
      return { label: criterion.label, explanation: criterion.explanation, unit: criterion.unit }
    }),
    products: seed.products.map((entry) => {
      const product = productBySlug.get(entry.slug)!
      const cells = values.find((item) => item.slug === entry.slug)!.cells
      return {
        productId: product.id,
        title: product.title,
        brand: product.brand,
        currentPriceCents: null,
        verifiedCriteria: cells
          .filter((cell) => cell.value !== null)
          .map((cell) => {
            const criterion = criterionByName.get(cell.criterionName)!
            return { label: criterion.label, value: cell.value!, unit: criterion.unit }
          }),
        missingCriteria: cells
          .filter((cell) => cell.value === null)
          .map((cell) => criterionByName.get(cell.criterionName)?.label ?? cell.criterionName),
        knownCaveat: product.editorial?.caveat ?? null,
        experienceType: product.editorial?.experienceType ?? product.experienceType,
        isAlternative: false,
      }
    }),
    sources: [
      { typeLabel: 'feed van de aanbieder', title: feedSource.title },
      { typeLabel: 'onze eigen prijshistorie', title: priceSource.title },
    ],
    // Geen eigen test: die claim maakt deze staging niet.
    handsOnTested: false,
    key: seed.slug,
    recentOpenings,
  }

  const result = buildTemplateDraft(facts)
  const problems = findDraftProblems(result.draft, facts)
  if (problems.length > 0) {
    throw new Error(`Concept voor ${seed.slug} afgekeurd: ${problems.join('; ')}`)
  }

  const featuredProduct = seed.featured ? productBySlug.get(seed.featured.slug) : undefined
  if (seed.featured && !featuredProduct) {
    throw new Error(`Uitgelicht product ${seed.featured.slug} staat niet op ${seed.slug}.`)
  }

  await prisma.editorialPage.update({
    where: { id: page.id },
    data: {
      introduction: result.draft.introduction,
      methodology: result.draft.methodology,
      selectionCriteria: result.draft.selectionCriteria,
      conclusion: result.draft.conclusion,
      seoTitle: result.draft.seoTitle,
      metaDescription: result.draft.metaDescription,
      frequentlyAskedQuestions: result.draft.frequentlyAskedQuestions,
      generationProvider: result.provider,
      generationModel: result.model,
      generationWarnings: result.warnings,
      openingStyle: result.openingStyle,
      openingHash: result.openingHash,
      closingHash: result.closingHash,
      styleVersion: result.styleVersion,
      styleWarnings: result.styleWarnings,
      ...(featuredProduct && seed.featured
        ? {
            featuredProductId: featuredProduct.id,
            featuredLabel: seed.featured.label,
            featuredReason: seed.featured.reason,
            featuredCaveat: featuredProduct.editorial?.caveat ?? null,
            featuredAlternativeNote: seed.featured.alternativeNote,
          }
        : {
            featuredProductId: null,
            featuredLabel: null,
            featuredReason: null,
            featuredCaveat: null,
            featuredAlternativeNote: null,
          }),
      status: 'PUBLISHED',
      publishedAt: now,
      reviewedAt: now,
      humanReviewedAt: now,
      humanEdited: false,
      lastFactCheckedAt: now,
      reviewerNotes,
    },
  })

  const evaluation = await refreshIndexability(prisma, page.id, now)
  const verdict = evaluation?.verdict.indexable
    ? 'indexeerbaar'
    : `niet indexeerbaar: ${evaluation?.reasons.join('; ') ?? 'onbekend'}`
  console.info(`${seed.slug} (${archetype.label}): ${verdict}`)
}

/**
 * Zet de clusters met een gepubliceerde pagina aan.
 *
 * De drempels van een cluster gaan over een productiecatalogus. De
 * fixturecatalogus van staging is kleiner, dus worden `minProducts` en
 * `minEditorialPages` hier op de werkelijke aantallen gezet. De logica van de
 * prominentiepoort blijft ongemoeid: zij rekent gewoon met deze drempels.
 * Clusters zonder pagina blijven concept en onzichtbaar.
 */
async function activateClusters(): Promise<void> {
  const clusters = await prisma.contentCluster.findMany({
    include: { editorialPages: { where: { status: 'PUBLISHED' }, select: { id: true } } },
  })

  for (const cluster of clusters) {
    if (cluster.editorialPages.length === 0) continue
    const productCount = await prisma.product.count({
      where: publicProductFilter({
        primaryCategory: { in: categoryNamesFor(cluster.categorySlugs) },
      }),
    })
    await prisma.contentCluster.update({
      where: { id: cluster.id },
      data: {
        status: 'PUBLISHED',
        visible: true,
        minProducts: Math.min(cluster.minProducts, productCount),
        minEditorialPages: Math.min(cluster.minEditorialPages, cluster.editorialPages.length),
      },
    })
    console.info(
      `Cluster ${cluster.slug}: ${productCount} producten en ${cluster.editorialPages.length} pagina('s) zichtbaar.`,
    )
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
