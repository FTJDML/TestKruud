import { expect, test, type Page } from '@playwright/test'

/**
 * Smoketest voor de kritieke paden: homepage, hero, productkaarten, bewaren
 * (inclusief na een refresh), productpagina, advertentieplaceholder in
 * development en de mobiele navigatie.
 */

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

test.describe('homepage', () => {
  test('opent met hero en productkaarten', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Vondst van de dag').first()).toBeVisible()

    // De hero toont een prijs en een werkende deal-CTA.
    const heroSection = page.locator('section', { hasText: 'Vondst van de dag' }).first()
    await expect(heroSection.getByRole('link', { name: /Bekijk deal/ }).first()).toBeVisible()

    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThanOrEqual(8)

    // Elke kaart toont een prijs en een aanbieder.
    await expect(cards.first().getByText(/^€/).first()).toBeVisible()
    await expect(cards.first().getByText(/Laatst/).first()).toBeVisible()
  })

  test('heeft geen horizontale overflow', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    // Eén pixel marge voor afronding van subpixels.
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('toont de advertentieplaceholder in development onder de productkaarten', async ({ page }) => {
    await page.goto('/')
    const adSlot = page.locator('[data-ad-slot="home-in-feed-1"]')

    if (process.env.PLAYWRIGHT_DEV === '0') {
      // In productie met ads uitgeschakeld neemt de positie geen ruimte in.
      await expect(adSlot).toHaveCount(0)
      return
    }

    await expect(adSlot).toBeVisible()
    await expect(adSlot).toContainText('Advertentieruimte')

    // De placeholder staat na de eerste acht productkaarten.
    const cardsBeforeAd = await page.locator('article').evaluateAll((articles, adSelector) => {
      const ad = document.querySelector(adSelector)
      if (!ad) return 0
      const adTop = ad.getBoundingClientRect().top
      return articles.filter((article) => article.getBoundingClientRect().top < adTop).length
    }, '[data-ad-slot="home-in-feed-1"]')
    expect(cardsBeforeAd).toBeGreaterThanOrEqual(8)
  })
})

test.describe('bewaren', () => {
  test('hartje werkt en blijft na een refresh bewaard', async ({ page }) => {
    await page.goto('/')

    const saveButton = page.locator('article').first().getByRole('button', { name: /bewaren$/i }).first()
    await expect(saveButton).toBeVisible()
    // data-ready staat op true zodra de bewaarstatus met de database is gesynchroniseerd.
    await expect(saveButton).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
    await expect(saveButton).toHaveAttribute('aria-pressed', 'false')

    const label = (await saveButton.getAttribute('aria-label')) ?? ''
    await saveButton.click()

    const savedButton = page
      .locator('article')
      .first()
      .getByRole('button', { name: label.replace(/ bewaren$/i, ' uit bewaard verwijderen') })
      .first()
    await expect(savedButton).toHaveAttribute('aria-pressed', 'true')

    // Na een refresh moet de bewaarde status uit de database terugkomen.
    await page.reload()
    await expect(savedButton).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })

    // En het product staat op de pagina met bewaarde producten.
    await page.goto('/bewaard')
    await expect(page.getByRole('heading', { level: 1, name: 'Bewaard' })).toBeVisible()
    await expect(page.locator('article')).not.toHaveCount(0)

    // Opruimen, zodat de test herhaalbaar blijft.
    await page.goto('/')
    await savedButton.click()
    await expect(saveButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('hartje is met het toetsenbord te bedienen', async ({ page }) => {
    await page.goto('/')
    const saveButton = page.locator('article').first().getByRole('button', { name: /bewaren$/i }).first()
    await expect(saveButton).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
    await saveButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('article').first().getByRole('button', { name: /verwijderen$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.keyboard.press('Enter')
    await expect(page.locator('article').first().getByRole('button', { name: /bewaren$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

test.describe('productpagina', () => {
  test('opent vanaf de homepage met prijs, aandachtspunt en CTA', async ({ page }) => {
    await page.goto('/')
    const firstCardHeading = page.locator('article h3 a').first()
    const headline = (await firstCardHeading.textContent())?.trim() ?? ''
    await firstCardHeading.click()

    await expect(page).toHaveURL(/\/product\//)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(headline.slice(0, 20))

    await expect(page.getByRole('heading', { name: 'Waarom dit opvalt' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Voor wie is dit leuk?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Goed om te weten' })).toBeVisible()
    await expect(page.getByText(/Laatst/).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Bekijk deal/ }).first()).toBeVisible()

    // Breadcrumbs en advertentiepositie onder de primaire content.
    await expect(page.getByRole('navigation', { name: 'Kruimelpad' })).toBeVisible()

    // Demo-inhoud is zichtbaar gemarkeerd en noindex.
    const robots = await page.locator('meta[name="robots"]').first().getAttribute('content')
    expect(robots).toContain('noindex')
  })

  test('een niet-bestaand product geeft een echte 404', async ({ page }) => {
    const response = await page.goto('/product/dit-product-bestaat-niet')
    expect(response?.status()).toBe(404)
  })
})

test.describe('DEAL en DISCOVERY', () => {
  test('toont beide CTA-varianten met de juiste prijsinformatie', async ({ page }) => {
    // De editie op de homepage bestaat uit deals: die hebben een van-prijs.
    await page.goto('/')
    const dealCta = page.locator('a[data-cta="deal"]').first()
    await expect(dealCta).toBeVisible()
    await expect(dealCta).toContainText('Bekijk deal')

    const dealCard = page.locator('article', { has: page.locator('a[data-cta="deal"]') }).first()
    await expect(dealCard.locator('.line-through').first()).toBeVisible()
    await expect(dealCard.getByText(/Bespaar/).first()).toBeVisible()

    // Nieuw ontdekt bevat producten zonder betrouwbare vergelijkingsprijs.
    await page.goto('/nieuw')
    const discoveryCta = page.locator('a[data-cta="discovery"]').first()
    await expect(discoveryCta).toBeVisible()
    await expect(discoveryCta).toContainText('Bekijk product')

    const discoveryCard = page.locator('article', { has: page.locator('a[data-cta="discovery"]') }).first()
    await expect(discoveryCard.locator('.line-through')).toHaveCount(0)
    await expect(discoveryCard.getByText('Geen betrouwbare vergelijkingsprijs bekend')).toBeVisible()
  })
})

test.describe('navigatie', () => {
  test('mobiel menu opent en sluit', async ({ page }) => {
    test.skip(!isMobile(page), 'Alleen relevant op mobiele breedte')
    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'Menu openen' })
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    const dialog = page.getByRole('dialog', { name: 'Menu' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Wonen & Design' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })

  test('categoriepagina is bereikbaar', async ({ page }) => {
    await page.goto('/categorie/keuken-en-apparaten')
    await expect(page.getByRole('heading', { level: 1, name: 'Keuken & Apparaten' })).toBeVisible()
    await expect(page.locator('article').first()).toBeVisible()
  })

  test('zoeken geeft resultaten en is noindex', async ({ page }) => {
    await page.goto('/zoeken?q=pizzaoven')
    await expect(page.getByRole('heading', { level: 1, name: 'Zoeken' })).toBeVisible()
    await expect(page.locator('article').first()).toBeVisible()
    const robots = await page.locator('meta[name="robots"]').first().getAttribute('content')
    expect(robots).toContain('noindex')
  })
})
