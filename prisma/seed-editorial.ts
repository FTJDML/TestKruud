import '../src/lib/load-env'
import { prisma } from '../src/lib/database/client'
import { clusterSeeds } from '../src/lib/editorial/clusters'
import { comparisonCriteriaSeeds } from '../src/lib/editorial/criteria'

/**
 * Seed voor de redactionele structuur: de zes contentclusters en de bibliotheek
 * met vergelijkingscriteria.
 *
 * Dit is structuur, geen inhoud. Er worden **geen** producten, prijzen,
 * afbeeldingen, criteriumwaarden of redactionele pagina's aangemaakt: die komen
 * uit gecontroleerde brondata en van de redactie. Clusters komen als concept en
 * onzichtbaar binnen; de redactie zet ze zelf aan zodra er genoeg op staat.
 */
async function main(): Promise<void> {
  let clusters = 0
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
        // Onzichtbaar en concept: een leeg cluster hoort niet in de navigatie.
        status: 'DRAFT',
        visible: false,
      },
      // Bestaande clusters niet overschrijven: de redactie heeft ze mogelijk
      // aangepast.
      update: {},
    })
    clusters += 1
  }

  let criteria = 0
  for (const criterion of comparisonCriteriaSeeds) {
    await prisma.comparisonCriterion.upsert({
      where: { name: criterion.name },
      create: criterion,
      update: {
        label: criterion.label,
        explanation: criterion.explanation,
        unit: criterion.unit,
        valueType: criterion.valueType,
        higherIsBetter: criterion.higherIsBetter,
        sourceRequired: criterion.sourceRequired,
        displayOrder: criterion.displayOrder,
      },
    })
    criteria += 1
  }

  console.info(
    `${clusters} clusters klaargezet (concept, onzichtbaar) en ${criteria} vergelijkingscriteria in de bibliotheek.`,
  )
  console.info(
    'Er zijn geen producten, prijzen of redactionele pagina’s aangemaakt: die komen uit brondata en van de redactie.',
  )
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
