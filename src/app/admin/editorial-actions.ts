'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { EditorialPageType } from '@prisma/client'
import { prisma } from '@/lib/database/client'
import { readAdminSession } from '@/lib/admin/auth'
import { archetypeFor, editorialPageTypes } from '@/lib/editorial/archetypes'
import { clusterSeeds } from '@/lib/editorial/clusters'
import { checkOverlap } from '@/lib/editorial/overlap'
import { overlapCandidates, refreshIndexability } from '@/lib/editorial/service'
import { suggestInternalLinks } from '@/lib/editorial/internal-links'
import { buildTemplateDraft, findDraftProblems, type EditorialDraftFacts } from '@/lib/ai/editorial-draft'
import { evidenceSourceTypeLabel } from '@/lib/database/editorial-queries'
import { parseEditorialBriefs, slugFromTitle } from '@/lib/csv/editorial-brief'
import { parseProductImport } from '@/lib/csv/product-import'
import { categorySlugForName } from '@/lib/categories'
import { toCents } from '@/lib/pricing/money'
import { errorMessage, logger } from '@/lib/logger'

/**
 * Serveracties voor de Editorial SEO Engine.
 *
 * Twee regels lopen door alles heen: `indexable` wordt nooit met de hand gezet
 * (de quality gate bepaalt dat), en bulkacties publiceren nooit direct — zij
 * maken concepten, plannen of zetten een fact-checkstatus.
 */
async function requireSession(): Promise<void> {
  const session = await readAdminSession()
  if (!session) redirect('/admin/login')
}

export type EditorialActionState = { ok: boolean; message: string } | null

function revalidateEditorial(slug?: string): void {
  revalidatePath('/admin/redactie')
  revalidatePath('/admin/lancering')
  revalidatePath('/gidsen')
  revalidatePath('/')
  if (slug) revalidatePath(`/gids/${slug}`)
}

const pageTypeSchema = z.enum(editorialPageTypes as [EditorialPageType, ...EditorialPageType[]])
const statusSchema = z.enum(['DRAFT', 'NEEDS_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])

function optionalText(value: FormDataEntryValue | null, max = 4000): string | null {
  const text = String(value ?? '').trim()
  return text.length === 0 ? null : text.slice(0, max)
}

function optionalCents(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim()
  if (text.length === 0) return null
  return toCents(text)
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base.length > 0 ? base : 'redactionele-pagina'
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`
    const existing = await prisma.editorialPage.findUnique({ where: { slug: candidate } })
    if (!existing || existing.id === excludeId) return candidate
  }
  return `${root}-${Date.now()}`
}

/**
 * Maakt een nieuwe pagina aan. De overlapcontrole loopt hier al: bij sterke
 * overlap met bestaande content wordt de pagina niet aangemaakt, met een
 * voorstel om samen te voegen of een canonical te zetten.
 */
export async function createEditorialPageAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const type = pageTypeSchema.parse(String(formData.get('type') ?? ''))
  const title = String(formData.get('title') ?? '').trim()
  const primaryQuery = String(formData.get('primaryQuery') ?? '').trim()
  if (title.length < 10) return { ok: false, message: 'Geef een titel van minimaal tien tekens.' }
  if (primaryQuery.length < 8) return { ok: false, message: 'Geef de zoekvraag van de bezoeker.' }

  const candidates = await overlapCandidates(prisma)
  const overlap = checkOverlap(
    { id: 'nieuw', slug: 'nieuw', title, primaryQuery, productIds: [], introduction: '' },
    candidates,
  )
  if (overlap.level === 'block') {
    const first = overlap.matches[0]
    return {
      ok: false,
      message: `Niet aangemaakt: ${overlap.reasons.join('; ')}. Voorstel: ${overlap.recommendation}${
        first ? ` met "${first.title}" (/gids/${first.slug})` : ''
      }.`,
    }
  }

  const archetype = archetypeFor(type)
  const page = await prisma.editorialPage.create({
    data: {
      type,
      title,
      slug: await uniqueSlug(slugFromTitle(title)),
      primaryQuery,
      searchIntent: archetype.defaultIntent,
      introduction: '',
      seoTitle: title.slice(0, 60),
      metaDescription: '',
      status: 'DRAFT',
      clusterId: optionalText(formData.get('clusterId'), 40),
      audience: optionalText(formData.get('audience'), 200),
      useCase: optionalText(formData.get('useCase'), 300),
      budgetMinCents: optionalCents(formData.get('budgetMin')),
      budgetMaxCents: optionalCents(formData.get('budgetMax')),
    },
  })

  revalidateEditorial()
  redirect(`/admin/redactie/${page.id}`)
}

const detailsSchema = z.object({
  title: z.string().min(10).max(160),
  primaryQuery: z.string().min(8).max(200),
  searchIntent: z.enum(['INFORMATIONAL', 'COMMERCIAL_INVESTIGATION', 'TRANSACTIONAL', 'INSPIRATIONAL']),
  seoTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(170),
  introduction: z.string().max(8000),
})

/** Werkt de redactionele velden bij. Zet nooit zelf `indexable`. */
export async function updateEditorialPageAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const id = String(formData.get('pageId') ?? '')
  const parsed = detailsSchema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    primaryQuery: String(formData.get('primaryQuery') ?? '').trim(),
    searchIntent: String(formData.get('searchIntent') ?? 'COMMERCIAL_INVESTIGATION'),
    seoTitle: String(formData.get('seoTitle') ?? '').trim(),
    metaDescription: String(formData.get('metaDescription') ?? '').trim(),
    introduction: String(formData.get('introduction') ?? '').trim(),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join('; ') }
  }

  const faqs = parseFaqs(String(formData.get('faqs') ?? ''))
  const page = await prisma.editorialPage.update({
    where: { id },
    data: {
      ...parsed.data,
      methodology: optionalText(formData.get('methodology'), 8000),
      selectionCriteria: optionalText(formData.get('selectionCriteria'), 4000),
      conclusion: optionalText(formData.get('conclusion'), 4000),
      audience: optionalText(formData.get('audience'), 200),
      useCase: optionalText(formData.get('useCase'), 300),
      budgetMinCents: optionalCents(formData.get('budgetMin')),
      budgetMaxCents: optionalCents(formData.get('budgetMax')),
      clusterId: optionalText(formData.get('clusterId'), 40),
      heroImage: optionalText(formData.get('heroImage'), 500),
      canonicalUrl: optionalText(formData.get('canonicalUrl'), 500),
      reviewerNotes: optionalText(formData.get('reviewerNotes'), 2000),
      frequentlyAskedQuestions: faqs,
      featuredProductId: optionalText(formData.get('featuredProductId'), 40),
      featuredLabel: optionalText(formData.get('featuredLabel'), 60),
      featuredReason: optionalText(formData.get('featuredReason'), 1000),
      featuredCaveat: optionalText(formData.get('featuredCaveat'), 1000),
      featuredAlternativeNote: optionalText(formData.get('featuredAlternativeNote'), 1000),
    },
  })

  const evaluation = await refreshIndexability(prisma, id)
  revalidateEditorial(page.slug)
  return {
    ok: true,
    message: evaluation?.verdict.indexable
      ? 'Opgeslagen. Deze pagina is indexeerbaar.'
      : `Opgeslagen. Nog niet indexeerbaar: ${evaluation?.reasons.slice(0, 3).join('; ') ?? 'onbekend'}`,
  }
}

/** Eén FAQ per regel: `vraag | antwoord`. */
function parseFaqs(raw: string): Array<{ question: string; answer: string }> {
  return raw
    .split('\n')
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({
      question: (parts[0] ?? '').trim(),
      answer: parts.slice(1).join('|').trim(),
    }))
    .filter((faq) => faq.question.length >= 10 && faq.answer.length >= 20)
    .slice(0, 6)
}

/** Voegt een product toe aan de pagina, als selectie of als alternatief. */
export async function addPageProductAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const productId = String(formData.get('productId') ?? '').trim()
  const role = String(formData.get('role') ?? 'SELECTED') === 'ALTERNATIVE' ? 'ALTERNATIVE' : 'SELECTED'
  if (productId.length === 0) return

  const count = await prisma.editorialPageProduct.count({ where: { editorialPageId, role } })
  await prisma.editorialPageProduct.upsert({
    where: { editorialPageId_productId: { editorialPageId, productId } },
    create: { editorialPageId, productId, role, position: count },
    update: { role },
  })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

export async function removePageProductAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const productId = String(formData.get('productId') ?? '')
  await prisma.editorialPageProduct.deleteMany({ where: { editorialPageId, productId } })
  await prisma.productCriterionValue.deleteMany({ where: { editorialPageId, productId } })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

/** Redactionele toelichting per product: doelgroep, reden, aandachtspunt. */
export async function updatePageProductAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const productId = String(formData.get('productId') ?? '')
  await prisma.editorialPageProduct.update({
    where: { editorialPageId_productId: { editorialPageId, productId } },
    data: {
      position: Number.parseInt(String(formData.get('position') ?? '0'), 10) || 0,
      bestForAudience: optionalText(formData.get('bestForAudience'), 200),
      recommendation: optionalText(formData.get('recommendation'), 1000),
      caveat: optionalText(formData.get('caveat'), 1000),
      label: optionalText(formData.get('label'), 60),
      exceedsBudget: String(formData.get('exceedsBudget') ?? '') === 'on',
      budgetNote: optionalText(formData.get('budgetNote'), 500),
    },
  })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

/** Koppelt een criterium uit de bibliotheek aan de pagina. */
export async function addPageCriterionAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const criterionName = String(formData.get('criterionName') ?? '').trim()
  if (criterionName.length === 0) return
  const count = await prisma.editorialPageCriterion.count({ where: { editorialPageId } })
  await prisma.editorialPageCriterion.upsert({
    where: { editorialPageId_criterionName: { editorialPageId, criterionName } },
    create: { editorialPageId, criterionName, displayOrder: count },
    update: {},
  })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

export async function removePageCriterionAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const criterionName = String(formData.get('criterionName') ?? '')
  await prisma.editorialPageCriterion.deleteMany({ where: { editorialPageId, criterionName } })
  await prisma.productCriterionValue.deleteMany({ where: { editorialPageId, criterionName } })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

/**
 * Zet één criteriumwaarde. Een lege waarde betekent `NOT_PROVIDED`: de tabel
 * toont dan "Niet opgegeven". Er wordt nooit een waarde geraden, ook niet door
 * de AI — dit is de enige plek waar een waarde binnenkomt.
 */
export async function setCriterionValueAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const productId = String(formData.get('productId') ?? '')
  const criterionName = String(formData.get('criterionName') ?? '')
  const value = optionalText(formData.get('value'), 200)
  const sourceId = optionalText(formData.get('sourceId'), 40)
  const verified = String(formData.get('verified') ?? '') === 'on'

  const status = value === null ? 'NOT_PROVIDED' : verified ? 'VERIFIED' : 'UNVERIFIED'
  await prisma.productCriterionValue.upsert({
    where: {
      editorialPageId_productId_criterionName: { editorialPageId, productId, criterionName },
    },
    create: {
      editorialPageId,
      productId,
      criterionName,
      value,
      sourceId,
      verificationStatus: status,
      verifiedAt: status === 'VERIFIED' ? new Date() : null,
    },
    update: {
      value,
      sourceId,
      verificationStatus: status,
      verifiedAt: status === 'VERIFIED' ? new Date() : null,
    },
  })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

/** Nieuwe bron; wordt direct aan de pagina gekoppeld. */
export async function addSourceAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const sourceType = z
    .enum([
      'MANUFACTURER_DOCUMENTATION',
      'MERCHANT_FEED',
      'AFFILIATE_API',
      'MANUAL_PRICE_CHECK',
      'OWN_PRICE_HISTORY',
      'OWN_HANDS_ON_TEST',
      'LICENSED_SOURCE',
      'OTHER_VERIFIED_SOURCE',
    ])
    .parse(String(formData.get('sourceType') ?? 'MANUFACTURER_DOCUMENTATION'))
  const title = String(formData.get('title') ?? '').trim()
  if (title.length < 4) return

  const source = await prisma.evidenceSource.create({
    data: {
      sourceType,
      title: title.slice(0, 200),
      publisher: optionalText(formData.get('publisher'), 120),
      url: optionalText(formData.get('url'), 500),
      notes: optionalText(formData.get('notes'), 1000),
      factTypes: String(formData.get('factTypes') ?? '')
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 12),
      usageAllowed: String(formData.get('usageAllowed') ?? 'on') === 'on',
    },
  })
  await prisma.editorialPageSource.create({ data: { editorialPageId, sourceId: source.id } })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

export async function removeSourceAction(formData: FormData): Promise<void> {
  await requireSession()
  const editorialPageId = String(formData.get('pageId') ?? '')
  const sourceId = String(formData.get('sourceId') ?? '')
  await prisma.editorialPageSource.deleteMany({ where: { editorialPageId, sourceId } })
  await refreshIndexability(prisma, editorialPageId)
  revalidatePath(`/admin/redactie/${editorialPageId}`)
}

/** Markeert de fact-check als uitgevoerd. Alleen een mens doet dit. */
export async function markFactCheckedAction(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('pageId') ?? '')
  await prisma.editorialPage.update({ where: { id }, data: { lastFactCheckedAt: new Date() } })
  await refreshIndexability(prisma, id)
  revalidatePath(`/admin/redactie/${id}`)
}

/** Rondt de redactionele review af; nodig voordat een pagina indexeerbaar is. */
export async function markReviewedAction(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('pageId') ?? '')
  await prisma.editorialPage.update({ where: { id }, data: { reviewedAt: new Date() } })
  await refreshIndexability(prisma, id)
  revalidatePath(`/admin/redactie/${id}`)
}

/**
 * Zet de status. Publiceren vraagt een afgeronde review; bij sterke overlap
 * wordt publiceren geweigerd met een voorstel.
 */
export async function setEditorialStatusAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const id = String(formData.get('pageId') ?? '')
  const status = statusSchema.parse(String(formData.get('status') ?? ''))
  const page = await prisma.editorialPage.findUnique({ where: { id } })
  if (!page) return { ok: false, message: 'Pagina niet gevonden.' }

  if (status === 'PUBLISHED') {
    if (!page.reviewedAt) {
      return { ok: false, message: 'Rond eerst de redactionele review af.' }
    }
    const evaluation = await refreshIndexability(prisma, id)
    if (evaluation && evaluation.overlap.level === 'block') {
      return {
        ok: false,
        message: `Niet gepubliceerd: ${evaluation.overlap.reasons.join('; ')}. Voorstel: ${evaluation.overlap.recommendation}.`,
      }
    }
  }

  const scheduledPublishAt =
    status === 'SCHEDULED'
      ? (() => {
          const raw = String(formData.get('scheduledPublishAt') ?? '').trim()
          const date = raw.length > 0 ? new Date(raw) : null
          return date && !Number.isNaN(date.getTime()) ? date : null
        })()
      : page.scheduledPublishAt

  if (status === 'SCHEDULED' && !scheduledPublishAt) {
    return { ok: false, message: 'Kies een publicatiedatum.' }
  }

  await prisma.editorialPage.update({
    where: { id },
    data: {
      status,
      scheduledPublishAt,
      publishedAt: status === 'PUBLISHED' ? (page.publishedAt ?? new Date()) : page.publishedAt,
    },
  })
  const evaluation = await refreshIndexability(prisma, id)
  revalidateEditorial(page.slug)

  return {
    ok: true,
    message:
      status === 'PUBLISHED'
        ? evaluation?.verdict.indexable
          ? 'Gepubliceerd en indexeerbaar.'
          : `Gepubliceerd, maar nog noindex: ${evaluation?.reasons.slice(0, 3).join('; ') ?? ''}`
        : `Status is nu ${status}.`,
  }
}

/**
 * Vraagt een AI-draft aan. De draft vult alleen tekstvelden en zet de pagina op
 * `NEEDS_REVIEW`; criteriumwaarden, producten en prijzen blijven onaangeroerd.
 */
export async function generateDraftAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const id = String(formData.get('pageId') ?? '')
  const page = await prisma.editorialPage.findUnique({
    where: { id },
    include: {
      criteria: { include: { criterion: true } },
      criterionValues: true,
      sources: { include: { source: true } },
      products: { include: { product: true }, orderBy: { position: 'asc' } },
    },
  })
  if (!page) return { ok: false, message: 'Pagina niet gevonden.' }
  if (page.products.length === 0) {
    return { ok: false, message: 'Selecteer eerst producten: zonder feiten valt er niets te schrijven.' }
  }

  const facts: EditorialDraftFacts = {
    type: page.type,
    primaryQuery: page.primaryQuery,
    searchIntent: page.searchIntent,
    audience: page.audience,
    useCase: page.useCase,
    budgetMinCents: page.budgetMinCents,
    budgetMaxCents: page.budgetMaxCents,
    criteria: page.criteria.map((entry) => ({
      label: entry.criterion.label,
      explanation: entry.criterion.explanation,
      unit: entry.criterion.unit,
    })),
    products: page.products.map((entry) => {
      const values = page.criterionValues.filter((value) => value.productId === entry.productId)
      return {
        productId: entry.productId,
        title: entry.product.title,
        brand: entry.product.brand,
        currentPriceCents: null,
        verifiedCriteria: values
          .filter((value) => value.verificationStatus === 'VERIFIED' && value.value !== null)
          .map((value) => ({
            label: page.criteria.find((item) => item.criterionName === value.criterionName)?.criterion.label ??
              value.criterionName,
            value: value.value!,
            unit:
              page.criteria.find((item) => item.criterionName === value.criterionName)?.criterion.unit ?? null,
          })),
        missingCriteria: page.criteria
          .filter(
            (criterion) =>
              !values.some(
                (value) =>
                  value.criterionName === criterion.criterionName &&
                  value.verificationStatus === 'VERIFIED' &&
                  value.value !== null,
              ),
          )
          .map((criterion) => criterion.criterion.label),
        knownCaveat: entry.caveat,
        experienceType: entry.product.experienceType,
        isAlternative: entry.role === 'ALTERNATIVE',
      }
    }),
    sources: page.sources.map((entry) => ({
      typeLabel: evidenceSourceTypeLabel(entry.source.sourceType),
      title: entry.source.title,
    })),
    handsOnTested: page.sources.some((entry) => entry.source.sourceType === 'OWN_HANDS_ON_TEST'),
  }

  try {
    const result = buildTemplateDraft(facts)
    const problems = findDraftProblems(result.draft, facts)
    if (problems.length > 0) {
      logger.warn('AI-draft geweigerd', { page: page.slug, problems })
      return { ok: false, message: `Draft geweigerd: ${problems.join('; ')}` }
    }

    await prisma.editorialPage.update({
      where: { id },
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
        // Een draft is nooit publicabel zonder mens.
        status: 'NEEDS_REVIEW',
        reviewedAt: null,
      },
    })
    await refreshIndexability(prisma, id)
    revalidatePath(`/admin/redactie/${id}`)
    return {
      ok: true,
      message: 'Concept gemaakt. De pagina staat op NEEDS_REVIEW: lees de tekst na voordat je publiceert.',
    }
  } catch (error) {
    return { ok: false, message: `Draft mislukt: ${errorMessage(error)}` }
  }
}

/** Zet de zes standaardclusters klaar; bestaande clusters blijven ongemoeid. */
export async function seedClustersAction(): Promise<void> {
  await requireSession()
  for (const cluster of clusterSeeds) {
    await prisma.contentCluster.upsert({
      where: { slug: cluster.slug },
      create: {
        slug: cluster.slug,
        title: cluster.title,
        introduction: cluster.introduction,
        primaryTopics: cluster.primaryTopics,
        categorySlugs: cluster.categorySlugs,
        seoTitle: cluster.seoTitle,
        metaDescription: cluster.metaDescription,
        displayOrder: cluster.displayOrder,
        status: 'DRAFT',
        visible: false,
      },
      update: {},
    })
  }
  revalidatePath('/admin/clusters')
  revalidatePath('/admin/lancering')
}

export async function updateClusterAction(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('clusterId') ?? '')
  await prisma.contentCluster.update({
    where: { id },
    data: {
      title: String(formData.get('title') ?? '').trim().slice(0, 120),
      introduction: String(formData.get('introduction') ?? '').trim().slice(0, 4000),
      seoTitle: String(formData.get('seoTitle') ?? '').trim().slice(0, 70),
      metaDescription: String(formData.get('metaDescription') ?? '').trim().slice(0, 170),
      heroImage: optionalText(formData.get('heroImage'), 500),
      visible: String(formData.get('visible') ?? '') === 'on',
      status: String(formData.get('status') ?? 'DRAFT') === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      minProducts: Number.parseInt(String(formData.get('minProducts') ?? '15'), 10) || 15,
      minEditorialPages: Number.parseInt(String(formData.get('minEditorialPages') ?? '2'), 10) || 2,
      primaryTopics: String(formData.get('primaryTopics') ?? '')
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 20),
      categorySlugs: String(formData.get('categorySlugs') ?? '')
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 20),
    },
  })
  revalidatePath('/admin/clusters')
  revalidatePath('/admin/lancering')
  revalidatePath('/')
}

/**
 * Berekent interne linksuggesties opnieuw. Suggesties worden alleen aangemaakt;
 * zij verschijnen pas op de site na goedkeuring.
 */
export async function refreshLinkSuggestionsAction(): Promise<void> {
  await requireSession()
  const [clusters, pages, products] = await Promise.all([
    prisma.contentCluster.findMany({
      include: { editorialPages: { where: { status: 'PUBLISHED' }, select: { id: true } } },
    }),
    prisma.editorialPage.findMany({
      where: { status: 'PUBLISHED' },
      include: { products: true, cluster: { select: { slug: true } } },
    }),
    prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, slug: true, title: true, primaryCategory: true },
    }),
  ])

  const suggestions = suggestInternalLinks({
    clusters: clusters.map((cluster) => ({
      slug: cluster.slug,
      title: cluster.title,
      categorySlugs: cluster.categorySlugs,
      editorialPageIds: cluster.editorialPages.map((page) => page.id),
    })),
    editorialPages: pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      type: page.type,
      clusterId: page.clusterId,
      clusterSlug: page.cluster?.slug ?? null,
      primaryQuery: page.primaryQuery,
      productIds: page.products.filter((entry) => entry.role === 'SELECTED').map((entry) => entry.productId),
      alternativeProductIds: page.products
        .filter((entry) => entry.role === 'ALTERNATIVE')
        .map((entry) => entry.productId),
      budgetMaxCents: page.budgetMaxCents,
      categorySlugs: [
        ...new Set(
          page.products
            .map((entry) => products.find((product) => product.id === entry.productId))
            .filter((product) => product !== undefined)
            .map((product) => categorySlugForName(product!.primaryCategory)),
        ),
      ],
    })),
    products: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      categorySlug: categorySlugForName(product.primaryCategory),
    })),
  })

  for (const suggestion of suggestions) {
    await prisma.internalLinkSuggestion.upsert({
      where: {
        fromType_fromRef_toType_toRef: {
          fromType: suggestion.from.type,
          fromRef: suggestion.from.ref,
          toType: suggestion.to.type,
          toRef: suggestion.to.ref,
        },
      },
      create: {
        fromType: suggestion.from.type,
        fromRef: suggestion.from.ref,
        toType: suggestion.to.type,
        toRef: suggestion.to.ref,
        anchorText: suggestion.anchorText,
        reason: suggestion.reason,
      },
      // Een bestaande beoordeling blijft staan: een suggestie die is afgewezen
      // komt niet elke dag terug.
      update: { anchorText: suggestion.anchorText, reason: suggestion.reason },
    })
  }
  revalidatePath('/admin/links')
  revalidatePath('/admin/lancering')
}

export async function reviewLinkSuggestionAction(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('suggestionId') ?? '')
  const status = String(formData.get('status') ?? 'APPROVED') === 'REJECTED' ? 'REJECTED' : 'APPROVED'
  const suggestion = await prisma.internalLinkSuggestion.update({
    where: { id },
    data: { status, reviewedAt: new Date() },
  })
  if (suggestion.fromType === 'EDITORIAL_PAGE') revalidatePath(`/gids/${suggestion.fromRef}`)
  revalidatePath('/admin/links')
}

/** Redactiekalender: één regel plannen. */
export async function upsertPlanEntryAction(formData: FormData): Promise<void> {
  await requireSession()
  const id = optionalText(formData.get('entryId'), 40)
  const type = String(formData.get('type') ?? 'PRODUCT') === 'EDITORIAL_PAGE' ? 'EDITORIAL_PAGE' : 'PRODUCT'
  const scheduledRaw = String(formData.get('scheduledFor') ?? '').trim()
  const scheduledFor = scheduledRaw.length > 0 ? new Date(scheduledRaw) : new Date()
  if (Number.isNaN(scheduledFor.getTime())) return

  const date = (value: FormDataEntryValue | null): Date | null => {
    const raw = String(value ?? '').trim()
    if (raw.length === 0) return null
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const data = {
    type: type as 'PRODUCT' | 'EDITORIAL_PAGE',
    title: String(formData.get('title') ?? '').trim().slice(0, 200) || 'Geplande content',
    productId: optionalText(formData.get('productId'), 40),
    editorialPageId: optionalText(formData.get('editorialPageId'), 40),
    clusterId: optionalText(formData.get('clusterId'), 40),
    scheduledFor,
    factCheckDueAt: date(formData.get('factCheckDueAt')),
    priceCheckDueAt: date(formData.get('priceCheckDueAt')),
    season: optionalText(formData.get('season'), 60),
    homepagePlacement: optionalText(formData.get('homepagePlacement'), 60),
    updateReminderAt: date(formData.get('updateReminderAt')),
    republishOnPriceDrop: String(formData.get('republishOnPriceDrop') ?? '') === 'on',
    notes: optionalText(formData.get('notes'), 1000),
  }

  if (id) await prisma.contentPlanEntry.update({ where: { id }, data })
  else await prisma.contentPlanEntry.create({ data })
  revalidatePath('/admin/kalender')
  revalidatePath('/admin/lancering')
}

export async function setPlanEntryStatusAction(formData: FormData): Promise<void> {
  await requireSession()
  const id = String(formData.get('entryId') ?? '')
  const status = z
    .enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
    .parse(String(formData.get('status') ?? 'PLANNED'))
  await prisma.contentPlanEntry.update({ where: { id }, data: { status } })
  revalidatePath('/admin/kalender')
}

/**
 * Batchimport van briefs. Maakt altijd concepten: met een datum `SCHEDULED`,
 * zonder datum `DRAFT`. Nooit direct gepubliceerd.
 */
export async function importBriefsAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const csv = String(formData.get('csv') ?? '')
  if (csv.trim().length === 0) return { ok: false, message: 'Plak eerst een CSV met briefs.' }

  const { briefs, errors } = parseEditorialBriefs(csv)
  let created = 0
  const skipped: string[] = []

  const candidates = await overlapCandidates(prisma)
  for (const brief of briefs) {
    const overlap = checkOverlap(
      {
        id: 'nieuw',
        slug: 'nieuw',
        title: brief.workingTitle,
        primaryQuery: brief.primaryQuery,
        productIds: brief.selectedProductIds,
        introduction: '',
      },
      candidates,
    )
    if (overlap.level === 'block') {
      skipped.push(`${brief.workingTitle}: ${overlap.reasons.join('; ')} (voorstel: ${overlap.recommendation})`)
      continue
    }

    const briefType = brief.pageType as EditorialPageType
    const archetype = archetypeFor(briefType)
    const page = await prisma.editorialPage.create({
      data: {
        type: briefType,
        title: brief.workingTitle,
        slug: await uniqueSlug(slugFromTitle(brief.workingTitle)),
        primaryQuery: brief.primaryQuery,
        searchIntent: brief.searchIntent ?? archetype.defaultIntent,
        audience: brief.audience ?? null,
        useCase: brief.useCase ?? null,
        budgetMinCents: brief.budgetMinCents,
        budgetMaxCents: brief.budgetMaxCents,
        introduction: '',
        seoTitle: brief.workingTitle.slice(0, 60),
        metaDescription: '',
        reviewerNotes: brief.notes ?? null,
        // Plannen mag, publiceren niet: een import zet nooit iets live.
        status: brief.scheduledPublishAt ? 'SCHEDULED' : 'DRAFT',
        scheduledPublishAt: brief.scheduledPublishAt,
        featuredProductId: brief.featuredProductId ?? null,
      },
    })

    // Alleen bestaande producten koppelen; een onbekend id wordt overgeslagen.
    const known = await prisma.product.findMany({
      where: { id: { in: brief.selectedProductIds } },
      select: { id: true },
    })
    await prisma.editorialPageProduct.createMany({
      data: known.map((product, index) => ({
        editorialPageId: page.id,
        productId: product.id,
        role: 'SELECTED' as const,
        position: index,
      })),
      skipDuplicates: true,
    })
    if (known.length < brief.selectedProductIds.length) {
      skipped.push(
        `${brief.workingTitle}: ${brief.selectedProductIds.length - known.length} onbekend(e) product-id('s) overgeslagen`,
      )
    }

    // Criteria uit de brief moeten in de bibliotheek staan; wij verzinnen geen
    // uitleg bij een onbekend criterium.
    const criteria = await prisma.comparisonCriterion.findMany({
      where: { OR: brief.comparisonCriteria.map((name) => ({ name })) },
    })
    await prisma.editorialPageCriterion.createMany({
      data: criteria.map((criterion, index) => ({
        editorialPageId: page.id,
        criterionName: criterion.name,
        displayOrder: index,
      })),
      skipDuplicates: true,
    })
    const missingCriteria = brief.comparisonCriteria.filter(
      (name) => !criteria.some((criterion) => criterion.name === name),
    )
    if (missingCriteria.length > 0) {
      skipped.push(`${brief.workingTitle}: onbekende criteria ${missingCriteria.join(', ')}`)
    }

    if (brief.scheduledPublishAt) {
      await prisma.contentPlanEntry.create({
        data: {
          type: 'EDITORIAL_PAGE',
          title: brief.workingTitle,
          editorialPageId: page.id,
          scheduledFor: brief.scheduledPublishAt,
          factCheckDueAt: brief.scheduledPublishAt,
          notes: brief.notes ?? null,
        },
      })
    }

    await refreshIndexability(prisma, page.id)
    created += 1
  }

  revalidateEditorial()
  const parts = [`${created} brief(s) als concept aangemaakt.`]
  if (errors.length > 0) parts.push(`${errors.length} regel(s) met fouten: ${errors.slice(0, 3).map((error) => `regel ${error.line} — ${error.message}`).join(' | ')}`)
  if (skipped.length > 0) parts.push(`Let op: ${skipped.slice(0, 3).join(' | ')}`)
  return { ok: created > 0, message: parts.join(' ') }
}

/**
 * Batchimport van producten. Nieuwe producten komen als `CANDIDATE` binnen met
 * `imageStatus = PENDING`: de afbeeldingsvalidatie en een mens beslissen daarna.
 * De slug van een bestaand product blijft ongewijzigd.
 */
export async function importProductsAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const csv = String(formData.get('csv') ?? '')
  if (csv.trim().length === 0) return { ok: false, message: 'Plak eerst een CSV met producten.' }

  const { rows, errors } = parseProductImport(csv)
  const { importCsvRows } = await import('@/jobs/lib/import-products')
  const summary = await importCsvRows(prisma, rows)

  revalidatePath('/admin/producten')
  revalidatePath('/admin/lancering')
  const parts = [
    `${summary.created} nieuw, ${summary.updated} bijgewerkt, ${summary.skipped} overgeslagen.`,
    'Nieuwe producten staan op CANDIDATE met een nog te controleren afbeelding.',
  ]
  if (errors.length > 0) {
    parts.push(
      `${errors.length} regel(s) met fouten: ${errors
        .slice(0, 3)
        .map((error) => `regel ${error.line} — ${error.message}`)
        .join(' | ')}`,
    )
  }
  if (summary.problems.length > 0) parts.push(summary.problems.slice(0, 3).join(' | '))
  return { ok: summary.created + summary.updated > 0, message: parts.join(' ') }
}

/** Bulkacties op geselecteerde pagina's. Publiceren zit hier bewust niet bij. */
export async function bulkEditorialAction(
  _state: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  await requireSession()
  const ids = formData.getAll('pageIds').map((value) => String(value))
  const action = String(formData.get('bulkAction') ?? '')
  if (ids.length === 0) return { ok: false, message: 'Selecteer eerst pagina&apos;s.' }

  if (action === 'schedule') {
    const raw = String(formData.get('scheduledPublishAt') ?? '').trim()
    const date = raw.length > 0 ? new Date(raw) : null
    if (!date || Number.isNaN(date.getTime())) return { ok: false, message: 'Kies een geldige datum.' }
    await prisma.editorialPage.updateMany({
      where: { id: { in: ids }, reviewedAt: { not: null } },
      data: { status: 'SCHEDULED', scheduledPublishAt: date },
    })
    const withoutReview = await prisma.editorialPage.count({
      where: { id: { in: ids }, reviewedAt: null },
    })
    revalidateEditorial()
    return {
      ok: true,
      message: `Ingeplant.${withoutReview > 0 ? ` ${withoutReview} pagina('s) zonder afgeronde review zijn overgeslagen.` : ''}`,
    }
  }

  if (action === 'factCheck') {
    await prisma.editorialPage.updateMany({
      where: { id: { in: ids } },
      data: { lastFactCheckedAt: new Date() },
    })
    for (const id of ids) await refreshIndexability(prisma, id)
    revalidateEditorial()
    return { ok: true, message: `${ids.length} pagina('s) op fact-checked gezet.` }
  }

  if (action === 'draft') {
    let created = 0
    const failed: string[] = []
    for (const id of ids) {
      const state = await generateDraftAction(null, formDataWith({ pageId: id }))
      if (state?.ok) created += 1
      else failed.push(state?.message ?? 'onbekende fout')
    }
    revalidateEditorial()
    return {
      ok: created > 0,
      message: `${created} concept(en) gemaakt; alle betrokken pagina's staan op NEEDS_REVIEW.${
        failed.length > 0 ? ` ${failed.length} mislukt: ${failed.slice(0, 2).join(' | ')}` : ''
      }`,
    }
  }

  if (action === 'archive') {
    await prisma.editorialPage.updateMany({ where: { id: { in: ids } }, data: { status: 'ARCHIVED' } })
    for (const id of ids) await refreshIndexability(prisma, id)
    revalidateEditorial()
    return { ok: true, message: `${ids.length} pagina('s) gearchiveerd.` }
  }

  return { ok: false, message: 'Onbekende bulkactie.' }
}

/** Kleine helper zodat een bulkactie de losse actie kan hergebruiken. */
function formDataWith(values: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.append(key, value)
  return data
}
