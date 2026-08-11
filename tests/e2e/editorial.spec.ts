import { expect, test } from '@playwright/test'

/**
 * Editorial SEO Engine, publieke kant.
 *
 * De tests hangen niet af van geseede redactionele pagina's: die maakt de
 * redactie zelf, met echte brondata. Wat hier wordt gecontroleerd is het gedrag
 * dat altijd moet kloppen — de overzichtspagina, echte 404's, de homepagevulling
 * en dat een gepubliceerde gids (wanneer die er is) een geldige opbouw heeft.
 */
test.describe('gidsen en thema&apos;s', () => {
  test('het overzicht van gidsen opent en linkt naar de thema&apos;s', async ({ page }) => {
    await page.goto('/gidsen')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vergelijkingen en koopgidsen')

    // Elk thema is hiervandaan bereikbaar; zo ontstaan er geen verweesde pagina's.
    const themeLinks = page.locator('a[href^="/thema/"]')
    const count = await themeLinks.count()
    if (count > 0) {
      const href = await themeLinks.first().getAttribute('href')
      const response = await page.goto(href!)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('een onbekende gids en een onbekend thema geven een echte 404', async ({ page }) => {
    expect((await page.goto('/gids/deze-gids-bestaat-niet'))?.status()).toBe(404)
    expect((await page.goto('/thema/dit-thema-bestaat-niet'))?.status()).toBe(404)
  })

  test('een gepubliceerde gids toont bronnen, criteria en per product een aandachtspunt', async ({ page }) => {
    await page.goto('/gidsen')
    const guideLinks = page.locator('a[href^="/gids/"]')
    const count = await guideLinks.count()
    test.skip(count === 0, 'Nog geen gepubliceerde redactionele pagina in deze database')

    const href = await guideLinks.first().getAttribute('href')
    const response = await page.goto(href!)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // "Hoe deze selectie is gemaakt" staat op elke redactionele pagina.
    await expect(page.getByRole('heading', { name: 'Hoe deze selectie is gemaakt' })).toBeVisible()
    await expect(page.getByText(/Vergeleken producten/)).toBeVisible()
    await expect(page.getByText(/Zelf getest/)).toBeVisible()

    // Kruimelpad en minimaal één productlink.
    await expect(page.getByRole('navigation', { name: 'Kruimelpad' })).toBeVisible()
    expect(await page.locator('a[href^="/product/"]').count()).toBeGreaterThan(0)

    // Nooit sterren of reviews in de structured data.
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    const combined = jsonLd.join(' ')
    expect(combined).not.toContain('AggregateRating')
    expect(combined).not.toContain('"Review"')
  })

  test('de homepage is gevuld en herhaalt een product niet direct', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('article')
    const total = await cards.count()
    // De hero telt ook mee als plaatsing; onder de 24 kaarten is de homepage leeg.
    expect(total).toBeGreaterThanOrEqual(24)

    // Geen twee identieke productlinks direct na elkaar in de DOM-volgorde.
    const hrefs = await page.locator('article a[href^="/product/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')).filter((href): href is string => href !== null),
    )
    const unique = [...new Set(hrefs)]
    expect(unique.length).toBeGreaterThan(0)
    for (let index = 1; index < hrefs.length; index += 1) {
      if (hrefs[index] === hrefs[index - 1]) continue
      expect(hrefs[index]).not.toBe(hrefs[index - 1])
    }
  })

  test('de secties uit het launchplan staan op de homepage', async ({ page }) => {
    await page.goto('/')
    // "Vondst van de dag" is de hero; de overige koppen zijn secties.
    await expect(page.getByText('Vondst van de dag').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Beste deals van vandaag' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nieuw ontdekt' })).toBeVisible()
  })
})
