import type { PrismaClient } from '@prisma/client'
import { clusterSeeds } from '@/lib/editorial/clusters'
import { categoryNamesFor } from '@/lib/database/editorial-queries'
import { publicProductFilter } from '@/lib/products/visibility'
import { launchProductTarget, launchTargets, type LaunchTarget } from '@/lib/launch/catalogue'

/**
 * Het launchrapport: wat er werkelijk publiek staat, geteld met dezelfde filter
 * als de site zelf. Los van de configuratie gehouden, omdat alleen dit deel de
 * database nodig heeft.
 */
export type LaunchClusterReport = LaunchTarget & {
  /** Publiek zichtbare producten in de categorieën van dit cluster. */
  visible: number
  /** Zichtbare producten met een actieve aanbieding met van-prijs. */
  deals: number
  /** Zichtbare producten zonder van-prijs. */
  discovery: number
  /** Zichtbare producten met een handmatig gecontroleerde prijs. */
  manualPrices: number
  missing: number
}

export type LaunchCatalogueReport = {
  clusters: LaunchClusterReport[]
  totals: {
    target: number
    visible: number
    deals: number
    discovery: number
    manualPrices: number
    validImages: number
    fromOpenIcecat: number
  }
}

/**
 * Telt wat er werkelijk publiek staat, met dezelfde filter als de site zelf.
 * Een product hoort bij een cluster via de categorieën van dat cluster; een
 * product kan dus in twee clusters meetellen wanneer die een categorie delen.
 */
export async function launchCatalogueReport(prisma: PrismaClient): Promise<LaunchCatalogueReport> {
  const clusters: LaunchClusterReport[] = []
  const bySlug = new Map(clusterSeeds.map((cluster) => [cluster.slug, cluster]))

  for (const target of launchTargets) {
    const seed = bySlug.get(target.clusterSlug)
    const categories = categoryNamesFor(seed?.categorySlugs ?? [])
    const products = await prisma.product.findMany({
      where: publicProductFilter({ primaryCategory: { in: categories } }),
      select: {
        offers: {
          select: { referencePrice: true, priceCheckMethod: true, merchant: { select: { enabled: true } } },
        },
      },
    })

    let deals = 0
    let manualPrices = 0
    for (const product of products) {
      const offers = product.offers.filter((offer) => offer.merchant.enabled)
      if (offers.some((offer) => offer.referencePrice !== null)) deals += 1
      if (offers.some((offer) => offer.priceCheckMethod === 'MANUAL')) manualPrices += 1
    }

    clusters.push({
      ...target,
      visible: products.length,
      deals,
      discovery: products.length - deals,
      manualPrices,
      missing: Math.max(0, target.products - products.length),
    })
  }

  const [visible, validImages, fromOpenIcecat, manualOffers, dealProducts] = await Promise.all([
    prisma.product.count({ where: publicProductFilter() }),
    prisma.product.count({ where: { ...publicProductFilter(), imageStatus: 'VALID' } }),
    prisma.product.count({ where: { ...publicProductFilter(), dataSource: 'open-icecat' } }),
    prisma.offer.count({ where: { priceCheckMethod: 'MANUAL' } }),
    prisma.product.count({
      where: { ...publicProductFilter(), offers: { some: { referencePrice: { not: null } } } },
    }),
  ])

  return {
    clusters,
    totals: {
      target: launchProductTarget,
      visible,
      deals: dealProducts,
      discovery: visible - dealProducts,
      manualPrices: manualOffers,
      validImages,
      fromOpenIcecat,
    },
  }
}
