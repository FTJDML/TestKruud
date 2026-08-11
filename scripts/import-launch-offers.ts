import '../src/lib/load-env'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { prisma } from '../src/lib/database/client'
import { isProductionEnv } from '../src/lib/env'
import { parseLaunchOffers } from '../src/lib/csv/launch-offers'
import { importLaunchOffers } from '../src/jobs/lib/import-launch'
import { STALE_AFTER_MS } from '../src/lib/pricing/deal'

/**
 * Importeert handmatig gecontroleerde aanbiedingen bij bestaande producten.
 *
 * Eén rij per winkel en product: gewone winkel-URL, prijs, eventuele van-prijs
 * met haar type, voorraad en het moment waarop jij het hebt nagekeken. Zonder
 * controlemoment wordt de rij geweigerd, en een van-prijs die niet hoger is dan
 * de actuele prijs ook: dan valt er geen korting te tonen.
 *
 * Gebruik:
 *
 *   pnpm launch:offers --file data/launch-offers.csv
 *   pnpm launch:offers --file data/launch-offers.csv --dry-run
 */
const args = process.argv.slice(2)

function arg(name: string): string | null {
  const index = args.indexOf(`--${name}`)
  const value = index >= 0 ? args[index + 1] : undefined
  return value && !value.startsWith('--') ? value : null
}

async function main(): Promise<void> {
  if (isProductionEnv()) {
    console.error('Deze import hoort in een acceptatie- of stagingomgeving, niet in productie.')
    process.exitCode = 1
    return
  }

  const file = arg('file')
  if (!file) {
    console.error('Geef --file <pad> naar een CSV. Sjabloon: templates/launch-offers.csv')
    process.exitCode = 1
    return
  }

  const { rows, errors } = parseLaunchOffers(await readFile(resolve(file), 'utf8'))
  console.info(`${rows.length} bruikbare rijen, ${errors.length} geweigerd.`)
  for (const error of errors.slice(0, 10)) console.warn(`  regel ${error.line}: ${error.message}`)

  const now = Date.now()
  const stale = rows.filter((row) => now - row.priceCheckedAt.getTime() > STALE_AFTER_MS)
  if (stale.length > 0) {
    console.warn(
      `${stale.length} rij(en) hebben een controlemoment van meer dan een etmaal oud. Die prijzen tonen wij niet als actieve aanbieding; controleer ze opnieuw voordat je publiceert.`,
    )
  }

  if (args.includes('--dry-run')) {
    console.info('Droogloop: er is niets opgeslagen.')
    return
  }

  const summary = await importLaunchOffers(prisma, rows)
  console.info(
    `${summary.created} nieuw, ${summary.updated} bijgewerkt, ${summary.skipped} overgeslagen. ${summary.deals} rij(en) met een van-prijs.`,
  )
  for (const problem of summary.problems.slice(0, 10)) console.warn(`  ${problem}`)
  console.info('Volgende stap: pnpm job:daily, zodat prijsanalyse en editie de nieuwe prijzen meenemen.')
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
