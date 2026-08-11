#!/usr/bin/env node
/**
 * Bouwt één zelfstandig HTML-bestand van de draaiende stagingomgeving.
 *
 * Waarom dit bestaat: een Claude-artifact is één statisch HTML-bestand achter
 * een strikte CSP. Daar draait geen Next.js-server en geen PostgreSQL, dus de
 * applicatie zelf kan er niet in staan. In plaats van de architectuur van de
 * applicatie aan te passen, legt dit script de **werkelijk gerenderde pagina's**
 * van de staging vast: dezelfde componenten, dezelfde Tailwind-build, dezelfde
 * fixturedata en dezelfde afbeeldingen.
 *
 * Wat het doet:
 *
 * 1. Het leest de stylesheet van de draaiende server en zet de woff2-fonts als
 *    data-URI in de CSS, zodat er geen externe host meer nodig is.
 * 2. Breedtegebaseerde media queries worden container queries. Daardoor kan de
 *    capture in dezelfde pagina op 1440 en op 390 pixels worden bekeken met de
 *    echte responsive layout, zonder iframe.
 * 3. Het opent elke route in Chromium, ruimt scripts en verwijzingen op en
 *    bewaart de HTML van de body.
 * 4. Elke afbeelding wordt via de eigen server opgehaald en als data-URI
 *    opgenomen. Lukt dat niet, dan verwijst hij naar dezelfde lokale fallback
 *    die de applicatie gebruikt; een gebroken afbeeldingsicoon komt er niet in.
 * 5. Kleine shims vervangen de weggehaalde React-interactie: routering per hash,
 *    de bewaarknop, het mobiele menu en het zoekformulier.
 *
 * Gebruik: node scripts/build-staging-artifact.mjs --base http://localhost:3100
 */

import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const base = arg('base', 'http://localhost:3100').replace(/\/$/, '')
const out = resolve(arg('out', 'staging/homeandlivingdeals-staging.html'))

/** Routes in de volgorde waarin zij in de navigatie van de capture komen. */
const routes = [
  { path: '/', label: 'Homepage', group: 'Hoofdpagina’s' },
  { path: '/categorieen', label: 'Alle categorieën', group: 'Hoofdpagina’s' },
  { path: '/nieuw', label: 'Nieuw ontdekt', group: 'Hoofdpagina’s' },
  { path: '/gidsen', label: 'Vergelijkingen en gidsen', group: 'Hoofdpagina’s' },

  { path: '/categorie/wonen-en-design', label: 'Wonen & Design', group: 'Categorieën' },
  { path: '/categorie/keuken-en-apparaten', label: 'Keuken & Apparaten', group: 'Categorieën' },
  { path: '/categorie/speelgoed-en-hobby', label: 'Speelgoed & Hobby', group: 'Categorieën' },
  { path: '/categorie/smart-home-en-tech', label: 'Smart Home & Tech', group: 'Categorieën' },

  {
    path: '/product/nocta-bijzettafel-met-ingebouwde-koeling',
    label: 'Productpagina met deal',
    group: 'Producten',
  },
  {
    path: '/product/two-seat-sofa',
    label: 'Productpagina zonder deal (discovery)',
    group: 'Producten',
  },
  {
    path: '/product/sterrenwacht-bouwset-mechanisch-planetarium',
    label: 'Product in een vergelijking',
    group: 'Producten',
  },
  {
    path: '/product/nimbus-wolkenlamp-met-bliksemeffect',
    label: 'Product zonder van-prijs',
    group: 'Producten',
  },

  {
    path: '/gids/mechanische-bouwsets-vergelijken',
    label: 'Technische vergelijking',
    group: 'Redactie',
  },
  { path: '/gids/slim-in-huis-onder-100-euro', label: 'Budgetgids', group: 'Redactie' },
  {
    path: '/gids/designvondsten-voor-een-kleine-woonkamer',
    label: 'Designcollectie',
    group: 'Redactie',
  },
  {
    path: '/gids/keukenvondsten-die-je-niet-verwacht',
    label: 'Vondstencollectie',
    group: 'Redactie',
  },
  { path: '/thema/wonen-design-en-meubels', label: 'Thema: wonen en design', group: 'Redactie' },
  { path: '/thema/koffie-en-slimme-keuken', label: 'Thema: keuken', group: 'Redactie' },

  { path: '/collectie/onnodig-maar-geweldig', label: 'Collectie: onnodig maar geweldig', group: 'Collecties' },
  { path: '/collectie/slimmer-wonen-onder-100', label: 'Collectie: onder 100 euro', group: 'Collecties' },
  { path: '/collectie/redactiefavorieten', label: 'Collectie: redactiefavorieten', group: 'Collecties' },

  { path: '/zoeken', label: 'Zoeken', group: 'Zoeken en bewaard' },
  { path: '/zoeken?q=lamp', label: 'Zoeken: lamp', group: 'Zoeken en bewaard', hidden: true },
  { path: '/zoeken?q=projector', label: 'Zoeken: projector', group: 'Zoeken en bewaard', hidden: true },
  { path: '/zoeken?q=cadeau', label: 'Zoeken: cadeau', group: 'Zoeken en bewaard', hidden: true },
  { path: '/zoeken?q=bouwset', label: 'Zoeken: bouwset', group: 'Zoeken en bewaard', hidden: true },
  {
    path: '/zoeken?q=zzzzgeenresultaat',
    label: 'Zoeken zonder resultaat',
    group: 'Zoeken en bewaard',
    hidden: true,
  },
  { path: '/bewaard', label: 'Bewaarde producten', group: 'Zoeken en bewaard', afterSaves: true },

  { path: '/over', label: 'Over ons', group: 'Informatie' },
  { path: '/hoe-wij-selecteren', label: 'Hoe wij selecteren', group: 'Informatie' },
  { path: '/affiliateverklaring', label: 'Affiliateverklaring', group: 'Informatie' },
  { path: '/privacy', label: 'Privacy', group: 'Informatie' },
  { path: '/cookies', label: 'Cookies', group: 'Informatie' },
  { path: '/contact', label: 'Contact', group: 'Informatie' },

  { path: '/deze-pagina-bestaat-niet', label: '404-pagina', group: 'Overig', key: '/404' },
]

/** Zoekopdrachten die als route zijn vastgelegd; de shim kiest hieruit. */
const capturedQueries = ['lamp', 'projector', 'cadeau', 'bouwset']
const noResultQuery = 'zzzzgeenresultaat'

const imageIds = new Map()
function imageId(url) {
  if (!imageIds.has(url)) imageIds.set(url, `i${imageIds.size}`)
  return imageIds.get(url)
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} bij ${url}`)
  return response.text()
}

async function fetchDataUri(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const type = response.headers.get('content-type') ?? 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())
    return `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/** Stylesheet ophalen, fonts inlinen en breedtequeries omzetten. */
async function buildStylesheet(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href')),
  )
  let css = ''
  for (const href of hrefs) {
    if (!href) continue
    css += `\n${await fetchText(new URL(href, base).toString())}`
  }

  // Fonts als data-URI: de artifact-runtime mag geen enkele externe of relatieve
  // bestandsaanvraag doen.
  const fontUrls = [...new Set([...css.matchAll(/url\((\.\.\/media\/[^)]+)\)/g)].map((match) => match[1]))]
  for (const fontUrl of fontUrls) {
    const absolute = new URL(fontUrl.replace('../media/', '/_next/static/media/'), base).toString()
    const dataUri = await fetchDataUri(absolute)
    if (dataUri) css = css.split(`url(${fontUrl})`).join(`url(${dataUri})`)
  }

  // Breedtegebaseerde media queries worden container queries, zodat de capture
  // in dezelfde pagina op telefoonbreedte te bekijken is met de echte layout.
  css = css.replace(/@media\s*\(((?:min|max)-width:[^)]+)\)/g, '@container ($1)')
  css = css.replace(
    /@media\s*\(((?:min|max)-width:[^)]+)\)\s*and\s*\(([^)]+)\)/g,
    '@container ($1) and ($2)',
  )
  return css
}

/**
 * De variabelen die `next/font` via een klasse op `<html>` zet.
 *
 * Die klasse valt buiten de opname, en `--font-sans` verwijst ernaar. Een
 * variabele die naar een onbekende variabele verwijst is ongeldig, dus zonder
 * deze regel valt de hele site terug op het systeemfont. Daarom worden de
 * waarden uitgelezen en als `:root`-regel meegegeven.
 */
const rootFontVariables = () => {
  const declarations = []
  const classes = [...document.documentElement.classList]
  for (const sheet of document.styleSheets) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of rules) {
      if (!rule.selectorText || !rule.style) continue
      if (!classes.some((name) => rule.selectorText.includes(name))) continue
      for (const property of rule.style) {
        if (!property.startsWith('--')) continue
        declarations.push(`${property}:${rule.style.getPropertyValue(property)}`)
      }
    }
  }
  return [...new Set(declarations)].join(';')
}

/** Ruimt de pagina op en geeft de HTML van de body plus de afbeeldingen terug. */
const extract = () => {
  const remove = [
    'script',
    'noscript',
    'template',
    'link',
    'style',
    'next-route-announcer',
    '[data-nextjs-toast]',
  ]
  for (const selector of remove) {
    document.body.querySelectorAll(selector).forEach((node) => node.remove())
  }

  const images = []
  document.body.querySelectorAll('img').forEach((img) => {
    const source = img.currentSrc || img.src || ''
    if (source.length > 0) {
      images.push(source)
      img.setAttribute('data-img', source)
    }
    img.removeAttribute('srcset')
    img.removeAttribute('sizes')
    img.removeAttribute('src')
    img.setAttribute('loading', 'eager')
    img.setAttribute('decoding', 'sync')
  })

  // Externe links krijgen geen doel in een statische capture.
  document.body.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.removeAttribute('target')
  })

  return {
    html: document.body.innerHTML,
    images,
    title: document.title,
    // De fontvariabelen van next/font staan op <html> en de basiskleuren op
    // <body>. Beide elementen vallen buiten de opname, dus gaan die klassen mee
    // naar de houder in de capture.
    rootClass: `${document.documentElement.className} ${document.body.className}`
      .split(' ')
      // min-h-dvh rekent met de hoogte van het venster; die bestaat in de
      // opname niet op dezelfde manier en zou de houder laten meegroeien.
      .filter((name) => name.length > 0 && name !== 'min-h-dvh')
      .join(' '),
  }
}

async function main() {
  // Dezelfde aanpak als playwright.config.ts: een vooraf geïnstalleerde
  // Chromium gebruiken wanneer die er staat, in plaats van een download.
  const preinstalled = '/opt/pw-browsers/chromium'
  const browser = await chromium.launch({
    ...(existsSync(preinstalled) ? { executablePath: preinstalled } : {}),
    ...(process.getuid?.() === 0 ? { args: ['--no-sandbox'] } : {}),
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'nl-NL',
  })
  const page = await context.newPage()

  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  const stylesheet = await buildStylesheet(page)
  const fontVariables = await page.evaluate(rootFontVariables)

  // Drie producten echt bewaren, zodat /bewaard geen lege pagina is. Dit gaat
  // via de echte bewaarknop en de echte API, met een anonieme bezoeker-cookie.
  const hearts = page.locator('button[data-ready="true"][aria-pressed]')
  const heartCount = Math.min(await hearts.count(), 3)
  for (let index = 0; index < heartCount; index += 1) {
    await hearts.nth(index).click()
    await page.waitForTimeout(400)
  }
  console.info(`${heartCount} producten bewaard voor de capture van /bewaard.`)

  // Het mobiele menu bestaat alleen wanneer het open staat; die HTML wordt
  // apart vastgelegd en door de shim opnieuw gebruikt.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.locator('button[aria-controls="mobiel-menu"]').first().click()
  await page.waitForSelector('#mobiel-menu')
  const menuHtml = await page.evaluate(() => {
    const panel = document.querySelector('#mobiel-menu')
    const overlay = panel?.parentElement
    if (!overlay) return ''
    overlay.querySelectorAll('script, style, link').forEach((node) => node.remove())
    return overlay.outerHTML
  })
  await page.setViewportSize({ width: 1440, height: 1000 })

  const captured = []
  const imageUrls = new Set()
  let rootClass = ''

  for (const route of routes) {
    const url = `${base}${route.path}`
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    const status = response?.status() ?? 0
    const expected = route.key === '/404' ? 404 : 200
    if (status !== expected) {
      throw new Error(`${route.path} gaf status ${status}, verwacht ${expected}`)
    }
    const result = await page.evaluate(extract)
    rootClass = result.rootClass
    for (const image of result.images) imageUrls.add(image)
    captured.push({
      key: route.key ?? route.path,
      label: route.label,
      group: route.group,
      hidden: route.hidden === true,
      title: result.title,
      html: result.html,
    })
    console.info(`vastgelegd: ${route.path} (${result.images.length} afbeeldingen)`)
  }

  // De uitgaande knop leidt in staging naar een interne melding; die pagina
  // hoort erbij, zodat de knoppen in de capture ergens uitkomen.
  const noticeUrl = `${base}/staging/uitgaand?merchant=${encodeURIComponent('Huisvondst (demo)')}&product=nocta-bijzettafel-met-ingebouwde-koeling`
  await page.goto(noticeUrl, { waitUntil: 'networkidle' })
  const notice = await page.evaluate(extract)
  for (const image of notice.images) imageUrls.add(image)
  captured.push({
    key: '/staging/uitgaand',
    label: 'Melding bij een uitgaande knop',
    group: 'Overig',
    hidden: false,
    title: notice.title,
    html: notice.html,
  })

  await browser.close()

  // Afbeeldingen inlinen. De fallback van de applicatie zelf gaat er altijd in,
  // zodat een mislukte afbeelding nooit een gebroken icoon oplevert.
  const images = {}
  let failed = 0
  for (const url of imageUrls) {
    const dataUri = await fetchDataUri(url)
    if (dataUri) images[imageId(url)] = dataUri
    else failed += 1
  }
  const fallback = await fetchDataUri(`${base}/image-unavailable.svg`)
  if (!fallback) throw new Error('De lokale fallbackafbeelding is niet op te halen.')
  console.info(`${Object.keys(images).length} afbeeldingen ingesloten, ${failed} vervangen door de fallback.`)

  // De HTML verwijst nu naar de volledige URL; die wordt een korte sleutel.
  const idByUrl = Object.fromEntries([...imageIds.entries()])
  const pages = captured.map((entry) => ({
    ...entry,
    html: entry.html.replace(/data-img="([^"]*)"/g, (match, url) => {
      const id = idByUrl[url]
      return id ? `data-img="${id}"` : 'data-img="onbekend"'
    }),
  }))
  const menu = menuHtml.replace(/data-img="([^"]*)"/g, () => 'data-img="onbekend"')

  const payload = {
    pages,
    images,
    fallback,
    menu,
    queries: capturedQueries,
    noResultQuery,
    rootClass,
    capturedAt: new Date().toISOString(),
  }

  const html = shell(`${stylesheet}\n:root{${fontVariables}}`, payload)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, html, 'utf8')
  console.info(`${out} geschreven (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB).`)
}

/** De omhullende pagina: werkbalk, weergavebreedte en de shims. */
function shell(stylesheet, payload) {
  // Elke "<" wordt een JSON-escape. Zo kan er in de data geen `</script>` of
  // `<!--` staan dat de parser van de pagina in de war brengt.
  const json = JSON.stringify(payload).replace(/</g, '\\u003C')

  const groups = []
  for (const page of payload.pages) {
    if (page.hidden) continue
    let group = groups.find((entry) => entry.name === page.group)
    if (!group) {
      group = { name: page.group, items: [] }
      groups.push(group)
    }
    group.items.push(page)
  }

  const navigation = groups
    .map(
      (group) => `
        <div class="sb-group">
          <p class="sb-group-title">${escapeHtml(group.name)}</p>
          <ul>
            ${group.items
              .map(
                (item) =>
                  `<li><a class="sb-link" href="#${escapeHtml(item.key)}" data-route="${escapeHtml(item.key)}">${escapeHtml(item.label)}</a></li>`,
              )
              .join('')}
          </ul>
        </div>`,
    )
    .join('')

  return `<title>HomeAndLivingDeals.nl — staging</title>
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
<meta name="googlebot" content="noindex, nofollow" />
<style>${stylesheet}</style>
<style>
  /*
    De hoogte staat bewust in pixels en niet in vh of dvh. Deze pagina kan in een
    lijst met een automatische hoogte staan; dan is de hoogte van het venster
    gelijk aan de hoogte van de inhoud, en zou een venstermaat zichzelf blijven
    optellen. Met een vaste hoogte houden de navigatie, de sticky header van de
    site en het terugspringen naar boven zich netjes.
  */
  :root { color-scheme: light; --sb-height: 860px; }
  body { margin: 0; background: #f7f7f4; color: #161616; }
  #sb-app { display: flex; height: var(--sb-height); overflow: hidden; }
  #sb-side {
    height: var(--sb-height); overflow-y: auto;
    width: 250px; flex: 0 0 250px; background: #161616; color: #f7f7f4;
    padding: 18px 16px 32px; font-size: 13px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  #sb-side h1 { font-size: 14px; margin: 0 0 2px; color: #fff; letter-spacing: -0.01em; }
  #sb-side p.sb-sub { margin: 0 0 14px; color: #b6b6b0; font-size: 11px; line-height: 1.45; }
  .sb-note { border: 1px solid #3a3a38; border-radius: 10px; padding: 8px 10px; margin-bottom: 14px; color: #ffd9d4; font-size: 11px; line-height: 1.5; }
  .sb-devices { display: flex; gap: 6px; margin-bottom: 16px; }
  .sb-devices button {
    flex: 1; border: 1px solid #3a3a38; background: transparent; color: #f7f7f4;
    border-radius: 999px; padding: 6px 0; font-size: 11px; cursor: pointer;
  }
  .sb-devices button[aria-pressed="true"] { background: #ff5b4d; border-color: #ff5b4d; color: #fff; }
  .sb-group { margin-bottom: 14px; }
  .sb-group-title { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #8f8f8a; }
  #sb-side ul { list-style: none; margin: 0; padding: 0; }
  .sb-link { display: block; padding: 5px 8px; border-radius: 8px; color: #e6e6e1; text-decoration: none; line-height: 1.35; }
  .sb-link:hover { background: #262625; }
  .sb-link[aria-current="true"] { background: #ff5b4d; color: #fff; }
  #sb-main {
    flex: 1; min-width: 0; height: var(--sb-height); overflow-y: auto;
    display: flex; justify-content: center; background: #ebebe6;
    position: relative;
  }
  /*
    Het mobiele menu van de site staat vast in het venster. In de opname mag het
    alleen het weergavevenster bedekken en niet de stagingnavigatie ernaast.
  */
  #sb-main > .sb-overlay { position: absolute; inset: 0; }
  #sb-frame {
    container-type: inline-size;
    width: 100%; max-width: 1440px; background: #f7f7f4; min-height: 100%;
    align-self: flex-start;
  }
  #sb-app[data-device="mobile"] #sb-frame { max-width: 390px; box-shadow: 0 0 0 1px #d8d8d2; }
  #sb-app[data-device="tablet"] #sb-frame { max-width: 834px; box-shadow: 0 0 0 1px #d8d8d2; }
</style>

<div id="sb-app" data-device="desktop">
  <nav id="sb-side" aria-label="Stagingnavigatie">
    <h1>HomeAndLivingDeals.nl</h1>
    <p class="sb-sub">Statische opname van de stagingomgeving. Alle pagina's zijn door de applicatie zelf gerenderd.</p>
    <p class="sb-note">Voorbeelddata. Geen echte prijzen, geen affiliatelinks, geen tracking en geen advertenties.</p>
    <div class="sb-devices" role="group" aria-label="Weergavebreedte">
      <button type="button" data-device="desktop" aria-pressed="true">Desktop</button>
      <button type="button" data-device="tablet" aria-pressed="false">Tablet</button>
      <button type="button" data-device="mobile" aria-pressed="false">Mobiel</button>
    </div>
    ${navigation}
  </nav>
  <main id="sb-main">
    <div id="sb-frame" class="${escapeHtml(payload.rootClass)}"></div>
  </main>
</div>

<script id="sb-data" type="application/json">${json}</script>
<script>
  (function () {
    const data = JSON.parse(document.getElementById('sb-data').textContent)
    const frame = document.getElementById('sb-frame')
    const main = document.getElementById('sb-main')
    const app = document.getElementById('sb-app')
    const byKey = new Map(data.pages.map((page) => [page.key, page]))
    const saved = new Set()

    /** Afbeeldingen komen uit de ingesloten map; anders de eigen fallback. */
    function hydrateImages(root) {
      root.querySelectorAll('img[data-img]').forEach((img) => {
        const id = img.getAttribute('data-img')
        img.src = data.images[id] || data.fallback
        img.addEventListener('error', () => {
          if (img.src !== data.fallback) img.src = data.fallback
        })
      })
    }

    /** De bewaarknop in de opname: dezelfde statusattributen, lokaal bewaard. */
    function paintHeart(button) {
      const id = button.getAttribute('aria-label') || ''
      const on = saved.has(id)
      button.setAttribute('aria-pressed', on ? 'true' : 'false')
      button.setAttribute('data-saved', on ? 'true' : 'false')
      const icon = button.querySelector('svg')
      if (icon) icon.classList.toggle('fill-current', on)
      button.classList.toggle('border-accent', on)
      button.classList.toggle('text-accent', on)
      button.classList.toggle('border-line', !on)
    }

    function wireHearts(root) {
      root.querySelectorAll('button[aria-pressed][data-saved]').forEach((button) => {
        paintHeart(button)
        button.addEventListener('click', (event) => {
          event.preventDefault()
          const id = button.getAttribute('aria-label') || ''
          if (saved.has(id)) saved.delete(id)
          else saved.add(id)
          root.querySelectorAll('button[aria-pressed][data-saved]').forEach(paintHeart)
        })
      })
    }

    /** Mobiel menu: de echte, bij 390 pixels opgenomen HTML. */
    function wireMenu(root) {
      root.querySelectorAll('button[aria-controls="mobiel-menu"]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault()
          if (main.querySelector('#mobiel-menu')) return
          main.scrollTop = 0
          const holder = document.createElement('div')
          holder.innerHTML = data.menu
          const panel = holder.firstElementChild
          if (!panel) return
          panel.classList.add('sb-overlay')
          // Het menu hoort precies over het weergavevenster te liggen, ook
          // wanneer dat op telefoonbreedte in het midden staat.
          panel.style.left = frame.offsetLeft + 'px'
          panel.style.width = frame.offsetWidth + 'px'
          panel.style.right = 'auto'
          main.appendChild(panel)
          hydrateImages(panel)
          wireLinks(panel)
          const close = () => panel.remove()
          panel.querySelectorAll('button').forEach((item) => item.addEventListener('click', close))
          const overlay = panel.querySelector('[role="presentation"]')
          if (overlay) overlay.addEventListener('click', close)
          panel.querySelectorAll('a').forEach((item) => item.addEventListener('click', close))
        })
      })
    }

    /** Zoeken: de opgenomen zoekopdrachten, met de getypte tekst in beeld. */
    function wireForms(root) {
      root.querySelectorAll('form').forEach((form) => {
        form.addEventListener('submit', (event) => {
          event.preventDefault()
          const input = form.querySelector('input[type="search"], input[name="q"]')
          const value = (input && input.value ? input.value : '').trim()
          if (value.length === 0) {
            go('/zoeken')
            return
          }
          const match = data.queries.find((query) => query.toLowerCase() === value.toLowerCase())
          if (match) {
            go('/zoeken?q=' + match)
            return
          }
          go('/zoeken?q=' + data.noResultQuery, value)
        })
      })
    }

    /** Interne links worden hashlinks; onbekende routes gaan naar de 404. */
    function wireLinks(root) {
      root.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href') || ''
        if (!href.startsWith('/')) {
          if (href.startsWith('#')) return
          link.addEventListener('click', (event) => event.preventDefault())
          return
        }
        link.addEventListener('click', (event) => {
          event.preventDefault()
          // De uitgaande knop komt in staging uit op de interne melding.
          const target = href.startsWith('/go/') ? '/staging/uitgaand' : href
          go(byKey.has(target) ? target : '/404')
        })
      })
    }

    /** Vervangt de opgenomen zoekterm door wat de bezoeker typte. */
    function replaceQuery(root, typed) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const nodes = []
      while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.indexOf(data.noResultQuery) >= 0) nodes.push(walker.currentNode)
      }
      nodes.forEach((node) => {
        node.nodeValue = node.nodeValue.split(data.noResultQuery).join(typed)
      })
      root.querySelectorAll('input[type="search"], input[name="q"]').forEach((input) => {
        input.value = typed
      })
    }

    function go(key, typed) {
      const page = byKey.get(key) || byKey.get('/404')
      if (!page) return
      frame.innerHTML = page.html
      hydrateImages(frame)
      wireLinks(frame)
      wireHearts(frame)
      wireMenu(frame)
      wireForms(frame)
      if (typed) replaceQuery(frame, typed)
      document.querySelectorAll('.sb-link').forEach((link) => {
        link.setAttribute('aria-current', link.getAttribute('data-route') === page.key ? 'true' : 'false')
      })
      if (location.hash !== '#' + page.key) {
        history.replaceState(null, '', '#' + page.key)
      }
      main.scrollTop = 0
    }

    document.querySelectorAll('.sb-link').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault()
        go(link.getAttribute('data-route'))
      })
    })

    document.querySelectorAll('.sb-devices button').forEach((button) => {
      button.addEventListener('click', () => {
        const device = button.getAttribute('data-device')
        app.setAttribute('data-device', device)
        document.querySelectorAll('.sb-devices button').forEach((item) => {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false')
        })
      })
    })

    window.addEventListener('hashchange', () => {
      const key = decodeURIComponent(location.hash.replace(/^#/, ''))
      if (byKey.has(key)) go(key)
    })

    const initial = decodeURIComponent(location.hash.replace(/^#/, ''))
    go(byKey.has(initial) ? initial : '/')
  })()
</script>
`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
