import { existsSync } from 'node:fs'

/**
 * Laadt .env voor tests die een database nodig hebben. Tests zonder database
 * slaan zichzelf over (zie describe.skipIf), zodat `pnpm test` altijd werkt.
 */
for (const file of ['.env.test', '.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file)
    break
  }
}
