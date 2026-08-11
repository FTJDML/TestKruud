# HomeAndLivingDeals.nl

Nederlands discovery-commerce magazine voor verrassende, slimme, mooie en soms
licht absurde producten voor in en om het huis. De site verkoopt zelf niets:
elke koopknop verwijst naar de aanbieder via één centrale route (`/go/[offerId]`),
zodat affiliate-links later zonder frontendwijziging kunnen worden aangesloten.

**Stack:** Next.js 16 (App Router, Server Components) · TypeScript strict ·
Tailwind CSS 4 · PostgreSQL met Prisma 7 · Zod · Lucide · Vitest · Playwright.

---

## Inhoud

1. [Lokale installatie](#lokale-installatie)
2. [Environment variables](#environment-variables)
3. [Database: migraties en seeden](#database-migraties-en-seeden)
4. [Development starten](#development-starten)
5. [Production build](#production-build)
6. [Docker Compose](#docker-compose)
7. [Tests en kwaliteit](#tests-en-kwaliteit)
8. [Dagelijkse job en cron](#dagelijkse-job-en-cron)
9. [Adminpaneel](#adminpaneel)
10. [Advertenties inschakelen](#advertenties-inschakelen)
11. [Anthropic-provider instellen](#anthropic-provider-instellen)
12. [Live bron met echte productfoto's](#live-bron-met-echte-productfotos)
13. [Nieuwe merchant toevoegen](#nieuwe-merchant-toevoegen)
14. [Affiliate-URL's toevoegen](#affiliate-urls-toevoegen)
15. [Demo-inhoud verwijderen](#demo-inhoud-verwijderen)
16. [Deployment op een Linux-VPS](#deployment-op-een-linux-vps)
17. [Projectstructuur](#projectstructuur)
18. [Wat nodig is voor de eerste echte merchant](#wat-nodig-is-voor-de-eerste-echte-merchant)

---

## Lokale installatie

Vereisten: Node.js 20.9 of nieuwer, pnpm 10 en een PostgreSQL-server (of Docker).

```bash
pnpm install
cp .env.example .env      # pas DATABASE_URL aan
```

Database aanmaken (voorbeeld met een lokale PostgreSQL):

```bash
sudo -u postgres psql -c "CREATE USER hald WITH PASSWORD 'hald' CREATEDB;"
sudo -u postgres createdb -O hald homeandlivingdeals
```

## Environment variables

Alle variabelen staan met uitleg in `.env.example`. De belangrijkste:

| Variabele | Verplicht | Uitleg |
| --- | --- | --- |
| `DATABASE_URL` | ja | PostgreSQL-verbinding (Prisma 7 leest deze via `prisma.config.ts`). |
| `NEXT_PUBLIC_SITE_URL` | ja in productie | Basis-URL voor canonicals, sitemap en Open Graph. |
| `NEXT_PUBLIC_ADS_ENABLED` | nee | `false` in deze MVP. Zie [Advertenties](#advertenties-inschakelen). |
| `NEXT_PUBLIC_AD_PROVIDER` | nee | `none` of `adsense`. |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | nee | Alleen nodig bij `adsense`. |
| `CONTENT_PROVIDER` | nee | `fixture`, `template` (standaard) of `anthropic`. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | nee | Alleen bij `CONTENT_PROVIDER=anthropic`. |
| `CRON_SECRET` | ja voor cron | Bearer-token voor `/api/cron/daily`. |
| `SCRAPER_USER_AGENT` | nee | Herkenbare user-agent voor feeds en toegestane scrapes. |
| `SCRAPER_TIMEOUT_MS`, `SCRAPER_MAX_CONCURRENCY`, `SCRAPER_REQUESTS_PER_MINUTE` | nee | Time-outs, gelijktijdigheid en rate limiting per host. |
| `SCRAPER_ALLOW_BROWSER` | nee | `true` staat de optionele Playwright-fetcher toe. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | ja voor admin | Login voor `/admin`; de sessie staat in een httpOnly cookie. |
| `SEED_DEMO_CONTENT` | nee | Zet op `false` om geen demo-inhoud te seeden. |

## Database: migraties en seeden

```bash
pnpm prisma migrate deploy     # productie: bestaande migraties toepassen
pnpm db:migrate:dev            # development: nieuwe migratie maken
pnpm db:seed                   # demo-merchants, demo-producten en één editie
pnpm db:reset                  # database leegmaken en opnieuw seeden
```

De seed maakt 8 fictieve demo-merchants, 26 demo-producten (`isDemo = true`,
noindex), redactionele fixturecontent en één gepubliceerde editie voor vandaag.
Save- en klikdata komen **nooit** in de seed: die staan alleen in
`tests/fixtures/` en worden alleen door tests gebruikt.

Demo-illustraties opnieuw genereren (originele, lokale SVG's):

```bash
node scripts/generate-demo-images.mjs
```

## Development starten

```bash
pnpm dev        # http://localhost:3000
```

In development tonen advertentieposities een rustige placeholder met het label
"Advertentieruimte". In productie met advertenties uit nemen ze geen ruimte in.

## Production build

```bash
pnpm build
pnpm start      # standaard poort 3000
```

`pnpm build` levert een gewone Next.js-build. Het Docker-image gebruikt de
standalone output (`NEXT_OUTPUT_STANDALONE=1`) en start met `node server.js`.

Alle databasegestuurde pagina's worden per request server-side gerenderd. Daardoor
zijn prijzen en controlemomenten altijd actueel en heeft `pnpm build` geen
database nodig (belangrijk voor `docker build`). Wil je ISR gebruiken en heeft je
buildomgeving toegang tot de database, vervang dan `export const dynamic =
'force-dynamic'` door `export const revalidate = <seconden>` in de betreffende
`page.tsx`.

## Docker Compose

```bash
cp .env.example .env       # optioneel: waarden aanpassen
docker compose up --build  # http://localhost:3000
```

De stack bestaat uit:

- `db` — PostgreSQL 17 met healthcheck (`pg_isready`) en een named volume;
- `migrate` — eenmalige stap die `prisma migrate deploy` en de seed uitvoert;
- `app` — de Next.js-app (standalone output, non-root user) met een healthcheck
  op `/api/health`.

De app start pas nadat de migraties succesvol zijn afgerond
(`service_completed_successfully`).

## Tests en kwaliteit

```bash
pnpm lint         # ESLint (next/core-web-vitals + next/typescript)
pnpm typecheck    # tsc --noEmit, strict
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright smoketest (start zelf een dev-server)
```

Unit tests dekken prijsberekening, kortingspercentages, ongeldige
referentieprijzen, stale aanbiedingen, deduplicatie, de samengestelde
selectiescore, de dagelijkse editieselectie (inclusief de limieten per categorie
en merchant), AI-outputvalidatie, redirectveiligheid, feedmapping en dubbele
saves. De savetest gebruikt een echte database wanneer `DATABASE_URL` is gezet en
slaat zichzelf anders over.

De Playwright-smoketest draait standaard tegen `next dev` (zodat de
advertentieplaceholder gecontroleerd kan worden) op desktop (1440 × 900) en
mobiel (390 × 844). Tegen een productiebuild testen:

```bash
pnpm build && PLAYWRIGHT_DEV=0 pnpm test:e2e
```

## Dagelijkse job en cron

De dagelijkse pipeline leest merchantbronnen uit, normaliseert en dedupliceert,
slaat prijssnapshots op, markeert stale aanbiedingen, genereert ontbrekende
redactionele content, berekent scores en publiceert atomair één editie voor de
Nederlandse kalenderdag (`Europe/Amsterdam`).

```bash
pnpm job:daily                 # volledige pipeline
pnpm job:ingest                # alleen bronnen uitlezen
pnpm job:ingest demo-kookkamer # één merchant
pnpm job:content               # ontbrekende of gewijzigde teksten aanvullen
pnpm job:content --force       # alles opnieuw, bijvoorbeeld na een nieuwe sjabloonversie
```

Een mislukte run verwijdert nooit bestaande producten of de vorige editie: de
homepage blijft de laatst geldige editie tonen. Elke run wordt vastgelegd in
`ScrapeRun` en is terug te zien in `/admin/runs`.

Beveiligde endpoint (vereist `CRON_SECRET`):

```bash
curl -X POST https://homeandlivingdeals.nl/api/cron/daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

Crontab op een VPS — elke ochtend om 06:15 Nederlandse tijd:

```cron
CRON_TZ=Europe/Amsterdam
15 6 * * * cd /var/www/homeandlivingdeals && /usr/bin/pnpm job:daily >> /var/log/hald-daily.log 2>&1
```

Of via de endpoint (bijvoorbeeld wanneer de app in Docker draait):

```cron
CRON_TZ=Europe/Amsterdam
15 6 * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/daily >> /var/log/hald-daily.log 2>&1
```

## Adminpaneel

`/admin` (altijd `noindex`). Inloggen met `ADMIN_USERNAME` en `ADMIN_PASSWORD`;
de sessie is een ondertekende, httpOnly cookie die na 12 uur verloopt.

Beschikbaar: overzicht met aantallen, producten per status (kandidaat, review
nodig, concept, gepubliceerd, afgewezen, gearchiveerd), preview, brondata,
prijsbron met snapshots, AI-tekst aanpassen, approve/reject/publish/unpublish,
als hero instellen, content opnieuw genereren, merchants in- en uitschakelen,
handmatig één bron uitlezen, de dagelijkse job starten, scrapehistorie, stale
aanbiedingen en de echte save- en klikdata.

Nieuwe producten van echte merchants krijgen standaard de status `CANDIDATE` en
moeten handmatig worden goedgekeurd. Zet `{"autoPublish": true}` in
`Merchant.configuration` om dat per merchant te veranderen.

## Advertenties inschakelen

Advertenties staan uit. Het component `AdSlot` is provider-onafhankelijk en
ondersteunt de varianten `leaderboard`, `in-feed`, `rectangle` en
`mobile-banner`.

```env
NEXT_PUBLIC_ADS_ENABLED="true"
NEXT_PUBLIC_AD_PROVIDER="adsense"
NEXT_PUBLIC_ADSENSE_CLIENT_ID="ca-pub-XXXXXXXX"
```

Regels die in de code zijn vastgelegd: geen advertentie in de hero, de eerste
advertentie pas na minimaal acht productkaarten, één advertentie tussen de
redactionele secties, één op de productpagina onder de primaire informatie, altijd
gemarkeerd als "Advertentie", nooit over de deal-CTA en met vooraf gereserveerde
hoogte. Zolang de benodigde environment variables ontbreken, wordt er geen
providerscript geladen.

## Anthropic-provider instellen

`EditorialContentProvider` heeft drie implementaties:

- `fixture` — handgeschreven demo-content (geen externe dienst);
- `template` — deterministische Nederlandse templatecontent (standaard);
- `anthropic` — genereert content met de Claude API.

```env
CONTENT_PROVIDER="anthropic"
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-opus-5"
```

Zonder API-key werkt de site volledig door met fixture- en templatecontent; de
dagelijkse job crasht niet en kandidaten krijgen waar nodig de status
`NEEDS_REVIEW`. De AI krijgt alleen gecontroleerde productfeiten, de output wordt
met Zod gevalideerd, er is maximaal één gecontroleerde retry en daarna volgt een
terugval op templatecontent. Prijzen en kortingen worden altijd door de
applicatie berekend, nooit door het model. Een Enterprise-login is geen
productie-API-key: gebruik een echte API-key uit de Anthropic Console.

## Live bron met echte productfoto's

Naast de fictieve demo-fixtures staat er één bron in `src/merchants/sources/live-sources.ts`
die daadwerkelijk over HTTP wordt ingelezen, zodat de hele keten — fetch,
parsing, normalisatie, deduplicatie, `ScrapeRun`, `next/image` — met echte data
en echte foto's te controleren is.

| | |
| --- | --- |
| Merchant | `odoo-democatalogus` |
| Bron | `https://raw.githubusercontent.com/odoo/odoo/master/addons/product/data/product_demo.xml` |
| Adapter | `HTML` (Cheerio, selectors in `Merchant.configuration`) |
| Herkomst | democatalogus van Odoo (`odoo/odoo`, LGPL-3.0), foto's op `raw.githubusercontent.com` |
| Resultaat | 27 producten met echte titels, prijzen en productfoto's |

Waarom dit mag: het gaat om publieke, open gelicentieerde broncode op de
ongeauthenticeerde CDN van GitHub. Er wordt niets omzeild, geen anti-bot, geen
browser, één GET per run, met de user-agent uit `SCRAPER_USER_AGENT`. Er wordt
geen Nederlandse winkel gescraped: dat mag alleen met expliciete toestemming en
staat daarom uit (`scrapingAllowed = false` voor alle andere merchants).

Wat deze bron bewust **niet** doet:

- **Geen referentieprijs.** De bron levert alleen een actuele prijs. Er wordt
  geen was-prijs verzonnen, dus deze producten krijgen geen kortingspercentage
  en komen niet in de dagelijkse deal-editie. Ze zijn wel te zien op `/nieuw`,
  in de categorie, in de zoekresultaten en op hun eigen productpagina.
- **Niet te koop.** `markAsDemo` staat aan: de producten dragen het label
  "Demo", zijn `noindex` en de knop verwijst naar de bronpagina in plaats van
  naar een winkel. De demo-melding op de productpagina zegt dit letterlijk en
  verschilt van de melding bij de verzonnen fixtures.
- **Geen Nederlandse brontekst.** Titels en de regel achter "Brondata" komen
  onbewerkt uit de bron; de Nederlandse tekst eromheen komt van de
  contentprovider en staat op `NEEDS_REVIEW` tot de redactie haar nakijkt.

Opnieuw uitlezen of verwijderen:

```bash
pnpm job:ingest odoo-democatalogus
psql "$DATABASE_URL" -c $'UPDATE "Merchant" SET enabled = false WHERE slug = \'odoo-democatalogus\';'
```

## Nieuwe merchant toevoegen

1. **Adapter kiezen.** Er zijn adapters voor `FIXTURE`, `JSON`, `CSV` en `HTML`.
   Een nieuwe bron toevoegen betekent: adapter schrijven in
   `src/merchants/adapters/`, registreren in `src/merchants/adapters/index.ts` en
   een `Merchant`-record met configuratie aanmaken.
2. **Merchant aanmaken** (voorbeeld voor een JSON-feed):

```sql
INSERT INTO "Merchant" (id, name, slug, domain, "sourceType", enabled, "scrapingAllowed", "feedUrl", "trustScore", configuration, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'Voorbeeldwinkel', 'voorbeeldwinkel', 'voorbeeldwinkel.nl', 'JSON', true, false,
        'https://voorbeeldwinkel.nl/feed.json', 70, '{}'::jsonb, now(), now());
```

3. **Configuratie invullen** (`Merchant.configuration`, gevalideerd met Zod):

**JSON-feed**

```json
{
  "itemsPath": "data.products",
  "defaultCurrency": "EUR",
  "mapping": {
    "externalId": "sku",
    "title": "name",
    "price": "price.current",
    "referencePrice": "price.was",
    "referencePriceType": "MERCHANT_WAS_PRICE",
    "stock": "availability",
    "url": "url",
    "imageUrl": "images.0",
    "brand": "brand",
    "ean": "gtin",
    "category": "category",
    "description": "short_description",
    "specifications": { "Kleur": "attributes.colour" }
  },
  "categoryMapping": { "Woonkamer": "Wonen & Design" }
}
```

**CSV-feed** — zelfde `mapping`, maar met kolomnamen en optioneel `delimiter`:

```json
{
  "delimiter": ";",
  "mapping": { "externalId": "sku", "title": "titel", "price": "prijs", "url": "link", "imageUrl": "afbeelding" }
}
```

**HTML-adapter** — alleen wanneer de bron scraping expliciet toestaat
(`scrapingAllowed = true`):

```json
{
  "listUrl": "https://voorbeeldwinkel.nl/aanbiedingen",
  "imageBaseUrl": "https://cdn.voorbeeldwinkel.nl/",
  "itemSelector": "li.product",
  "requiresBrowser": false,
  "markAsDemo": false,
  "fields": {
    "title": { "selector": "h2" },
    "price": { "selector": ".price" },
    "referencePrice": { "selector": ".was-price" },
    "referencePriceType": "MERCHANT_WAS_PRICE",
    "url": { "selector": "a", "attribute": "href" },
    "imageUrl": { "selector": "img", "attribute": "src" }
  }
}
```

Optioneel bij de HTML-adapter: `imageBaseUrl` lost relatieve afbeeldingspaden op
tegen een andere basis dan `listUrl`, `fields.url` mag ontbreken (dan verwijst de
knop naar `listUrl`) en `markAsDemo` markeert alles uit deze bron als
demo-inhoud met `noindex`. Zet `autoPublish: true` in de configuratie alleen
wanneer nieuwe producten zonder handmatige goedkeuring online mogen; standaard
komen ze als `CANDIDATE` in `/admin/producten`.

4. **Afbeeldingsdomein toestaan** in `src/merchants/image-hosts.ts` (centrale
   lijst voor `next/image`).
5. **Testen:** `pnpm job:ingest <slug>` en daarna `/admin/producten?status=CANDIDATE`.

Regels die de adapters afdwingen: officiële feeds of API's hebben voorrang,
scraping alleen waar dat expliciet is toegestaan, geen omzeiling van
anti-botbeveiliging, geen CAPTCHA-omzeiling, geen stealthbrowser, geen
proxyrotatie, nooit scrapen tijdens een paginaweergave, time-outs, retries met
backoff, rate limiting per host, veilige prijsparsing en voorraadnormalisatie.
Rijen zonder prijs, afbeelding of URL worden overgeslagen in plaats van half
opgeslagen.

## Affiliate-URL's toevoegen

Alle externe knoppen lopen al via `/go/[offerId]`. Vul `Offer.affiliateUrl` en de
route gebruikt die automatisch; is het veld leeg, dan valt zij terug op
`destinationUrl`. Ongeldige of niet-http(s)-bestemmingen worden geweigerd,
kliks worden vastgelegd in `OutboundClick` en de doorverwijzing is tijdelijk
(307). Uitgaande links krijgen `rel="sponsored nofollow noopener"`. De frontend
hoeft dus niet te veranderen. Vermeld het affiliateprogramma daarna op
`/affiliateverklaring`.

## Demo-inhoud verwijderen

```bash
# 1. Geen demo-inhoud meer seeden
echo 'SEED_DEMO_CONTENT="false"' >> .env

# 2. Bestaande demo-data verwijderen (producten, aanbiedingen en editie-items)
psql "$DATABASE_URL" -c 'DELETE FROM "Product" WHERE "isDemo" = true;'
psql "$DATABASE_URL" -c $'DELETE FROM "Merchant" WHERE slug LIKE \'demo-%\';'
psql "$DATABASE_URL" -c $'DELETE FROM "Merchant" WHERE slug = \'odoo-democatalogus\';'

# 3. Nieuwe editie samenstellen uit echte producten
pnpm job:daily
```

Demo-producten zijn altijd `noindex` en zichtbaar gemarkeerd met het label
"Demo", zodat ze nooit als echte deal kunnen worden gelezen.

## Deployment op een Linux-VPS

Zonder Docker:

```bash
sudo apt install -y nodejs npm postgresql
sudo corepack enable
git clone <repo> /var/www/homeandlivingdeals && cd /var/www/homeandlivingdeals
cp .env.example .env && nano .env          # DATABASE_URL, CRON_SECRET, ADMIN_*
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm build
```

Systemd-unit (`/etc/systemd/system/hald.service`):

```ini
[Unit]
Description=HomeAndLivingDeals
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/var/www/homeandlivingdeals
EnvironmentFile=/var/www/homeandlivingdeals/.env
ExecStart=/usr/bin/pnpm start
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

Daarna `sudo systemctl enable --now hald`, een reverse proxy (nginx of Caddy) met
TLS ervoor, en de crontab uit [Dagelijkse job en cron](#dagelijkse-job-en-cron).
Met Docker: `docker compose up -d --build` en de reverse proxy naar poort 3000.

## Projectstructuur

```
src/
  app/
    (site)/            publieke routes met header, categoriebalk en footer
    admin/             beveiligd adminpaneel (eigen layout, altijd noindex)
    api/               saves, events, cron/daily, health
    go/[offerId]/      centrale uitgaande route voor affiliate-links
  components/          ads/, layout/, product/, editorial/, seo/, ui/
  lib/
    ai/                EditorialContentProvider (fixture | template | anthropic)
    analytics/          interne eventlaag
    database/           Prisma-client en alle queries
    deals/              dedupe, score, editieselectie, editiedatum, outbound
    pricing/            geld, korting, staleness (één centrale bron)
    saves/              bezoekers-ID en bewaarstore
    scraping/           http, csv, normalisatie, rate limiting, browser
    seo/                metadata en JSON-LD
  merchants/
    adapters/           fixture, json-feed, csv-feed, html, registry
    fixtures/           demo-merchants en demo-producten
    sources/            live bron(nen) die echt over HTTP worden ingelezen
    schemas/            Zod-schema's voor feedconfiguratie
  jobs/                daily, ingest, content en de gedeelde pipeline
  types/               view-modellen
prisma/                schema, migraties, seed
public/demo/           originele SVG-illustraties voor demo-producten
scripts/               generator voor de demo-illustraties
tests/unit, tests/e2e  Vitest en Playwright
```

## Wat nodig is voor de eerste echte merchant

Om een echte aanbieder aan te sluiten hebben wij deze gegevens nodig:

1. **Naam van de merchant** — zoals wij die bij elk product mogen tonen.
2. **Domein** — inclusief het CDN-domein van de productafbeeldingen.
3. **Affiliateprogramma** — netwerk of eigen programma, plus de manier waarop een
   trackinglink wordt opgebouwd (parameter, subid, deeplinkformaat).
4. **Feed, API of toegestane scrape-URL** — bij voorkeur een officiële feed of
   API. Bij scraping: schriftelijke toestemming en de exacte URL('s).
5. **Toegestane productcategorieën** — welk deel van het assortiment wij mogen
   publiceren.
6. **Veld met de huidige prijs** — inclusief valuta en of btw is inbegrepen.
7. **Veld met de vergelijkingsprijs** — en welk type dat is (van-prijs van de
   winkel, adviesprijs van de fabrikant, of iets anders). Zonder betrouwbare
   vergelijkingsprijs publiceren wij geen korting.
8. **Voorraadveld** — en welke waarden "op voorraad" betekenen.
9. **Product-ID en/of EAN** — nodig voor deduplicatie en stabiele URL's.
10. **Afbeeldingsveld** — bij voorkeur één afbeelding van minimaal 800 × 800.
11. **Gewenste updatefrequentie** — hoe vaak wij de feed mogen ophalen.
12. **Eventuele rate limits** — maximaal aantal requests per minuut, toegestane
    tijdvensters en of een user-agent of API-key vereist is.
