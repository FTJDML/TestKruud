import type { Prisma, PrismaClient } from '@prisma/client'
import { providerForProduct } from '@/lib/ai'
import { chooseOpeningStyle } from '@/lib/ai/style/openings'
import { informalOpeningBudget } from '@/lib/ai/style/voice'
import { validateEditorialContent } from '@/lib/ai/schema'
import {
  factsFingerprint,
  type DataSourceLabel,
  type PriceAnalysisFacts,
  type ProductFacts,
} from '@/lib/ai/provider'
import { analysisFromRecord } from '@/lib/analysis/from-record'
import { priceStatements } from '@/lib/analysis/statements'
import { toCents } from '@/lib/pricing/money'
import { errorMessage, logger } from '@/lib/logger'

export type ContentSummary = {
  generated: number
  skipped: number
  needsReview: number
  /** Content die de kwaliteitspoort niet haalde en dus niet is opgeslagen. */
  blocked: number
  failed: number
}

function toSpecifications(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const output: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') output[key] = entry
    else if (typeof entry === 'number' || typeof entry === 'boolean') output[key] = String(entry)
  }
  return output
}

/**
 * Genereert redactionele content voor producten die er nog geen hebben of
 * waarvan belangrijke productfeiten zijn gewijzigd. Nooit iedere dag opnieuw
 * zonder reden, en nooit tijdens een paginaweergave.
 */
export async function generateMissingContent(
  prisma: PrismaClient,
  options: { limit?: number; force?: boolean } = {},
): Promise<ContentSummary> {
  const summary: ContentSummary = { generated: 0, skipped: 0, needsReview: 0, blocked: 0, failed: 0 }

  // Recente openingen, nieuwste eerst: hiermee voorkomen wij dat dezelfde stijl
  // of dezelfde openingszin zich blijft herhalen.
  const recent = await prisma.editorialContent.findMany({
    orderBy: { generatedAt: 'desc' },
    take: 20,
    select: { openingStyle: true, openingHash: true, closingHash: true },
  })
  // Rolling historie: de stijlen uit de database, en tijdens deze run vullen wij
  // hem aan met wat wij zelf kiezen. Anders zou één run twintig keer dezelfde
  // opening kunnen opleveren.
  const recentStyles = recent
    .map((entry) => entry.openingStyle)
    .filter((style): style is NonNullable<typeof style> => style !== null)

  const products = await prisma.product.findMany({
    where: { status: { in: ['CANDIDATE', 'DRAFT', 'NEEDS_REVIEW', 'PUBLISHED'] } },
    include: {
      editorial: true,
      analysis: true,
      offers: {
        orderBy: { currentPrice: 'asc' },
        include: { merchant: { select: { name: true, sourceType: true, enabled: true } } },
      },
    },
    take: options.limit,
  })

  // Vergelijkbare producten die wij zelf volgen; alleen titels, per categorie.
  const titlesByCategory = new Map<string, string[]>()
  for (const product of products) {
    const list = titlesByCategory.get(product.primaryCategory) ?? []
    list.push(product.title)
    titlesByCategory.set(product.primaryCategory, list)
  }

  for (const product of products) {
    const usableOffers = product.offers.filter((entry) => entry.merchant.enabled)
    const offer = usableOffers[0]
    const specifications = toSpecifications(product.specifications)

    // Eigen prijsanalyse als kant-en-klare zinnen. De provider rekent niets uit.
    const analysis = product.analysis ? analysisFromRecord(product.analysis) : null
    const priceAnalysis: PriceAnalysisFacts | null = analysis
      ? {
          numberOfObservedPrices: analysis.numberOfObservedPrices,
          historyDays: analysis.historyDays,
          statements: priceStatements(analysis).map((statement) => statement.text),
          hasPriceDrop: (analysis.priceChangeAmountCents ?? 0) < 0,
          numberOfComparedMerchants: analysis.numberOfComparedMerchants,
          differenceToNextMerchantCents: analysis.differenceToNextMerchantCents,
        }
      : null

    const sources = new Set<DataSourceLabel>()
    for (const entry of usableOffers) {
      if (entry.merchant.sourceType === 'FIXTURE') sources.add('demo-fixture')
      else if (entry.merchant.sourceType === 'API') sources.add('merchant-api')
      else sources.add('merchant-feed')
    }
    if (analysis && analysis.numberOfObservedPrices > 1) sources.add('eigen-prijsmeting')

    // Aandachtspunten uit brondata; nooit verzonnen. Een feed die "let op" of
    // "aandachtspunt" als specificatie meelevert, komt hier terecht.
    const knownCons = Object.entries(specifications)
      .filter(([key]) => /let op|aandachtspunt|nadeel/i.test(key))
      .map(([key, value]) => `${key}: ${value}`)
    const knownPros = Object.entries(specifications)
      .filter(([key]) => /voordeel|pluspunt/i.test(key))
      .map(([key, value]) => `${key}: ${value}`)

    const facts: ProductFacts = {
      title: product.title,
      brand: product.brand,
      model: product.model,
      primaryCategory: product.primaryCategory,
      shortSourceDescription: product.shortSourceDescription,
      specifications,
      merchantName: offer?.merchant.name ?? 'de aanbieder',
      currentPriceCents: offer ? (toCents(offer.currentPrice) ?? 0) : 0,
      isDemo: product.isDemo,
      priceAnalysis,
      merchantCount: new Set(usableOffers.map((entry) => entry.merchantId)).size,
      dataSources: [...sources],
      lastCheckedAt: offer?.checkedAt ?? null,
      knownPros,
      knownCons,
      comparableAlternatives: (titlesByCategory.get(product.primaryCategory) ?? [])
        .filter((title) => title !== product.title)
        .slice(0, 3),
      experienceType: product.experienceType,
      key: product.slug,
      recentOpeningStyles: recentStyles,
      recentOpeningHashes: recent.map((entry) => ({
        openingHash: entry.openingHash,
        closingHash: entry.closingHash,
      })),
    }

    // Openingsstijl en het informele budget staan vast vóór de generatie, zodat
    // elke provider zich aan dezelfde keuze houdt.
    facts.openingStyle = chooseOpeningStyle({
      key: product.slug,
      contentType: priceAnalysis?.hasPriceDrop
        ? 'DEAL'
        : product.primaryCategory === 'Onnodig Maar Geweldig'
          ? 'DISCOVERY'
          : product.primaryCategory === 'Cadeaus'
            ? 'GIFT_GUIDE'
            : product.primaryCategory === 'Wonen & Design'
              ? 'DESIGN_COLLECTION'
              : 'GENERIC',
      hasMeasuredPriceDrop: priceAnalysis?.hasPriceDrop ?? false,
      hasKnownProblem: knownCons.length > 0,
      isGift: product.primaryCategory === 'Cadeaus',
      isDesignLed: product.primaryCategory === 'Wonen & Design',
      isUnusual: product.primaryCategory === 'Onnodig Maar Geweldig',
      recentStyles,
    })
    facts.allowInformalOpening = informalOpeningBudget(product.slug)
    // Nieuwste vooraan, zodat de volgende iteratie deze keuze meeneemt.
    recentStyles.unshift(facts.openingStyle)
    recentStyles.length = Math.min(recentStyles.length, 20)

    const fingerprint = factsFingerprint(facts)

    if (
      !options.force &&
      product.editorial &&
      product.editorial.sourceFactsHash === fingerprint
    ) {
      summary.skipped += 1
      continue
    }

    try {
      const provider = providerForProduct(facts)
      const result = await provider.generate(facts)
      const content = result.content

      // Duidelijk slechte of lege content wordt niet opgeslagen. Het product
      // gaat naar NEEDS_REVIEW en bestaande content blijft ongemoeid.
      const validation = validateEditorialContent(content, { experienceType: product.experienceType })
      if (!validation.ok) {
        summary.blocked += 1
        logger.warn('Content geblokkeerd door de kwaliteitspoort', {
          product: product.slug,
          provider: result.provider,
          reasons: validation.reasons,
        })
        await prisma.product.update({
          where: { id: product.id },
          data: { status: 'NEEDS_REVIEW' },
        })
        continue
      }

      await prisma.$transaction([
        prisma.editorialContent.upsert({
          where: { productId: product.id },
          create: {
            productId: product.id,
            headline: content.headline,
            teaser: content.teaser,
            longDescription: content.longDescription,
            whyItStandsOut: content.whyItStandsOut,
            bestFor: content.bestFor as Prisma.InputJsonValue,
            caveat: content.caveat,
            seoTitle: content.seoTitle,
            metaDescription: content.metaDescription,
            tags: content.tags as Prisma.InputJsonValue,
            promptVersion: result.promptVersion,
            aiProvider: result.provider,
            sourceFactsHash: fingerprint,
            analysisVersion: analysis?.analysisVersion ?? null,
            generationProvider: result.provider,
            generationModel: result.model ?? null,
            generationWarnings: result.warnings as Prisma.InputJsonValue,
            evidenceSummary: result.evidenceSummary ?? null,
            experienceType: product.experienceType,
            openingStyle: result.openingStyle ?? null,
            openingHash: result.openingHash ?? null,
            closingHash: result.closingHash ?? null,
            styleVersion: result.styleVersion ?? null,
            styleWarnings: (result.styleWarnings ?? []) as Prisma.InputJsonValue,
            generatedAt: new Date(),
            reviewedAt: result.needsReview ? null : new Date(),
            // Machinegegenereerde tekst wordt pas indexeerbaar na een menselijke
            // controle; een nieuwe generatie zet die controle terug.
            humanReviewedAt: null,
            humanEdited: false,
          },
          update: {
            headline: content.headline,
            teaser: content.teaser,
            longDescription: content.longDescription,
            whyItStandsOut: content.whyItStandsOut,
            bestFor: content.bestFor as Prisma.InputJsonValue,
            caveat: content.caveat,
            seoTitle: content.seoTitle,
            metaDescription: content.metaDescription,
            tags: content.tags as Prisma.InputJsonValue,
            promptVersion: result.promptVersion,
            aiProvider: result.provider,
            sourceFactsHash: fingerprint,
            analysisVersion: analysis?.analysisVersion ?? null,
            generationProvider: result.provider,
            generationModel: result.model ?? null,
            generationWarnings: result.warnings as Prisma.InputJsonValue,
            evidenceSummary: result.evidenceSummary ?? null,
            experienceType: product.experienceType,
            openingStyle: result.openingStyle ?? null,
            openingHash: result.openingHash ?? null,
            closingHash: result.closingHash ?? null,
            styleVersion: result.styleVersion ?? null,
            styleWarnings: (result.styleWarnings ?? []) as Prisma.InputJsonValue,
            generatedAt: new Date(),
            reviewedAt: result.needsReview ? null : new Date(),
            humanReviewedAt: null,
            humanEdited: false,
          },
        }),
        prisma.product.update({
          where: { id: product.id },
          data: {
            uniquenessScore: content.uniquenessScore,
            storyScore: content.storyScore,
            usefulnessScore: content.usefulnessScore,
            giftabilityScore: content.giftabilityScore,
            // Een gepubliceerd product blijft gepubliceerd; nieuwe content die
            // review nodig heeft komt op NEEDS_REVIEW.
            status:
              product.status === 'PUBLISHED'
                ? 'PUBLISHED'
                : result.needsReview
                  ? 'NEEDS_REVIEW'
                  : 'DRAFT',
          },
        }),
      ])

      summary.generated += 1
      if (result.needsReview) summary.needsReview += 1
      if (result.warnings.length > 0 || (result.styleWarnings ?? []).length > 0) {
        logger.warn('Contentwaarschuwingen', {
          product: product.slug,
          warnings: result.warnings,
          style: result.styleWarnings ?? [],
        })
      }
    } catch (error) {
      summary.failed += 1
      // Een mislukte generatie laat bestaande content ongemoeid.
      logger.error('Contentgeneratie mislukt', { product: product.slug, reason: errorMessage(error) })
    }
  }

  return summary
}
