import '../src/lib/load-env'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import sharp from 'sharp'
import { prisma } from '../src/lib/database/client'
import { isProductionEnv } from '../src/lib/env'
import { parseOpenIcecatExport, type CatalogProduct } from '../src/merchants/adapters/open-icecat'
import { launchCategoryRules } from '../src/lib/launch/catalogue'
import { importCatalogProducts } from '../src/jobs/lib/import-launch'
import { launchCatalogueReport } from '../src/lib/launch/report'

/**
 * Importeert een Open Icecat-export als catalogusproducten.
 *
 * Dit script haalt geen webshop leeg: het leest een export van jouw eigen Open
 * Icecat-account. Prijzen zitten er niet in en worden hier ook niet verzonnen;
 * die komen uit `scripts/import-launch-offers.ts`.
 *
 * Gebruik:
 *
 *   pnpm launch:icecat --file data/open-icecat-export.csv
 *   pnpm launch:icecat --file export.xml --limit 200 --thumbnails
 *   pnpm launch:icecat --url "$OPEN_ICECAT_EXPORT_URL" --format json
 *   pnpm launch:icecat --file export.csv --dry-run
 *
 * Opties:
 *
 *   --file <pad>        lokaal exportbestand (csv, xml of json)
 *   --url <url>         export via HTTP; de sleutel komt uit een
 *                       environment-variabele, niet uit de opdrachtregel
 *   --auth-env <naam>   naam van de variabele met een Bearer-token of
 *                       basic-auth-waarde voor die URL
 *   --format            csv | xml | json (standaard: geraden uit de extensie)
 *   --limit <n>         maximaal aantal producten
 *   --mapping <pad>     JSON met eigen veldnamen, wanneer jouw export afwijkt
 *   --usage-basis <t>   verklaring waarop het gebruik van de assets rust, voor
 *                       exports zonder eigen gebruikskolom
 *   --thumbnails        maak lokale webp-thumbnails in public/catalog
 *   --dry-run           alleen tellen en rapporteren, niets opslaan
 */
const args = process.argv.slice(2)

function arg(name: string): string | null {
  const index = args.indexOf(`--${name}`)
  const value = index >= 0 ? args[index + 1] : undefined
  return value && !value.startsWith('--') ? value : null
}

function flag(name: string): boolean {
  return args.includes(`--${name}`)
}

function guessFormat(path: string): 'csv' | 'xml' | 'json' {
  const extension = extname(path).toLowerCase()
  if (extension === '.xml') return 'xml'
  if (extension === '.json') return 'json'
  return 'csv'
}

/** Thumbnail voor de staging: kleiner bestand, zelfde afbeelding. */
async function writeThumbnail(product: CatalogProduct): Promise<string | null> {
  try {
    const response = await fetch(product.imageUrl)
    if (!response.ok) return null
    const input = Buffer.from(await response.arrayBuffer())
    const directory = resolve('public/catalog')
    await mkdir(directory, { recursive: true })
    const name = `${(product.ean ?? product.sourceRef).replace(/[^a-z0-9]+/gi, '-')}.webp`
    const output = await sharp(input).resize(900, 900, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    await writeFile(`${directory}/${name}`, output)
    return `/catalog/${name}`
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  if (isProductionEnv()) {
    console.error('Deze import hoort in een acceptatie- of stagingomgeving, niet in productie.')
    process.exitCode = 1
    return
  }

  const file = arg('file')
  const url = arg('url')
  if (!file && !url) {
    console.error('Geef --file <pad> of --url <url>. Zie de kop van dit script voor alle opties.')
    process.exitCode = 1
    return
  }

  let text: string
  if (file) {
    text = await readFile(resolve(file), 'utf8')
  } else {
    const authEnv = arg('auth-env')
    const token = authEnv ? (process.env[authEnv] ?? '') : ''
    if (authEnv && token.length === 0) {
      console.error(`De variabele ${authEnv} is leeg; zonder sleutel wordt er niets opgehaald.`)
      process.exitCode = 1
      return
    }
    const response = await fetch(url!, {
      headers: token.length > 0 ? { authorization: token.startsWith('Basic') ? token : `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      console.error(`De export gaf status ${response.status}.`)
      process.exitCode = 1
      return
    }
    text = await response.text()
  }

  const format = (arg('format') as 'csv' | 'xml' | 'json' | null) ?? guessFormat(file ?? url ?? '')
  const mappingPath = arg('mapping')
  const mapping = mappingPath
    ? (JSON.parse(await readFile(resolve(mappingPath), 'utf8')) as Record<string, unknown>)
    : undefined

  const result = parseOpenIcecatExport(text, {
    format,
    categoryRules: launchCategoryRules,
    ...(mapping ? { mapping } : {}),
    ...(arg('usage-basis') ? { usageBasis: arg('usage-basis')! } : {}),
  })

  const limit = Number.parseInt(arg('limit') ?? '0', 10)
  const selected = limit > 0 ? result.products.slice(0, limit) : result.products

  console.info(`${result.rows} rijen gelezen, ${result.products.length} bruikbaar, ${selected.length} geselecteerd.`)
  const skipped = Object.entries(result.skipped).filter(([, count]) => count > 0)
  if (skipped.length > 0) {
    console.info('Overgeslagen:')
    for (const [reason, count] of skipped) console.info(`  ${count} × ${reason}`)
  }
  for (const warning of result.warnings) console.warn(`Let op: ${warning}`)

  const perCategory = new Map<string, number>()
  for (const product of selected) {
    perCategory.set(product.primaryCategory, (perCategory.get(product.primaryCategory) ?? 0) + 1)
  }
  console.info('Per categorie:')
  for (const [category, count] of [...perCategory.entries()].sort()) {
    console.info(`  ${count.toString().padStart(4)} ${category}`)
  }

  if (flag('dry-run')) {
    console.info('Droogloop: er is niets opgeslagen.')
    return
  }

  if (flag('thumbnails')) {
    let written = 0
    for (const product of selected) {
      const local = await writeThumbnail(product)
      if (local) {
        // De thumbnail vervangt de bron-URL niet; hij komt ernaast te staan en de
        // afbeeldingsvalidatie kijkt naar wat publiek wordt getoond.
        product.imageUrl = local
        written += 1
      }
    }
    console.info(`${written} lokale thumbnails geschreven in public/catalog.`)
  }

  const summary = await importCatalogProducts(prisma, selected, { dataSource: 'open-icecat' })
  console.info(
    `${summary.created} nieuw, ${summary.updated} bijgewerkt, ${summary.skipped} overgeslagen. Nieuwe producten staan op CANDIDATE met een nog te controleren afbeelding.`,
  )
  for (const problem of summary.problems.slice(0, 5)) console.warn(`  ${problem}`)

  const report = await launchCatalogueReport(prisma)
  console.info(
    `\nPubliek zichtbaar: ${report.totals.visible} van ${report.totals.target} (${report.totals.fromOpenIcecat} uit Open Icecat).`,
  )
  console.info('Volgende stappen: pnpm job:images --all, pnpm job:content, pnpm launch:offers, pnpm job:daily.')
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
