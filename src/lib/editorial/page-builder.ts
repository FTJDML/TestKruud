import type { EditorialPageType, PrismaClient, SearchIntent } from '@prisma/client'
import { archetypeFor } from '@/lib/editorial/archetypes'
import { refreshIndexability } from '@/lib/editorial/service'
import { OPENING_HISTORY_WINDOW } from '@/lib/ai/style/openings'
import { buildTemplateDraft, findDraftProblems, type EditorialDraftFacts } from '@/lib/ai/editorial-draft'

/**
 * Bouwt een redactionele pagina uit producten die al in de database staan.
 *
 * Wat deze bouwer wel doet: criteria koppelen, criteriumwaarden uit de
 * gecontroleerde specificaties halen, een conceptttekst laten schrijven door de
 * bestaande generator en de indexeringspoort erover laten rekenen.
 *
 * Wat hij nooit doet: een waarde verzinnen die de brondata niet levert, en een
 * pagina publiceren die niet aan haar archetype voldoet. Haalt de selectie het
 * minimum niet, dan blijft de pagina `DRAFT` met de reden erbij. Liever een
 * concept dan een pagina die doet alsof er genoeg gegevens zijn.
 */
export type PageProductInput = {
  productId: string
  /** Aandachtspunt uit de bestaande content van het product. */
  caveat: string | null
  bestForAudience: string | null
  label?: string | null
  /** Gecontroleerde prijs in centen, voor de budgetcontrole. */
  currentPriceCents: number | null
  specifications: Record<string, string>
}

export type PageDefinition = {
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
  /** Criteria van de pagina, met de specificatienamen waar hun waarde in staat. */
  criteria: ReadonlyArray<{ name: string; specAliases: readonly string[] }>
}

export type BuildResult = {
  slug: string
  status: 'PUBLISHED' | 'DRAFT'
  products: number
  verifiedValues: number
  notProvidedValues: number
  indexable: boolean
  reasons: string[]
}

/** Zoekt de specificatie die bij een criterium hoort; anders niets. */
function specificationFor(
  specifications: Record<string, string>,
  aliases: readonly string[],
): string | null {
  const entries = Object.entries(specifications)
  for (const alias of aliases) {
    const match = entries.find(([key]) => key.toLowerCase() === alias.toLowerCase())
    if (match) return match[1]
  }
  for (const alias of aliases) {
    const match = entries.find(([key]) => key.toLowerCase().includes(alias.toLowerCase()))
    if (match) return match[1]
  }
  return null
}

export async function buildEditorialPage(
  prisma: PrismaClient,
  definition: PageDefinition,
  products: readonly PageProductInput[],
  options: { sourceIds: readonly string[]; reviewerNotes: string; now?: Date },
): Promise<BuildResult> {
  const now = options.now ?? new Date()
  const archetype = archetypeFor(definition.type)
  const reasons: string[] = []

  const cluster = await prisma.contentCluster.findUnique({
    where: { slug: definition.clusterSlug },
    select: { id: true },
  })
  if (!cluster) reasons.push(`cluster ${definition.clusterSlug} bestaat niet`)

  // Budgetpagina: alleen producten met een gecontroleerde prijs binnen de grens.
  const withinBudget = products.filter((product) => {
    if (definition.budgetMaxCents === null) return true
    return product.currentPriceCents !== null && product.currentPriceCents <= definition.budgetMaxCents
  })
  if (definition.budgetMaxCents !== null && withinBudget.length < products.length) {
    reasons.push(
      `${products.length - withinBudget.length} product(en) hebben geen gecontroleerde prijs binnen het budget`,
    )
  }

  const selected = withinBudget.slice(0, archetype.preferredProducts.max)
  if (selected.length < archetype.minProducts) {
    reasons.push(
      `${archetype.label} vraagt minimaal ${archetype.minProducts} producten met bruikbare gegevens, nu ${selected.length}`,
    )
  }
  if (archetype.requiresPerProductCaveat) {
    const withoutCaveat = selected.filter((product) => (product.caveat ?? '').trim().length < 10)
    if (withoutCaveat.length > 0) {
      reasons.push(`${withoutCaveat.length} product(en) missen een aandachtspunt uit hun eigen content`)
    }
  }

  const publishable = reasons.length === 0
  const existing = await prisma.editorialPage.findUnique({
    where: { slug: definition.slug },
    select: { id: true },
  })

  const base = {
    type: definition.type,
    title: definition.title,
    clusterId: cluster?.id ?? null,
    primaryQuery: definition.primaryQuery,
    searchIntent: definition.searchIntent,
    audience: definition.audience,
    useCase: definition.useCase,
    budgetMinCents: definition.budgetMinCents,
    budgetMaxCents: definition.budgetMaxCents,
  }

  const page = existing
    ? await prisma.editorialPage.update({ where: { id: existing.id }, data: base })
    : await prisma.editorialPage.create({
        data: {
          ...base,
          slug: definition.slug,
          introduction: 'wordt hieronder gevuld',
          seoTitle: definition.title,
          metaDescription: definition.title,
          status: 'DRAFT',
        },
      })

  await prisma.editorialPageProduct.deleteMany({ where: { editorialPageId: page.id } })
  await prisma.editorialPageCriterion.deleteMany({ where: { editorialPageId: page.id } })
  await prisma.productCriterionValue.deleteMany({ where: { editorialPageId: page.id } })
  await prisma.editorialPageSource.deleteMany({ where: { editorialPageId: page.id } })

  const criteria = await prisma.comparisonCriterion.findMany({
    where: { name: { in: definition.criteria.map((entry) => entry.name) } },
  })
  const criterionByName = new Map(criteria.map((criterion) => [criterion.name, criterion]))

  for (const [index, entry] of definition.criteria.entries()) {
    if (!criterionByName.has(entry.name)) continue
    await prisma.editorialPageCriterion.create({
      data: { editorialPageId: page.id, criterionName: entry.name, displayOrder: index },
    })
  }

  let verifiedValues = 0
  let notProvidedValues = 0
  for (const [index, product] of selected.entries()) {
    await prisma.editorialPageProduct.create({
      data: {
        editorialPageId: page.id,
        productId: product.productId,
        role: 'SELECTED',
        position: index,
        bestForAudience: product.bestForAudience,
        caveat: product.caveat,
        label: product.label ?? null,
      },
    })

    for (const entry of definition.criteria) {
      if (!criterionByName.has(entry.name)) continue
      const value = specificationFor(product.specifications, entry.specAliases)
      const provided = value !== null && value.trim().length > 0
      if (provided) verifiedValues += 1
      else notProvidedValues += 1
      await prisma.productCriterionValue.create({
        data: {
          editorialPageId: page.id,
          productId: product.productId,
          criterionName: entry.name,
          value: provided ? value.trim() : null,
          sourceId: provided ? (options.sourceIds[0] ?? null) : null,
          verificationStatus: provided ? 'VERIFIED' : 'NOT_PROVIDED',
          verifiedAt: provided ? now : null,
        },
      })
    }
  }

  for (const sourceId of options.sourceIds) {
    await prisma.editorialPageSource.create({ data: { editorialPageId: page.id, sourceId } })
  }

  const recentOpenings = await prisma.editorialPage.findMany({
    where: { id: { not: page.id }, openingHash: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: OPENING_HISTORY_WINDOW,
    select: { openingStyle: true, openingHash: true, closingHash: true },
  })

  const values = await prisma.productCriterionValue.findMany({ where: { editorialPageId: page.id } })
  const facts: EditorialDraftFacts = {
    type: definition.type,
    primaryQuery: definition.primaryQuery,
    searchIntent: definition.searchIntent,
    audience: definition.audience,
    useCase: definition.useCase,
    budgetMinCents: definition.budgetMinCents,
    budgetMaxCents: definition.budgetMaxCents,
    criteria: definition.criteria.flatMap((entry) => {
      const criterion = criterionByName.get(entry.name)
      return criterion
        ? [{ label: criterion.label, explanation: criterion.explanation, unit: criterion.unit }]
        : []
    }),
    products: selected.map((product) => {
      const mine = values.filter((value) => value.productId === product.productId)
      return {
        productId: product.productId,
        title: '',
        brand: null,
        currentPriceCents: null,
        verifiedCriteria: mine
          .filter((value) => value.verificationStatus === 'VERIFIED' && value.value !== null)
          .map((value) => {
            const criterion = criterionByName.get(value.criterionName)
            return { label: criterion?.label ?? value.criterionName, value: value.value!, unit: criterion?.unit ?? null }
          }),
        missingCriteria: mine
          .filter((value) => value.verificationStatus !== 'VERIFIED')
          .map((value) => criterionByName.get(value.criterionName)?.label ?? value.criterionName),
        knownCaveat: product.caveat,
        experienceType: 'NOT_TESTED' as const,
        isAlternative: false,
      }
    }),
    sources: [{ typeLabel: 'documentatie van de fabrikant', title: 'Catalogusgegevens van de fabrikant' }],
    handsOnTested: false,
    key: definition.slug,
    recentOpenings,
  }

  const result = buildTemplateDraft(facts)
  const problems = findDraftProblems(result.draft, facts)
  if (problems.length > 0) reasons.push(`concept afgekeurd: ${problems.join('; ')}`)

  const status = publishable && problems.length === 0 ? 'PUBLISHED' : 'DRAFT'
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
      status,
      // Alleen een pagina die er inhoudelijk staat, krijgt de reviewvelden.
      publishedAt: status === 'PUBLISHED' ? now : null,
      reviewedAt: status === 'PUBLISHED' ? now : null,
      humanReviewedAt: status === 'PUBLISHED' ? now : null,
      lastFactCheckedAt: status === 'PUBLISHED' ? now : null,
      indexabilityReasons: reasons,
      reviewerNotes: options.reviewerNotes,
    },
  })

  const evaluation = await refreshIndexability(prisma, page.id, now)
  return {
    slug: definition.slug,
    status,
    products: selected.length,
    verifiedValues,
    notProvidedValues,
    indexable: evaluation?.verdict.indexable ?? false,
    reasons: status === 'PUBLISHED' ? (evaluation?.reasons ?? []) : reasons,
  }
}
