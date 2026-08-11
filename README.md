# HomeAndLivingDeals.nl

Nederlands discovery-commerce magazine voor verrassende, slimme, mooie en soms
licht absurde producten voor in en om het huis. Elke koopknop verwijst naar de
aanbieder via één centrale route (`/go/[offerId]`), zodat affiliate-links zonder
frontendwijziging kunnen worden aangesloten.

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
13. [Afbeeldingen: validatie en terugval](#afbeeldingen-validatie-en-terugval)
14. [Publicatiestatussen en wat publiek is](#publicatiestatussen-en-wat-publiek-is)
15. [Onze eigen prijsanalyse](#onze-eigen-prijsanalyse)
16. [Contentkwaliteit](#contentkwaliteit)
17. [Dagelijkse job, worker en cron](#dagelijkse-job-worker-en-cron)
18. [Adminpaneel](#adminpaneel)
19. [Advertenties inschakelen](#advertenties-inschakelen)
20. [Anthropic-provider instellen](#anthropic-provider-instellen)
21. [Live bron met echte productfoto's](#live-bron-met-echte-productfotos)
22. [Nieuwe merchant toevoegen](#nieuwe-merchant-toevoegen)
23. [Affiliatenetwerken en trackinglinks](#affiliatenetwerken-en-trackinglinks)
24. [Demo-inhoud uitzetten](#demo-inhoud-uitzetten)
25. [Projectstructuur](#projectstructuur)
26. [Wat nodig is voor de eerste echte merchant](#wat-nodig-is-voor-de-eerste-echte-merchant)

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
| `EDITION_MIN_ADDITIONAL_ITEMS` | nee | Minimum aantal producten naast de hero, standaard 8. Wordt dat niet gehaald, dan blijft de vorige editie staan. |
| `EDITION_TARGET_ADDITIONAL_ITEMS` | nee | Streefaantal, standaard 16. |
| `EDITION_MAX_ADDITIONAL_ITEMS` | nee | Maximum, standaard 24. `min ≤ target ≤ max` wordt afgedwongen. |
| `MAX_PER_MERCHANT` | nee | Maximaal aantal producten van dezelfde merchant in één editie, standaard 3. |
| `MAX_PER_CATEGORY` | nee | Maximaal aantal producten uit dezelfde categorie, standaard 4. |
| `IMAGE_MIN_DIMENSION` | nee | Minimale breedte én hoogte in pixels, standaard 400. Kleiner wordt afgekeurd. |
| `NEXT_IMAGE_EXTRA_HOSTS` | nee | Komma-gescheiden hostnamen die `next/image` mag optimaliseren, voor merchant-CDN's. |
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

Daar komen de controles van deze fase bij:

| Onderwerp | Bestand |
| --- | --- |
| Geldige en ongeldige afbeeldingen, SSRF, redirects, retry, terugval, absolute JSON-LD-URL | `images.test.ts` |
| Laagste prijs in 30 dagen, mediaan over 90 dagen, te weinig historie, nieuwe prijsdaling, aanbiedersvergelijking | `price-analysis.test.ts` |
| Alleen `PUBLISHED` publiek (per status), adminpreview voor een concept, sitemap, promotie van `DRAFT` | `public-access.test.ts` |
| `affiliateUrl` uit de feed, XML-feed, gzip-feed, authenticatieconfiguratie, veilige subid, niet-geconfigureerde netwerkconnector | `affiliate.test.ts` |
| AI mag geen eerstehandservaring claimen; prijsuitspraken staan niet in de tekst | `ai-grounding.test.ts` |
| Minimum van acht producten, dezelfde deal op opeenvolgende dagen, DISCOVERY zonder valse korting | `edition.test.ts` |
| De afgeschafte zin over eigen verkoop komt nergens meer voor, en de vaste UI-teksten staan er wel | `copy-hygiene.test.ts` |

Drie testbestanden gebruiken een echte database wanneer `DATABASE_URL` is gezet
en slaan zichzelf anders over: `saves.test.ts` (dubbele saves),
`demo-visibility.test.ts` (demo-inhoud verdwijnt uit alle publieke queries) en
`public-access.test.ts` (elke productstatus).

De Playwright-tests dekken naast de smoketest ook kapotte afbeeldingen
(`tests/e2e/images.spec.ts`): de placeholder is bereikbaar, een mislukte
afbeelding valt erop terug zonder layout shift, de productpagina blijft werken en
een melding van een kapotte afbeelding haalt het product niet offline.

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

## Afbeeldingen: validatie en terugval

Een product zonder werkende afbeelding komt niet publiek. Dat wordt op vier
plekken vastgehouden.

**1. Serverzijdige validatie** (`src/lib/images/validate.ts`). Een URL is pas
goed wanneer alles klopt: `http` of `https`, HTTP 200, een `Content-Type` die met
`image/` begint, een bestand dat écht als afbeelding te lezen is (de bytes worden
gelezen, geen aanname op de extensie), minimaal `IMAGE_MIN_DIMENSION` × `IMAGE_MIN_DIMENSION`
pixels en minimaal 1 kB. Redirects worden gevolgd (maximaal drie) en bij elke hop
opnieuw gecontroleerd. Privé- en lokale adressen zijn uitgesloten — ook wanneer
een publieke hostnaam via DNS naar `127.0.0.1`, `10.x`, `192.168.x` of een
link-local adres wijst. Eén time-out van 8 seconden, precies één retry.

**2. Levenscyclus van `imageStatus`.**

| Status | Betekenis |
| --- | --- |
| `PENDING` | Nieuwe of gewijzigde URL, nog niet gecontroleerd. Niet publiek. |
| `VALID` | Gecontroleerd en goed. Alleen deze status is publiek. |
| `INVALID` | Afgekeurd, met de reden in `imageFailureReason`. Niet publiek. |

Regels bij de import: een rij zonder `imageUrl` wordt overgeslagen; een nieuwe
URL bij een bestaand product komt eerst in `imageSourceUrl` te staan en vervangt
de werkende afbeelding pas ná goedkeuring (`lastValidImageUrl` bewaart de laatst
werkende URL); een product met `INVALID` staat niet in de publieke grids, niet in
de dagelijkse editie, niet in de sitemap en niet in de structured data.

**3. Dagelijkse healthcheck.** `pnpm job:images` valideert alle `PENDING`-afbeeldingen
en controleert daarna de bestaande `VALID`-afbeeldingen opnieuw. Faalt een
afbeelding die eerder goed was en is er een `lastValidImageUrl`, dan wordt die
teruggezet en blijft het product publiek.

**4. Terugval in de browser.** `ProductImage` valt bij een `onError` terug op
`/image-unavailable.svg` — een lokale SVG in de huisstijl, in dezelfde vierkante
verhouding, dus zonder layout shift. Die melding gaat één keer naar
`/api/image-issue`, dat **alleen logt**: een bezoeker kan met een verzoekje geen
product offline halen. De volgende healthcheck bepaalt de echte status.

**Een CDN-domein toevoegen.** Drie lagen, in deze volgorde:

1. `src/merchants/image-hosts.ts` — hosts die bij de applicatie zelf horen;
2. `NEXT_IMAGE_EXTRA_HOSTS="cdn.winkel.nl,media.anderewinkel.nl"` — per omgeving,
   zonder codewijziging (wordt door `next.config.ts` gelezen, dus na wijzigen de
   server herstarten);
3. `Merchant.imageHosts` — per merchant; de validator staat dan alleen
   afbeeldingen van die hosts toe en `/admin/integraties` laat het zien.

Voor `next/image` moet de host in laag 1 of 2 staan. Laag 3 is de striktere
controle tijdens de import.

**Absolute URL's in JSON-LD en Open Graph.** `absoluteImageUrl`
(`src/lib/seo/metadata.ts`) laat een externe `https://cdn.merchant.nl/...`
ongewijzigd, maakt een lokaal pad absoluut tegen `NEXT_PUBLIC_SITE_URL` en levert
dus nooit `https://site.nl/https://cdn.merchant.nl/...`. Dezelfde functie wordt
gebruikt voor de Open Graph-afbeelding.

## Publicatiestatussen en wat publiek is

Publiek zichtbaar is één definitie op één plek: `publicProductFilter`
(`src/lib/products/visibility.ts`). Elke publieke query, de editie, de sitemap en
de structured data gebruiken haar.

Een product is publiek wanneer **alles** waar is: status `PUBLISHED`,
`imageStatus = VALID`, er is redactionele content, en het is geen demo-inhoud
zolang `DEMO_CONTENT_ENABLED` uit staat.

| Status | Betekenis | Publiek |
| --- | --- | --- |
| `CANDIDATE` | Nieuw van een echte merchant, wacht op goedkeuring in `/admin`. | 404 |
| `DRAFT` | Bedoeld om te publiceren, wacht op afbeelding en content. | 404 |
| `NEEDS_REVIEW` | Content moet door een mens worden nagekeken. | 404 |
| `PUBLISHED` | Goedgekeurd. | zichtbaar, mits afbeelding en content in orde |
| `REJECTED` | Afgewezen. | 404 |
| `ARCHIVED` | Uit de roulatie. | 404 |

Een 404 is een echte 404 (HTTP-status 404, `notFound()`), geen lege pagina met
status 200. Concepten zijn wél te bekijken in de beveiligde preview
`/admin/producten/<id>/preview`; daar staat ook waarom het product nog niet
publiek is en waar de tekst vandaan komt (provider, model, beoordeeld op,
`experienceType`, analyseversie).

`DRAFT` wordt automatisch `PUBLISHED` zodra de afbeelding is goedgekeurd en er
content is (`promotePublishableProducts`, onderdeel van `pnpm job:daily`).
`CANDIDATE` en `NEEDS_REVIEW` blijven staan tot een mens beslist.

## Onze eigen prijsanalyse

Alle prijsuitspraken komen uit onze eigen `PriceSnapshot`-metingen en worden met
gewone code berekend (`src/lib/analysis/price-analysis.ts`). **De AI berekent
geen prijzen, geen percentages en geen conclusies** — die staan ook niet in de
opgeslagen tekst, maar in een eigen sectie op de productpagina, rechtstreeks uit
de meetgegevens.

`pnpm job:analyze-prices` vult per product één `DealAnalysis`-rij met onder meer:
huidige prijs, vorige gemeten prijs, laagste prijs in 30 dagen, mediaan over 90
dagen, laagste prijs ooit, hoogste prijs in 90 dagen, prijswijziging in euro's en
procenten, aantal metingen, aantal vergeleken aanbieders, goedkoopste merchant,
verschil met de volgende aanbieder, eerste en laatste meting, moment van de
laatste prijswijziging, moment waarop de daling werd gezien, betrouwbaarheid
(`LOW` / `MEDIUM` / `HIGH`) en de analyseversie.

Wat de analyse **niet** doet:

- geen statistiek met te weinig metingen (minimaal 3, en 5 voor een mediaan);
- geen 30-dagenclaim zonder 30 dagen historie, geen 90-dagenclaim zonder 90 dagen;
- geen vermenging van de van-prijs van de winkel, de adviesprijs van de fabrikant
  en onze eigen gemeten prijs — die drie blijven gescheiden (`referencePriceType`);
- verzendkosten alleen in de vergelijking wanneer élke actieve aanbieding ze
  meelevert (anders staat er "prijs" in plaats van "prijs en verzending");
- geen zin waarvoor de data ontbreekt: dan staat er eerlijk dat er te weinig
  historie is.

De zinnen op de productpagina komen uit `src/lib/analysis/statements.ts`,
bijvoorbeeld: "Deze prijs ligt 18% onder onze 90-dagenmediaan.", "De prijs is
vandaag € 40 gedaald.", "Momenteel € 20 goedkoper dan de volgende aangesloten
aanbieder." en "Laagste door ons gemeten prijs in 30 dagen." De functie is puur en
deterministisch, dus volledig te testen.

**Aanbiedersvergelijking.** Onder "Prijzen bij aanbieders" staan alle actieve
aanbiedingen van hetzelfde product: merchant, huidige prijs, verzendkosten indien
bekend, voorraad, laatste controle, een dealknop en wie het goedkoopst is.
Producten worden gekoppeld in deze volgorde: 1. EAN/GTIN, 2. merk + exact model,
3. externe ID binnen dezelfde merchant, 4. genormaliseerde titel, 5. fuzzy —
en een fuzzy match wordt **nooit** automatisch samengevoegd: die komt als
`ProductMatchCandidate` in `/admin` te staan voor menselijke bevestiging.

## Contentkwaliteit

Redactionele tekst gaat door een harde poort voordat zij wordt opgeslagen
(`validateEditorialContent` in `src/lib/ai/schema.ts`). Geblokkeerd wordt: lege
velden, placeholders (`lorem ipsum`, `TODO`, `{{...}}`, HTML), tekst die niet
Nederlands is, velden die een kopie van elkaar zijn, prijzen of
kortingspercentages in redactionele tekst, tekst volledig in hoofdletters, een
zin die zich drie keer herhaalt, en eerstehandservaring die wij niet hebben.

**Onderbouwing en ervaring.** De provider krijgt alleen gecontroleerde feiten:
titel, merk, model, categorie, omschrijving van de aanbieder, gecontroleerde
specificaties, het aantal aanbieders dat wij volgen, de databronnen, het moment
van de laatste prijscontrole, bekende voor- en nadelen uit brondata, vergelijkbare
producten die wij zelf volgen en de eigen prijsanalyse als achtergrond.

`Product.experienceType` bepaalt wat er over ervaring mag staan:

| Waarde | Betekenis |
| --- | --- |
| `NOT_TESTED` | Wij kennen dit product alleen uit brondata. Standaard. |
| `DESK_RESEARCHED` | Bureauonderzoek: specificaties en bronnen vergeleken, niet gebruikt. |
| `HANDS_ON_TESTED` | De redactie heeft het product zelf gebruikt. |

Zonder `HANDS_ON_TESTED` mag de tekst **nooit** eigen ervaring suggereren:
zinnen als "wij hebben dit getest", "in onze test", "wij vonden" of "na twee
weken gebruik" worden geblokkeerd (`findExperienceClaims`), niet alleen ontraden.
Er komen geen verzonnen meningen, gebruikservaringen, geluidsbeleving,
kwaliteitsclaims of duurzaamheidsoordelen in de tekst. De site is een
deal-analyse- en discoveryplatform, geen reviewsite.

Bij elke tekst wordt vastgelegd waarop zij rust: `sourceFactsHash`,
`analysisVersion`, `generatedAt`, `reviewedAt`, `generationProvider`,
`generationModel`, `generationWarnings`, `evidenceSummary` en `experienceType`.
Echte AI-content (provider `anthropic`) heeft altijd handmatige review nodig
voordat zij indexeerbaar is: `reviewedAt` blijft leeg en het product komt op
`NEEDS_REVIEW`. Deterministische templatecontent gebruikt alleen gecontroleerde
feiten en mag zonder review publiek.

Op de productpagina staat een compacte bronsectie: waar de productgegevens
vandaan komen (feed of API van de merchant), wanneer de prijs voor het laatst is
gecontroleerd, sinds wanneer wij prijsdata hebben, hoeveel aanbieders wij
vergelijken, en of wij het product zelf hebben getest.

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

Er zijn twee commando's met een duidelijk verschillende rol:

| | `pnpm job:refresh-prices` | `pnpm job:daily` |
| --- | --- | --- |
| Doet | prijs, voorraad en `checkedAt` van bestaande aanbiedingen bijwerken | importeren, afbeeldingen valideren, prijzen analyseren, ontbrekende content genereren, publiceerbare concepten publiceren en één editie samenstellen |
| Nieuwe producten | nee, onbekende rijen worden overgeslagen | ja |
| Homepage-editie | verandert niet | wordt opnieuw samengesteld |
| Frequentie | mag meerdere keren per dag | één keer per dag |

De dagelijkse pipeline leest merchantbronnen uit, normaliseert en dedupliceert,
slaat prijssnapshots op, markeert stale aanbiedingen, valideert nieuwe
afbeeldingen, berekent de eigen prijsanalyse, genereert ontbrekende redactionele
content, promoveert publiceerbare concepten en publiceert atomair één editie voor
de Nederlandse kalenderdag (`Europe/Amsterdam`).

```bash
pnpm job:daily                 # volledige pipeline
pnpm job:refresh-prices        # alleen prijs en voorraad; raakt de editie niet aan
pnpm job:ingest                # alleen bronnen uitlezen
pnpm job:ingest demo-kookkamer # één merchant
pnpm job:analyze-prices        # eigen prijsanalyse opnieuw berekenen
pnpm job:images                # afbeeldingen valideren en de healthcheck draaien
pnpm job:content               # ontbrekende of gewijzigde teksten aanvullen
pnpm job:content --force       # alles opnieuw, bijvoorbeeld na een nieuwe sjabloonversie
```

De volgorde binnen `job:daily` is: importeren → afbeeldingen valideren →
prijzen analyseren → content genereren → concepten promoveren → editie
samenstellen. De analyse gaat dus vóór de selectie, zodat een verse prijsdaling
diezelfde dag in `LATEST_PRICE_DROPS` kan staan.

**Secties op de homepage.** De editie bestaat uit `HERO`, `BEST_DEALS`,
`LATEST_PRICE_DROPS`, `EDITORS_PICK`, `UNDER_100`, `UNNECESSARY_BUT_GREAT` en
`DISCOVERY`. `BEST_DEALS` en `LATEST_PRICE_DROPS` eisen een geldige deal;
`DISCOVERY` mag een bijzonder product zonder referentieprijs bevatten, maar toont
dan geen doorgestreepte prijs, geen kortingspercentage, gebruikt "Bekijk product"
en telt niet als geverifieerde deal. Dat dezelfde uitstekende deal meerdere dagen
terugkomt is toegestaan; binnen dezelfde kalenderdag is de selectie stabiel.
`lastPriceChangeAt` en `dealDetectedAt` uit de prijsanalyse tellen mee in de
versheidsscore, zodat een ouder product met een nieuwe sterke prijsdaling opnieuw
hoog kan eindigen.

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

Twee pagina's horen bij deze fase:

- **`/admin/producten/<id>/preview`** — beveiligde preview van een concept. Toont
  het product zoals het eruit zou zien, plus een banner met de reden waarom het
  nog niet publiek is en een blok "Herkomst van deze tekst" (provider, model,
  beoordeeld op, `experienceType`, analyseversie, `evidenceSummary`).
- **`/admin/integraties`** — per merchant: netwerk (met de aanduiding *scaffold*
  waar dat geldt), of de netwerkconfiguratie compleet is en wat er ontbreekt,
  laatste synchronisatie, aantal aanbiedingen, of de credentials aanwezig zijn
  (ja/nee), of de feed of API ooit met resultaat is uitgelezen, en de laatste
  fout. Er staan **nooit** waarden van secrets: alleen de namen van environment
  variables. Staat er per ongeluk een letterlijke sleutel in
  `Merchant.configuration`, dan waarschuwt deze pagina daarover.

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

1. **Adapter kiezen.** Er zijn adapters voor `FIXTURE`, `JSON`, `CSV`, `XML` en
   `HTML`. Een nieuwe bron toevoegen betekent: adapter schrijven in
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

**XML-feed** — één element per product. `itemSelector` is de tagnaam; in de
mapping betekent `g:price` een element met namespace-prefix, `offer.price` een
genest element, `@id` een attribuut van het item zelf en `image@href` een
attribuut van een kindelement:

```json
{
  "itemSelector": "item",
  "compression": "auto",
  "mapping": {
    "externalId": "@id",
    "title": "title",
    "price": "g:sale_price",
    "referencePrice": "g:price",
    "url": "link",
    "deeplink": "deeplink",
    "imageUrl": "image@href",
    "shippingCost": "g:shipping.g:price",
    "availability": "g:availability",
    "ean": "g:gtin"
  }
}
```

**Transport: authenticatie, compressie en paginering.** Alle feedadapters delen
dezelfde transportlaag (`src/lib/scraping/authenticated-http.ts`) en dus dezelfde
configuratie:

```json
{
  "auth": { "type": "basic", "usernameEnv": "PARTNER_FEED_USER", "passwordEnv": "PARTNER_FEED_PASSWORD" },
  "headers": { "x-partner": "homeandlivingdeals" },
  "compression": "auto",
  "pagination": { "style": "page", "parameter": "page", "sizeParameter": "per_page", "pageSize": 100, "startAt": 1, "maxPages": 10 }
}
```

- `auth.type`: `none`, `basic` (`usernameEnv` + `passwordEnv`), `bearer`
  (`tokenEnv`) of `apiKey` (`headerName` + `valueEnv`).
- **Secrets staan nooit in `Merchant.configuration`.** De configuratie verwijst
  alleen naar de *naam* van een environment variable — vandaar de `*Env`-velden.
  Een letterlijke waarde wordt afgekeurd door `findLiteralSecrets` en gemeld in
  `/admin/integraties`. Ontbreekt de variabele, dan wordt de feed niet opgehaald
  en staat de naam van de ontbrekende variabele in de foutmelding.
- `compression`: `none`, `gzip`, `zip` of `auto` (kijkt naar de bytes). ZIP wordt
  bewust beperkt ondersteund: het eerste bestand, opgeslagen of deflate, zonder
  encryptie — alles daarbuiten is een duidelijke fout in plaats van een aanname.
- `pagination.style`: `page`, `offset` of `cursor` (met `cursorPath`). `maxPages`
  begrenst het aantal verzoeken; wordt die grens geraakt, dan staat dat als
  waarschuwing in de `ScrapeRun`.

De veldmapping kent naast de gewone velden ook `affiliateUrl`, `deeplink`,
`promotionEndsAt`, `shippingCost`, `availability`, `productGroup` en `variantId`.
Een deeplink uit de feed wordt opgeslagen als `Offer.affiliateUrl`; `destinationUrl`
blijft de gewone winkel-URL.

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

## Affiliatenetwerken en trackinglinks

Alle externe knoppen lopen via `/go/[offerId]`. De route bouwt de link met een
`AffiliateLinkBuilder` (`src/lib/affiliate/`), zodat een netwerk verwisselen geen
enkele wijziging in de frontend vraagt. Kliks worden vastgelegd in
`OutboundClick`, de doorverwijzing is tijdelijk (307) en uitgaande links krijgen
`rel="sponsored nofollow noopener"`.

De laag is bewust opgesplitst: feed ophalen, velden mappen, affiliate-link
bouwen, subid toevoegen en optionele API-authenticatie zijn vijf losse stukken.

| Netwerk | Status | Nodig voordat het werkt |
| --- | --- | --- |
| `DIRECT` | **werkend** | niets; gebruikt `Offer.affiliateUrl` uit de feed of anders `destinationUrl` |
| `BOL` | scaffold | site-ID en een API-sleutel in een environment variable |
| `AWIN` | scaffold | publisher-ID (`awinaffid`), advertiser-ID per merchant, API-sleutel |
| `DAISYCON` | scaffold | media-ID, programma-ID per merchant, API-credentials |
| `TRADETRACKER` | scaffold | site-ID, campagne-ID per merchant, API-credentials |
| `AMAZON_CREATORS` | scaffold | creator- of store-ID en een Creators API-token |

**Wat "scaffold" hier betekent.** De interface, de configuratievalidatie, de
subid-parameter en de plek in de code staan er; het linkformaat is **niet tegen
een echt account getest**. Deze connectors zijn dus niet af. Een niet
geconfigureerd netwerk geeft een expliciete "niet geconfigureerd"-melding met de
naam van wat er ontbreekt en bouwt géén link — er wordt nooit een trackinglink
gegokt en er wordt nooit fictieve data teruggegeven. Levert de feed een echte
deeplink, dan wordt die gebruikt (met subid); levert de feed niets, dan weigert de
scaffold. Bij een weigering valt `/go/[offerId]` terug op de gewone winkel-URL en
komt er een waarschuwing in de log, zodat een bezoeker nooit op een dode link
klikt. De Amazon-connector gebruikt bewust de Creators API en niet de verouderde
Product Advertising API.

**Configuratie** in `Merchant.configuration.affiliate`, met `Merchant.affiliateNetwork`
op het netwerk:

```json
{
  "affiliate": {
    "publisherId": "12345",
    "apiKeyEnv": "AWIN_API_KEY",
    "subIdParameter": "clickref"
  }
}
```

Publisher-, site- en media-ID's zijn geen secrets en mogen hier staan. Sleutels en
tokens niet: die worden alleen bij naam genoemd (`apiKeyEnv`, `apiSecretEnv`) en
staan in de environment.

**Subid per plaatsing.** `/go/[offerId]?source=...` zet een subid op de link, zodat
later te zien is welke plaatsing de klik opleverde: `home_hero`,
`home_best_deals_3`, `categorie_keuken_5`, `product_related_2`. De waarde wordt
altijd opgeschoond tot kleine letters, cijfers en underscores, maximaal 40 tekens
(`safeSubId`), want netwerken zijn streng over die parameter. Per netwerk verschilt
de parameternaam (`subid`, `clickref`, `si`, `r`, `ascsubtag`); dat staat in de
link builder en is met `subIdParameter` te overschrijven.

Zet `AFFILIATE_LINKS_ENABLED="true"` zodra er een echt programma loopt. Diezelfde
vlag laat de affiliate-disclosure op de site zien; zolang er geen programma is, is
die mededeling niet waar en staat zij er niet. Vermeld het programma daarna ook op
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
    affiliate/          netwerkinterface, link builders, subid
    ai/                EditorialContentProvider (fixture | template | anthropic)
    analysis/           eigen prijsanalyse en de zinnen die zij oplevert
    analytics/          interne eventlaag
    database/           Prisma-client en alle queries
    deals/              dedupe, score, editieselectie, editiedatum, outbound
    images/             formaat- en afmetingcontrole, validatie met SSRF-bescherming
    pricing/            geld, korting, staleness (één centrale bron)
    products/           één definitie van "publiek zichtbaar"
    saves/              bezoekers-ID en bewaarstore
    scraping/           http, csv, normalisatie, feedtransport, rate limiting, browser
    security/           security headers, rate limiting en CSRF
    seo/                metadata en JSON-LD
  merchants/
    adapters/           fixture, json-feed, csv-feed, xml-feed, html, registry
    fixtures/           demo-merchants en demo-producten
    sources/            live bron(nen) die echt over HTTP worden ingelezen
    schemas/            Zod-schema's voor feedconfiguratie
  jobs/                daily, ingest, content, analyze-prices, refresh-prices,
                       images, worker en de gedeelde pipeline
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
10. **Afbeeldingsveld** — bij voorkeur één afbeelding van minimaal 800 × 800, plus
    het CDN-domein waarop de afbeeldingen staan (nodig voor `next/image` en voor
    `Merchant.imageHosts`).
11. **Gewenste updatefrequentie** — hoe vaak wij de feed mogen ophalen.
12. **Eventuele rate limits** — maximaal aantal requests per minuut, toegestane
    tijdvensters en of een user-agent of API-key vereist is.
13. **Toegangsgegevens voor de feed of API** — welk type authenticatie (basic,
    bearer of API-key-header) en onder welke naam wij de sleutel in de environment
    zetten. Wij nemen nooit een sleutel op in de merchantconfiguratie of in Git.
14. **Formaat en compressie van de feed** — CSV, JSON of XML, en of het bestand
    gzip of ZIP is; bij een gepagineerde API ook de paginaparameters.
15. **Affiliate-deeplink** — het veld in de feed met de trackinglink, of het
    formaat waarmee wij die zelf mogen opbouwen, plus de naam van de
    subid-parameter en de toegestane tekens daarin.
16. **Verzendkosten** — het veld, en of het bedrag volledig en betrouwbaar is.
    Zonder betrouwbare verzendkosten vergelijken wij alleen op productprijs.
