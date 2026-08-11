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
2. [Productiemodi en functievlaggen](#productiemodi-en-functievlaggen)
3. [Environment variables](#environment-variables)
4. [Database: migraties en seeden](#database-migraties-en-seeden)
5. [Development starten](#development-starten)
6. [Production build](#production-build)
7. [Docker Compose (lokaal)](#docker-compose-lokaal)
8. [Deployment op een Linux-VPS](#deployment-op-een-linux-vps)
9. [Back-ups en herstel](#back-ups-en-herstel)
10. [Beveiliging](#beveiliging)
11. [Tests, CI en kwaliteit](#tests-ci-en-kwaliteit)
12. [DEAL en DISCOVERY](#deal-en-discovery)
13. [Contentkwaliteit](#contentkwaliteit)
14. [Dagelijkse job, worker en cron](#dagelijkse-job-worker-en-cron)
15. [Adminpaneel](#adminpaneel)
16. [Advertenties inschakelen](#advertenties-inschakelen)
17. [Anthropic-provider instellen](#anthropic-provider-instellen)
18. [Live bron met echte productfoto's](#live-bron-met-echte-productfotos)
19. [Nieuwe merchant toevoegen](#nieuwe-merchant-toevoegen)
20. [Affiliate-URL's toevoegen](#affiliate-urls-toevoegen)
21. [Demo-inhoud uitzetten](#demo-inhoud-uitzetten)
22. [Projectstructuur](#projectstructuur)
23. [Wat nodig is voor de eerste echte merchant](#wat-nodig-is-voor-de-eerste-echte-merchant)

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

Daarna in één keer draaien met demo-inhoud:

```bash
pnpm db:migrate:dev     # schema aanmaken
pnpm db:seed:demo       # demo-merchants, demo-producten en één editie
pnpm dev                # http://localhost:3000
```

## Productiemodi en functievlaggen

`APP_ENV` bepaalt de modus en staat **los van** `NODE_ENV`: `next build` zet
`NODE_ENV=production`, terwijl een build nog geen productieomgeving is. Productie
is daarom altijd een expliciete keuze.

| | `development` | `test` | `production` |
| --- | --- | --- | --- |
| `APP_ENV` | `development` (standaard) | `test` | `production` |
| Demo-inhoud (`DEMO_CONTENT_ENABLED`) | standaard **aan** | standaard **aan** | standaard **uit**, en `true` is een startfout |
| Demo-seed (`pnpm db:seed`) | draait | draait | doet niets |
| Fixture- en democatalogusbronnen | worden ingelezen | worden ingelezen | worden overgeslagen |
| Advertentieposities | placeholder in de pagina | geen | alleen met `ADS_ENABLED=true` |
| Ontbrekende secrets | waarschuwing in de log | idem | **app start niet** |

Vier vlaggen, allemaal `"true"` of `"false"`:

| Vlag | Standaard | Effect |
| --- | --- | --- |
| `DEMO_CONTENT_ENABLED` | aan buiten productie | Demo-producten zijn zichtbaar en seedbaar; uit betekent dat ze uit élke publieke query verdwijnen (homepage, categorie, zoeken, bewaard, editie) en dat hun productpagina een 404 geeft. Demobronnen worden dan ook niet ingelezen. |
| `SEARCH_ENGINE_INDEXING_ENABLED` | uit | Uit betekent: de hele site krijgt `noindex, nofollow`, `robots.txt` blokkeert alles en de sitemap is leeg. Zet pas aan bij de echte livegang. |
| `ADS_ENABLED` | uit | Server-side hoofdschakelaar voor advertentieposities. `NEXT_PUBLIC_ADS_ENABLED` moet dezelfde waarde hebben voor de clientcomponenten. |
| `AFFILIATE_LINKS_ENABLED` | uit | Uit betekent dat `/go/[offerId]` altijd rechtstreeks naar de winkel gaat, ook wanneer er al een affiliate-URL bij een aanbieding staat. |

Wat productie afdwingt (zie `productionConfigProblems` in `src/lib/env.ts`):
`DATABASE_URL`, een **https**-`NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` van minimaal
24 tekens, `ADMIN_USERNAME`, een `ADMIN_PASSWORD` van minimaal 12 tekens, een
`ADMIN_SESSION_SECRET` van minimaal 32 tekens, geen voorbeeldwaarden,
`DEMO_CONTENT_ENABLED=false` en een `ANTHROPIC_API_KEY` zodra
`CONTENT_PROVIDER=anthropic`. De controle draait bij het starten van de server
(`src/instrumentation.ts`) en in elke job; ontbreekt er iets, dan stopt het
proces met een lijst van problemen — nooit met de waarde van een secret.

## Environment variables

Alle variabelen staan met uitleg in `.env.example`. De belangrijkste:

| Variabele | Verplicht | Uitleg |
| --- | --- | --- |
| `APP_ENV` | nee | `development` (standaard), `test` of `production`. |
| `DATABASE_URL` | ja | PostgreSQL-verbinding (Prisma 7 leest deze via `prisma.config.ts`). |
| `NEXT_PUBLIC_SITE_URL` | ja in productie | Basis-URL voor canonicals, sitemap en Open Graph; in productie verplicht https. |
| `DEMO_CONTENT_ENABLED` | nee | Demo-inhoud zichtbaar en seedbaar. Standaard uit in productie. |
| `SEARCH_ENGINE_INDEXING_ENABLED` | nee | Uit betekent noindex voor de hele site. Standaard uit. |
| `ADS_ENABLED` | nee | Server-side hoofdschakelaar voor advertenties. |
| `AFFILIATE_LINKS_ENABLED` | nee | Laat `/go/[offerId]` affiliate-URL's gebruiken. |
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
| `WORKER_DAILY_HOUR`, `WORKER_DAILY_MINUTE` | nee | Tijdstip van de worker-run (Europe/Amsterdam), standaard 06:15. |
| `POSTGRES_*`, `SITE_DOMAIN`, `ACME_EMAIL` | alleen Docker | Databasegegevens en het domein plus e-mailadres voor Caddy. |

## Database: migraties en seeden

```bash
pnpm db:migrate                # veilig migratiecommando: past alleen bestaande
                               # migraties toe (prisma migrate deploy)
pnpm db:migrate:dev            # development: nieuwe migratie maken
pnpm db:seed                   # demo-inhoud, alleen buiten productie
pnpm db:seed:demo              # zelfde, met de vlaggen expliciet aan
pnpm db:reset                  # database leegmaken en opnieuw seeden
```

`pnpm db:migrate` is het commando voor productie en voor de `migrate`-service in
Docker: het genereert nooit een nieuwe migratie en past alleen toe wat al in
`prisma/migrations/` staat. Nieuwe migraties maak je op je eigen machine met
`pnpm db:migrate:dev` en commit je mee.

De seed maakt 8 fictieve demo-merchants, 26 demo-producten (`isDemo = true`,
noindex), redactionele fixturecontent en één gepubliceerde editie voor vandaag.
**In productie doet de seed niets**, ook niet wanneer iemand
`DEMO_CONTENT_ENABLED=true` zet. Save- en klikdata komen nooit in de seed: die
staan alleen in `tests/fixtures/` en worden alleen door tests gebruikt.

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

## Docker Compose (lokaal)

```bash
cp .env.example .env       # waarden aanpassen
docker compose up --build  # http://localhost:3000
```

De stack bestaat uit:

- `db` — PostgreSQL 17 met healthcheck (`pg_isready`) en een named volume;
- `migrate` — eenmalige stap die `pnpm db:migrate` en de seed uitvoert;
- `app` — de Next.js-app (standalone output, non-root user) met een healthcheck
  op `/api/health`.

De app start pas nadat de migraties succesvol zijn afgerond
(`service_completed_successfully`). Voor een VPS met een echt domein en HTTPS is
er een aparte stack; zie hieronder.

## Deployment op een Linux-VPS

Vereisten: een server met Docker en Docker Compose, een domeinnaam waarvan de
A- of AAAA-record naar de server wijst, en poort 80 en 443 open (Caddy heeft
poort 80 nodig voor de certificaataanvraag).

```bash
git clone <repo-url> /srv/homeandlivingdeals
cd /srv/homeandlivingdeals
cp .env.example .env
# .env invullen: APP_ENV=production, SITE_DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD,
# NEXT_PUBLIC_SITE_URL=https://<domein>, CRON_SECRET, ADMIN_*.
# Secrets genereren: openssl rand -base64 36
docker compose -f docker-compose.production.yml up -d --build
```

De productiestack:

| Service | Rol |
| --- | --- |
| `caddy` | Reverse proxy met automatische HTTPS (Let's Encrypt), gzip/zstd, HSTS en `no-store` voor `/api/*` en `/go/*`. Configuratie in `deploy/Caddyfile`, certificaten in het volume `caddy-data`. |
| `db` | PostgreSQL 17. **Publiceert geen poort**: alleen de app en de worker in het Docker-netwerk komen erbij. Data in het volume `postgres-data`. |
| `migrate` | Eenmalige stap: `pnpm db:migrate`. Geen seed. De app start pas als deze stap klaar is. |
| `app` | De Next.js-app, non-root, healthcheck op `/api/ready` (database én configuratie). |
| `worker` | Draait de dagelijkse pipeline om `WORKER_DAILY_HOUR:WORKER_DAILY_MINUTE` (Europe/Amsterdam). |
| `backup` | Profiel `backup`: `pg_dump` naar `./backups`, houdt zeven dumps. Zie [Back-ups en herstel](#back-ups-en-herstel). |

Alle services hebben `restart: unless-stopped` (behalve de eenmalige `migrate`
en `backup`, die `restart: "no"` hebben).

Controleren en bijwerken:

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f app worker
curl -fsS https://<domein>/api/health     # {"status":"ok"}
curl -fsS https://<domein>/api/ready      # database + configuratie

git pull && docker compose -f docker-compose.production.yml up -d --build
```

Zonder Docker kan het ook met een systemd-service en een losse Caddy of Nginx;
de app is dan `node .next/standalone/server.js` na `NEXT_OUTPUT_STANDALONE=1
pnpm build`.

## Back-ups en herstel

```bash
pnpm db:backup                               # pg_dump naar ./backups, houdt 7 dumps
pnpm db:restore                              # nieuwste dump -> <database>_restoretest
pnpm db:restore backups/homeandlivingdeals-<stamp>.dump
```

`scripts/backup-database.sh` maakt een dump in het custom format (`-Fc`),
schrijft eerst naar `.partial` en hernoemt pas na succes, en verwijdert daarna
alles boven de zeven nieuwste dumps (`BACKUP_KEEP` past dat aan).

In Docker draait de back-up als eigen service. Zet dit in de crontab van de
host:

```cron
CRON_TZ=Europe/Amsterdam
15 3 * * * cd /srv/homeandlivingdeals && docker compose -f docker-compose.production.yml --profile backup run --rm backup >> /var/log/hald-backup.log 2>&1
```

**Herstellen oefenen.** `scripts/restore-database.sh` zet standaard terug in een
aparte database (`<naam>_restoretest`), maakt die aan wanneer zij nog niet
bestaat, en telt daarna producten, aanbiedingen en edities. Doe dit minstens één
keer per kwartaal; een back-up die je nooit hebt teruggezet is geen back-up. Wil
je echt over de productiedatabase heen: geef `RESTORE_TARGET_URL` expliciet op.

**Off-site.** De dumps staan op dezelfde machine als de database. Voeg één regel
toe aan het einde van `scripts/backup-database.sh` zodra er een off-site doel is:

```bash
rclone copy "$target" "remote:homeandlivingdeals/db"   # S3, B2, Storage Box
restic -r "$RESTIC_REPOSITORY" backup "$BACKUP_DIR"    # met versleuteling
scp "$target" backup@offsite.example:/srv/hald/        # simpelste variant
```

Bewaar de sleutel of het wachtwoord niet op dezelfde server, en houd de retentie
off-site langer dan de zeven lokale dumps.

## Beveiliging

`SECURITY.md` beschrijft het meldpunt, alle maatregelen en wat bewust niet is
geregeld. Kort samengevat:

- adminroutes achter een login met een ondertekende, httpOnly sessiecookie;
- `/api/cron/daily` vraagt `Authorization: Bearer $CRON_SECRET`;
- rate limiting op `/api/saves`, `/api/events`, `/go/[offerId]` en `/zoeken`;
- CSRF-controle op de JSON-endpoints die iets wijzigen;
- alleen absolute `http`- en `https`-bestemmingen bij uitgaande links;
- security headers (CSP, HSTS in productie, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`) via `src/lib/security/headers.ts`;
- de logger vervangt wachtwoorden, tokens, cookies en verbindingsgegevens door
  `[verborgen]`.

## Tests, CI en kwaliteit

```bash
pnpm lint         # ESLint (next/core-web-vitals + next/typescript)
pnpm typecheck    # tsc --noEmit, strict + noUncheckedIndexedAccess
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright smoketest (start zelf een dev-server)
```

Unit tests dekken prijsberekening en kortingspercentages, ongeldige
referentieprijzen, het onderscheid tussen DEAL en DISCOVERY, deduplicatie, de
samengestelde selectiescore, de dagelijkse editieselectie (inclusief de limieten
per categorie en merchant), de kwaliteitspoort voor redactionele content, de
taalcontrole, redirectveiligheid en de affiliatevlag, feedmapping, de
HTML-adapter, dubbele saves, de productiemodi (inclusief "productie seedt geen
demo-inhoud" en "app start niet zonder secrets"), noindex voor demo en
technische pagina's, structured data alleen bij echte productdata, de security
headers, redactie van secrets in de log, en `/api/health` plus `/api/ready`.

Twee testbestanden gebruiken een echte database wanneer `DATABASE_URL` is gezet
en slaan zichzelf anders over: `saves.test.ts` (dubbele saves) en
`demo-visibility.test.ts` (demo-inhoud verdwijnt uit alle publieke queries).

CI (`.github/workflows/ci.yml`) draait op elke push en pull request:
dependencies installeren, lint, typecheck, unit tests en een productiebuild. De
workflow gebruikt geen secrets en deployt niet.

De Playwright-smoketest draait standaard tegen `next dev` (zodat de
advertentieplaceholder gecontroleerd kan worden) op desktop (1440 × 900) en
mobiel (390 × 844). Tegen een productiebuild testen:

```bash
pnpm build && PLAYWRIGHT_DEV=0 pnpm test:e2e
```

## DEAL en DISCOVERY

Een product wordt op twee manieren gepresenteerd. Het verschil zit volledig in
`computeDealPricing` (`src/lib/pricing/deal.ts`); de UI leest alleen
`pricing.kind`.

| | `DEAL` | `DISCOVERY` |
| --- | --- | --- |
| Voorwaarden | actuele prijs, geldige referentieprijs, referentieprijstype, huidige prijs lager dan de referentieprijs, recent gecontroleerd (< 24 uur) en op voorraad | alles wat niet aan alle zes voorwaarden voldoet |
| Van-prijs | doorgestreept zichtbaar | niet zichtbaar |
| Besparing en percentage | zichtbaar | niet zichtbaar |
| Badge | `-25%` bij 20% of meer | geen kortingsbadge |
| CTA | koraalrode knop **Bekijk deal** | rustige outline-knop **Bekijk product** |

Daarnaast is er `qualifiesAsDeal`: een DEAL met minimaal 5% korting. Alleen die
producten komen in de dagelijkse editie, in een dealssectie en achter het
dealfilter op een categoriepagina. Een product zonder geldige referentieprijs
kan daar dus nooit terechtkomen — dat is één regel op één plek, en er zijn tests
voor elk van de zes voorwaarden.

## Contentkwaliteit

Redactionele tekst gaat door een harde poort voordat zij wordt opgeslagen
(`validateEditorialContent` in `src/lib/ai/schema.ts`). Geblokkeerd wordt: lege
velden, placeholders (`lorem ipsum`, `TODO`, `{{...}}`, HTML), tekst die niet
Nederlands is, velden die een kopie van elkaar zijn, prijzen of
kortingspercentages in redactionele tekst, tekst volledig in hoofdletters, en een
zin die zich drie keer herhaalt.

Wat er gebeurt bij een blokkade: de content wordt **niet** opgeslagen, bestaande
content blijft staan, en het product gaat naar status `NEEDS_REVIEW` — dus uit de
publieke lijsten totdat iemand in `/admin/producten` kijkt. Het aantal
geblokkeerde items staat in de uitvoer van `pnpm job:content` en in de log van de
dagelijkse pipeline.

Verder:

- productkaarten tonen maximaal twee regels kop (`line-clamp-2`) en drie tot vier
  regels teaser (`line-clamp-3 sm:line-clamp-4`);
- de templateprovider kiest per product een andere invalshoek en andere
  verbindende zinnen, zodat er geen zin in élke beschrijving staat;
- Engelse brondata van een leverancier wordt niet overgenomen in de Nederlandse
  tekst en niet als "Brondata" op de productpagina getoond (`looksDutch` in
  `src/lib/ai/language.ts`).

## Dagelijkse job, worker en cron

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

**Worker in plaats van crontab.** De productiestack heeft een `worker`-service
die hetzelfde doet zonder crontab:

```bash
pnpm job:worker    # blijft draaien en start de pipeline om WORKER_DAILY_HOUR:MINUTE
```

De worker kijkt elke minuut of het tijdstip in `Europe/Amsterdam` is bereikt en
of er vandaag al een run was. Dat is zomertijdproof, en een mislukte run stopt de
worker niet. Zet `WORKER_RUN_ON_START=true` om direct bij het starten één run te
doen. Gebruik óf de worker, óf de crontab — niet beide.

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

## Demo-inhoud uitzetten

In productie (`APP_ENV=production`) staat demo-inhoud al uit: demo-producten
verdwijnen uit elke publieke query, hun productpagina geeft 404, demobronnen
worden niet ingelezen en de seed doet niets. De rijen blijven wel in de database
staan. Zo ruim je ze op:

```bash
# 1. Vlag uit (in productie al de standaard)
echo 'DEMO_CONTENT_ENABLED="false"' >> .env

# 2. Bestaande demo-data verwijderen (producten, aanbiedingen en editie-items)
psql "$DATABASE_URL" -c 'DELETE FROM "Product" WHERE "isDemo" = true;'
psql "$DATABASE_URL" -c $'DELETE FROM "Merchant" WHERE slug LIKE \'demo-%\';'
psql "$DATABASE_URL" -c $'DELETE FROM "Merchant" WHERE slug = \'odoo-democatalogus\';'

# 3. Nieuwe editie samenstellen uit echte producten
pnpm job:daily
```

Demo-producten zijn altijd `noindex` en zichtbaar gemarkeerd met het label
"Demo", zodat ze nooit als echte deal kunnen worden gelezen.

## Projectstructuur

```
src/
  app/
    (site)/            publieke routes met header, categoriebalk en footer
    admin/             beveiligd adminpaneel (eigen layout, altijd noindex)
    api/               saves, events, cron/daily, health, ready
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
    security/           security headers, rate limiting en CSRF
    seo/                metadata en JSON-LD
  merchants/
    adapters/           fixture, json-feed, csv-feed, html, registry
    fixtures/           demo-merchants en demo-producten
    sources/            live bron(nen) die echt over HTTP worden ingelezen
    schemas/            Zod-schema's voor feedconfiguratie
  jobs/                daily, ingest, content, worker en de gedeelde pipeline
  instrumentation.ts   controle van de productieconfiguratie bij het starten
  types/               view-modellen
prisma/                schema, migraties, seed
deploy/Caddyfile       reverse proxy met automatische HTTPS
public/demo/           originele SVG-illustraties voor demo-producten
scripts/               demo-illustraties, back-up en herstel
tests/unit, tests/e2e  Vitest en Playwright
.github/workflows/     CI: lint, typecheck, tests en productiebuild
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
