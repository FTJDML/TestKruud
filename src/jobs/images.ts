import '@/lib/load-env'
import { prisma } from '@/lib/database/client'
import { assertProductionEnv, serverEnv } from '@/lib/env'
import { runImageHealthCheck, validatePendingImages } from '@/jobs/lib/images'

/**
 * `pnpm job:images` — controleert afbeeldingen.
 *
 * Zonder vlag: nieuwe en gewijzigde afbeeldingen valideren.
 * Met `--health`: ook de afbeeldingen van gepubliceerde producten opnieuw
 * controleren (de dagelijkse image-health).
 * Met `--all`: die controle voor álle gepubliceerde producten, ook wanneer zij
 * vandaag al gecontroleerd zijn. Nodig wanneer een bron zijn afbeeldingen heeft
 * verplaatst: dan wil je niet een dag wachten voordat de site dat weet.
 */
async function main(): Promise<void> {
  assertProductionEnv()
  const minDimension = serverEnv().IMAGE_MIN_DIMENSION
  const all = process.argv.includes('--all')
  const pending = await validatePendingImages(prisma, { minDimension })
  const health =
    process.argv.includes('--health') || all
      ? await runImageHealthCheck(prisma, {
          minDimension,
          ...(all ? { intervalHours: 0, limit: 1000 } : {}),
        })
      : null
  console.info(JSON.stringify({ pending, health }))
  await prisma.$disconnect()
}

main().catch(async (error: unknown) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
