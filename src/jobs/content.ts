import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { generateMissingContent } from '@/jobs/lib/content'

/**
 * Entrypoint voor `pnpm job:content [--force]`. Zonder vlag genereert dit
 * alleen content voor producten zonder content of met gewijzigde productfeiten.
 * Met `--force` wordt alles opnieuw gegenereerd, bijvoorbeeld na een wijziging
 * in de tekstsjablonen. Draait nooit tijdens een paginaweergave.
 */
async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const summary = await generateMissingContent(prisma, { force })
  console.info(JSON.stringify({ force, ...summary }))
  await prisma.$disconnect()
}

main().catch(async (error: unknown) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
