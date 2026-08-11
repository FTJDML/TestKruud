import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '3100', 10)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`

/**
 * Smoketests draaien standaard tegen `next dev`, omdat de advertentieplaceholder
 * alleen in development zichtbaar is. Zet PLAYWRIGHT_DEV=0 om tegen de
 * productiebuild te testen (`pnpm build` eerst).
 */
const useDevServer = process.env.PLAYWRIGHT_DEV !== '0'

/**
 * Sommige omgevingen leveren een vooraf geïnstalleerde Chromium op een vaste
 * plek. Bestaat die, dan gebruiken we haar in plaats van een download.
 */
const preinstalledChromium = '/opt/pw-browsers/chromium'
const launchOptions = {
  ...(existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {}),
  // Containers die als root draaien hebben de Chromium-sandbox uitgezet nodig.
  ...(process.getuid?.() === 0 ? { args: ['--no-sandbox'] } : {}),
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
    launchOptions,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Mobiele emulatie op 390 x 844 (het kleinste doelformaat) in Chromium,
      // zodat we één browser hoeven te installeren.
      name: 'mobiel',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: useDevServer ? `pnpm dev --port ${port}` : `pnpm start --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
