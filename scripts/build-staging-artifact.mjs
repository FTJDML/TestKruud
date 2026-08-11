#!/usr/bin/env node
/**
 * Bouwt één zelfstandig HTML-bestand van de draaiende stagingomgeving.
 *
 * Waarom dit bestaat: een Claude-artifact is één statisch HTML-bestand achter
 * een strikte CSP. Daar draait geen Next.js-server en geen PostgreSQL, dus de
 * applicatie zelf kan er niet in staan. In plaats van de architectuur van de
 * applicatie aan te passen, legt dit script de **werkelijk gerenderde pagina's**
 * van de staging vast: dezelfde componenten, dezelfde Tailwind-build, dezelfde
 * data en dezelfde afbeeldingen.
 *
 * Het resultaat is de site zelf, zonder omhulsel eromheen. Er komt geen balk,
 * geen menu en geen keuzelijst bij: je navigeert door de eigen header, de
 * categoriebalk, de productkaarten en de footer, precies zoals in de applicatie.
 *
 * Hoe het werkt:
 *
 * 1. Een crawler start op de homepage en volgt elke interne link die hij
 *    tegenkomt, tot alles is gezien. Zo blijft geen enkele link in de opname
 *    dood; wat de site linkt, zit erin.
 * 2. Per pagina worden scripts en verwijzingen verwijderd en blijft de
 *    gerenderde HTML over.
 * 3. De stylesheet en de woff2-fonts gaan als data-URI mee, en elke afbeelding
 *    wordt via de eigen server opgehaald en ingesloten. Lukt een afbeelding
 *    niet, dan komt dezelfde lokale fallback in het bestand die de applicatie
 *    zelf gebruikt; een gebroken afbeeldingsicoon komt er nooit in.
 * 4. Breedtegebaseerde media queries worden container queries op de houder van
 *    de pagina. Die houder is honderd procent breed, dus de layout reageert op
 *    de breedte van het browservenster: smal venster of telefoon geeft de echte
 *    mobiele weergave, inclusief het hamburgermenu.
 * 5. Kleine shims vervangen de interactie die met de scripts wegviel: navigeren
 *    tussen de vastgelegde pagina's, de bewaarknop, het mobiele menu en het
 *    zoekformulier.
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
const maxPages = Number.parseInt(arg('max', '250'), 10)

/** Startpunten. De crawler vindt de rest zelf via de links op de pagina's. */
const seeds = [
  '/',
  '/categorieen',
  '/gidsen',
  '/nieuw',
  '/bewaard',
  '/zoeken',
  '/over',
  '/hoe-wij-selecteren',
  '/affiliateverklaring',
  '/privacy',
  '/cookies',
  '/contact',
]

/** Zoekopdrachten die als pagina worden vastgelegd; de shim kiest hieruit. */
const capturedQueries = ['lamp', 'projector', 'cadeau', 'bouwset', 'bureau', 'tafel', 'stoel']
const noResultQuery = 'zzzzgeenresultaat'

/** Route die niet bestaat; levert de echte 404-pagina van de applicatie. */
const notFoundPath = '/deze-pagina-bestaat-niet'

/** Paden die nooit worden gecrawld. */
function skipPath(path) {
  return (
    path.startsWith('/api/') ||
    path.startsWith('/admin') ||
    path.startsWith('/_next') ||
    path === '/robots.txt' ||
    path === '/sitemap.xml'
  )
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

  // Breedtegebaseerde media queries worden container queries op de houder van de
  // pagina. Die houder is even breed als het venster, dus de site reageert nog
  // steeds op de breedte van de browser.
  css = css.replace(
    /@media\s*\(((?:min|max)-width:[^)]+)\)\s*and\s*\(([^)]+)\)/g,
    '@container ($1) and ($2)',
  )
  css = css.replace(/@media\s*\(((?:min|max)-width:[^)]+)\)/g, '@container ($1)')
  return css
}

/**
 * De variabelen die `next/font` via een klasse op `<html>` zet.
 *
 * Die klasse valt buiten de opname, en `--font-sans` verwijst ernaar. Een
 * variabele die naar een onbekende variabele verwijst is ongeldig, dus zonder
 * deze regel valt de hele site terug op het systeemfont.
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

/**
 * Ruimt de pagina op en geeft terug wat de opname nodig heeft: de HTML van de
 * body, de afbeeldingen, de interne links en de aanbieders achter de uitgaande
 * knoppen.
 */
const extract = () => {
  for (const selector of ['script', 'noscript', 'template', 'link', 'style']) {
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

  const links = []
  const merchants = []
  document.body.querySelectorAll('a[href^="/"]').forEach((link) => {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('/go/')) {
      // De naam van de aanbieder staat in de knoptekst ("Bekijk deal bij X").
      const match = /bij ([^,]+?)(,|$)/.exec(link.textContent ?? '')
      if (match) merchants.push(match[1].trim())
      return
    }
    links.push(href)
  })

  // Een nieuw tabblad bestaat niet in een opname.
  document.body.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.removeAttribute('target')
  })

  return {
    html: document.body.innerHTML,
    images,
    links,
    merchants,
    title: document.title,
    rootClass: `${document.documentElement.className} ${document.body.className}`
      .split(' ')
      // min-h-dvh rekent met de hoogte van het venster; de opname laat de pagina
      // gewoon meegroeien met zijn inhoud.
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

  // Drie producten echt bewaren, zodat "Bewaard" geen lege pagina is. Dit gaat
  // via de echte bewaarknop en de echte API, met een anonieme bezoekerscookie.
  const hearts = page.locator('button[data-ready="true"][aria-pressed]')
  const heartCount = Math.min(await hearts.count(), 3)
  for (let index = 0; index < heartCount; index += 1) {
    await hearts.nth(index).click()
    await page.waitForTimeout(350)
  }
  console.info(`${heartCount} producten bewaard voor de pagina met bewaarde producten.`)

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

  const pages = new Map()
  const imageUrls = new Set()
  const merchantNames = new Set()
  let rootClass = ''

  const queue = [
    ...seeds,
    ...capturedQueries.map((query) => `/zoeken?q=${encodeURIComponent(query)}`),
    `/zoeken?q=${noResultQuery}`,
  ]
  const queued = new Set(queue)

  /**
   * Wacht tot elke afbeelding klaar is en meldt of er een op de eigen fallback is
   * teruggevallen. Dat gebeurt in de browser wanneer een afbeelding niet laadt,
   * en tijdens een crawl van honderd pagina's kan dat een keer misgaan. De opname
   * mag zo'n toevallige misser niet vastleggen, dus dan volgt een nieuwe poging.
   */
  const settleImages = () =>
    page.evaluate(async () => {
      const images = [...document.images]
      await Promise.all(
        images.map((image) =>
          image.complete
            ? null
            : new Promise((done) => {
                image.addEventListener('load', done, { once: true })
                image.addEventListener('error', done, { once: true })
                setTimeout(done, 5000)
              }),
        ),
      )
      return images.filter((image) => (image.currentSrc || image.src || '').includes('image-unavailable'))
        .length
    })

  async function capture(path, key = path, expected = 200) {
    let result = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
      const status = response?.status() ?? 0
      if (status !== expected) {
        console.warn(`${path} gaf status ${status}, verwacht ${expected}; overgeslagen.`)
        return null
      }
      const onFallback = await settleImages()
      result = await page.evaluate(extract)
      if (onFallback === 0) break
      if (attempt < 2) {
        console.warn(`${path}: ${onFallback} afbeelding(en) vielen terug op de fallback; opnieuw proberen.`)
        await page.waitForTimeout(750)
      } else {
        console.warn(`${path}: ${onFallback} afbeelding(en) blijven op de fallback staan.`)
      }
    }
    if (!result) return null
    rootClass = result.rootClass
    for (const image of result.images) imageUrls.add(image)
    for (const merchant of result.merchants) merchantNames.add(merchant)
    pages.set(key, { key, title: result.title, html: result.html })
    return result
  }

  while (queue.length > 0 && pages.size < maxPages) {
    const path = queue.shift()
    if (pages.has(path)) continue
    const result = await capture(path)
    if (!result) continue
    for (const href of result.links) {
      // Zoekresultaten hebben een querystring; de rest wordt op het pad gevolgd.
      const clean = href.startsWith('/zoeken') ? href : href.split(/[?#]/)[0]
      if (!clean.startsWith('/') || skipPath(clean)) continue
      if (queued.has(clean) || pages.has(clean)) continue
      queued.add(clean)
      queue.push(clean)
    }
    if (pages.size % 20 === 0) console.info(`${pages.size} pagina's vastgelegd, ${queue.length} in de wachtrij.`)
  }
  console.info(`${pages.size} pagina's vastgelegd.`)

  // De echte 404-pagina van de applicatie.
  await capture(notFoundPath, '/404', 404)

  // De interne melding achter elke uitgaande knop, met de juiste aanbieder.
  for (const merchant of merchantNames) {
    const path = `/staging/uitgaand?merchant=${encodeURIComponent(merchant)}`
    await capture(path, `/staging/uitgaand?merchant=${merchant}`)
  }
  await capture('/staging/uitgaand', '/staging/uitgaand')
  console.info(`${merchantNames.size} meldingen voor uitgaande knoppen vastgelegd.`)

  await browser.close()

  // Afbeeldingen inlinen, met de fallback van de applicatie zelf achter de hand.
  const images = {}
  const ids = new Map()
  let failed = 0
  for (const url of imageUrls) {
    const dataUri = await fetchDataUri(url)
    const id = `i${ids.size}`
    ids.set(url, id)
    if (dataUri) images[id] = dataUri
    else failed += 1
  }
  const fallback = await fetchDataUri(`${base}/image-unavailable.svg`)
  if (!fallback) throw new Error('De lokale fallbackafbeelding is niet op te halen.')
  console.info(`${Object.keys(images).length} afbeeldingen ingesloten, ${failed} vervangen door de fallback.`)

  /**
   * De URL staat in een attribuut, dus in de HTML zijn de ampersands van
   * `/_next/image?url=...&w=384` als `&amp;` geserialiseerd. Zonder deze
   * omzetting matcht geen enkele geoptimaliseerde afbeelding en zou de opname
   * overal de fallback tonen in plaats van de echte foto.
   */
  const decodeAttribute = (value) =>
    value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')

  let unmatched = 0
  const withImageIds = [...pages.values()].map((entry) => ({
    ...entry,
    html: entry.html.replace(/data-img="([^"]*)"/g, (match, raw) => {
      const id = ids.get(decodeAttribute(raw))
      if (!id) unmatched += 1
      return id ? `data-img="${id}"` : 'data-img="onbekend"'
    }),
  }))
  if (unmatched > 0) {
    throw new Error(
      `${unmatched} afbeelding(en) in de opname zijn niet aan een ingesloten bestand te koppelen; de opname zou daar de fallback tonen.`,
    )
  }

  const payload = {
    pages: withImageIds,
    images,
    fallback,
    menu: menuHtml.replace(/data-img="([^"]*)"/g, () => 'data-img="onbekend"'),
    queries: capturedQueries,
    noResultQuery,
    rootClass,
    home: '/',
  }

  const html = shell(`${stylesheet}\n:root{${fontVariables}}`, payload)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, html, 'utf8')
  console.info(`${out} geschreven (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB).`)
}

/**
 * De pagina zelf: alleen de site, met de shims eronder. Bewust zonder eigen
 * navigatie, balk of keuzelijst: wat je ziet is de applicatie.
 */
function shell(stylesheet, payload) {
  // Elke "<" wordt een JSON-escape. Zo kan er in de data geen `</script>` of
  // `<!--` staan dat de parser van de pagina in de war brengt.
  const json = JSON.stringify(payload).replace(/</g, '\\u003C')

  return `<title>HomeAndLivingDeals.nl — staging</title>
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
<meta name="googlebot" content="noindex, nofollow" />
<style>${stylesheet}</style>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: var(--color-canvas, #f7f7f4); color: var(--color-ink, #161616); }
  /*
    De houder van de pagina is de container waarop de breedtequeries van de site
    werken. Hij is honderd procent breed, dus de layout volgt het venster: smal
    venster of telefoon geeft de echte mobiele weergave.
  */
  #site { container-type: inline-size; width: 100%; }
</style>

<div id="site" class="${escapeHtml(payload.rootClass)}"></div>

<script id="staging-data" type="application/json">${json}</script>
<script>
  (function () {
    const data = JSON.parse(document.getElementById('staging-data').textContent)
    const site = document.getElementById('site')
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

    /** De bewaarknop: dezelfde statusattributen als in de applicatie. */
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
          document.querySelectorAll('button[aria-pressed][data-saved]').forEach(paintHeart)
        })
      })
    }

    /** Mobiel menu: de echte, bij 390 pixels opgenomen HTML. */
    function wireMenu(root) {
      root.querySelectorAll('button[aria-controls="mobiel-menu"]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault()
          if (document.querySelector('#mobiel-menu')) return
          const holder = document.createElement('div')
          holder.innerHTML = data.menu
          const panel = holder.firstElementChild
          if (!panel) return
          // In de houder van de pagina, zodat het paneel de eigen regels van de
          // site volgt: op een breed venster hoort het menu er niet te staan.
          site.appendChild(panel)
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

    /** Zoeken: de vastgelegde zoekopdrachten, met de getypte tekst in beeld. */
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
            go('/zoeken?q=' + encodeURIComponent(match))
            return
          }
          go('/zoeken?q=' + data.noResultQuery, value)
        })
      })
    }

    /** De aanbieder achter een uitgaande knop staat in de knoptekst. */
    function noticeFor(link) {
      const match = /bij ([^,]+?)(,|$)/.exec(link.textContent || '')
      const merchant = match ? match[1].trim() : ''
      const key = '/staging/uitgaand?merchant=' + merchant
      return byKey.has(key) ? key : '/staging/uitgaand'
    }

    /** Interne links navigeren binnen de opname; onbekend gaat naar de 404. */
    function wireLinks(root) {
      root.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href') || ''
        if (!href.startsWith('/')) {
          if (!href.startsWith('#')) link.addEventListener('click', (event) => event.preventDefault())
          return
        }
        link.addEventListener('click', (event) => {
          event.preventDefault()
          // De knop naar de winkel komt in staging uit op de interne melding.
          const target = href.startsWith('/go/') ? noticeFor(link) : href
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
      const open = document.querySelector('#mobiel-menu')
      if (open && open.parentElement) open.parentElement.remove()
      site.innerHTML = page.html
      hydrateImages(site)
      wireLinks(site)
      wireHearts(site)
      wireMenu(site)
      wireForms(site)
      if (typed) replaceQuery(site, typed)
      if (location.hash !== '#' + page.key) history.replaceState(null, '', '#' + page.key)
      // Deze pagina kan in een frame staan; scrollIntoView werkt daar ook, want
      // het scrollt de bovenliggende pagina mee. window.scrollTo doet dat niet.
      site.scrollIntoView({ block: 'start' })
    }

    window.addEventListener('hashchange', () => {
      const key = decodeURIComponent(location.hash.replace(/^#/, ''))
      if (byKey.has(key)) go(key)
    })

    const initial = decodeURIComponent(location.hash.replace(/^#/, ''))
    go(byKey.has(initial) ? initial : data.home)
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
