import { expect, test } from '@playwright/test'
import { IMAGE_FALLBACK_SRC } from '../../src/components/product/ProductImage'

/**
 * Kapotte afbeeldingen mogen de pagina niet slopen. Wat hier wordt gecontroleerd:
 * de lokale placeholder bestaat, een mislukte afbeelding valt daarop terug zonder
 * layout shift, en de melding aan de server verandert niets aan het product.
 */
test.describe('kapotte afbeeldingen', () => {
  test('de lokale placeholder is bereikbaar', async ({ request }) => {
    const response = await request.get(IMAGE_FALLBACK_SRC)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/svg')
    expect(await response.text()).toContain('Afbeelding niet beschikbaar')
  })

  test('valt terug op de placeholder en houdt dezelfde hoogte', async ({ page }) => {
    // Elke afbeeldingsaanvraag mislukt, behalve de placeholder zelf.
    await page.route('**/*', async (route) => {
      const url = route.request().url()
      const isImageRequest =
        route.request().resourceType() === 'image' || url.includes('/_next/image')
      if (isImageRequest && !url.includes('image-unavailable')) {
        await route.abort()
        return
      }
      await route.continue()
    })

    await page.goto('/')
    const container = page.locator('article').first().locator('div.aspect-square').first()
    await expect(container).toBeVisible()

    const image = container.locator('img').first()
    // De browser valt terug op de lokale placeholder met een aangepaste alt-tekst.
    await expect(image).toHaveAttribute('src', /image-unavailable\.svg/, { timeout: 20_000 })
    await expect(image).toHaveAttribute('alt', /afbeelding niet beschikbaar/i)

    // Vaste verhouding: de container blijft vierkant, dus geen layout shift.
    const box = await container.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThanOrEqual(2)

    // De pagina zelf blijft heel: kop, prijs en CTA staan er nog.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('article').first().getByText(/^€/).first()).toBeVisible()
  })

  test('een productpagina blijft werken zonder afbeelding', async ({ page }) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url()
      const isImageRequest =
        route.request().resourceType() === 'image' || url.includes('/_next/image')
      if (isImageRequest && !url.includes('image-unavailable')) {
        await route.abort()
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await page.locator('article h3 a').first().click()
    await expect(page).toHaveURL(/\/product\//)

    const image = page.locator('img').first()
    await expect(image).toHaveAttribute('src', /image-unavailable\.svg/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Waarom dit opvalt' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Bekijk (deal|product)/ }).first()).toBeVisible()
  })

  test('de melding van een kapotte afbeelding verandert het product niet', async ({ page, request }) => {
    // Zonder same-origin komt de melding er niet in.
    const foreign = await request.post('/api/image-issue', {
      headers: { origin: 'https://kwaadwillend.example', 'content-type': 'application/json' },
      data: { productId: 'p1', reason: 'browser-load-failed' },
    })
    expect(foreign.status()).toBe(403)

    // Met de juiste herkomst: 204 en geen inhoud.
    await page.goto('/')
    const slug = await page.locator('article h3 a').first().getAttribute('href')
    expect(slug).not.toBeNull()

    const accepted = await page.evaluate(async () => {
      const response = await fetch('/api/image-issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: 'onbekend-product', reason: 'browser-load-failed' }),
      })
      return response.status
    })
    expect(accepted).toBe(204)

    // Het product staat er daarna nog gewoon; een melding haalt niets offline.
    const response = await page.goto(slug!)
    expect(response?.status()).toBe(200)
  })
})
