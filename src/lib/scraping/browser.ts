import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * Optionele browserfetch voor bronnen die JavaScript nodig hebben. Staat
 * standaard uit (SCRAPER_ALLOW_BROWSER) en gebruikt een gewone Playwright-
 * Chromium met onze eigen user-agent. Er wordt geen stealthmodus gebruikt,
 * geen anti-botbeveiliging omzeild en geen CAPTCHA opgelost.
 *
 * Playwright is een devDependency; de import is daarom dynamisch zodat de
 * productiebuild niet faalt wanneer het pakket ontbreekt.
 */
export async function fetchRenderedHtml(url: string): Promise<string> {
  const env = serverEnv()
  if (!env.SCRAPER_ALLOW_BROWSER) {
    throw new Error(
      'Browserfetch staat uit. Zet SCRAPER_ALLOW_BROWSER=true voor bronnen die JavaScript nodig hebben.',
    )
  }

  const playwright = await import('@playwright/test').catch(() => null)
  if (!playwright) {
    throw new Error('Playwright is niet geïnstalleerd; installeer @playwright/test om deze bron te lezen.')
  }
  const { chromium } = playwright

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ userAgent: env.SCRAPER_USER_AGENT })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: env.SCRAPER_TIMEOUT_MS })
    const html = await page.content()
    logger.info('Pagina gerenderd met browser', { url, bytes: html.length })
    return html
  } finally {
    await browser.close()
  }
}
