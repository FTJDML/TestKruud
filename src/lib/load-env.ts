import { existsSync } from 'node:fs'

/**
 * Next laadt .env zelf; losse jobs die met tsx draaien niet. Deze module wordt
 * als eerste geïmporteerd in job-entrypoints.
 */
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file)
}
