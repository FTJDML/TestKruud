import '../src/lib/load-env'
import { prisma } from '../src/lib/database/client'
import { launchCatalogueReport } from '../src/lib/launch/report'

/**
 * Laat zien hoe vol de launchcatalogus werkelijk is: per cluster het doel, wat
 * er publiek staat, hoeveel daarvan een deal is en hoeveel prijzen handmatig
 * zijn gecontroleerd. Er wordt niets aangevuld; wat mist, mist.
 *
 *   pnpm launch:report
 */
async function main(): Promise<void> {
  const report = await launchCatalogueReport(prisma)

  console.info('cluster                          doel  zichtbaar  deals  discovery  handmatig  mist')
  for (const cluster of report.clusters) {
    console.info(
      [
        cluster.label.padEnd(32),
        String(cluster.products).padStart(4),
        String(cluster.visible).padStart(10),
        String(cluster.deals).padStart(6),
        String(cluster.discovery).padStart(10),
        String(cluster.manualPrices).padStart(10),
        String(cluster.missing).padStart(5),
      ].join(' '),
    )
  }

  const { totals } = report
  console.info('')
  console.info(`zichtbare producten:        ${totals.visible} van ${totals.target}`)
  console.info(`waarvan uit Open Icecat:    ${totals.fromOpenIcecat}`)
  console.info(`geldige afbeeldingen:       ${totals.validImages}`)
  console.info(`deals (met van-prijs):      ${totals.deals}`)
  console.info(`discovery (zonder korting): ${totals.discovery}`)
  console.info(`handmatige prijscontroles:  ${totals.manualPrices}`)
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
