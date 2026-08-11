# Beveiliging

HomeAndLivingDeals.nl heeft geen gebruikersaccounts en verwerkt geen
betalingen; aankopen lopen bij de aanbieder. Er is dus geen betaalgegeven en
geen wachtwoord van een bezoeker te stelen. Wat er wél te beschermen valt: het adminpaneel, de
database, de uitgaande links en de secrets.

## Een kwetsbaarheid melden

Mail naar **security@homeandlivingdeals.nl** met:

- wat je hebt gevonden en waar (URL of bestandspad);
- de stappen om het te reproduceren;
- wat een aanvaller ermee zou kunnen.

Wij reageren binnen vijf werkdagen. Meld het alsjeblieft eerst aan ons en niet
publiek, en gebruik geen geautomatiseerde scans die de site platleggen. Er is
geen bug-bountyprogramma; we vermelden je graag in de release-notes.

Maak geen GitHub-issue voor een kwetsbaarheid: die is publiek.

## Wat er in de applicatie is geregeld

| Onderdeel | Maatregel |
| --- | --- |
| Adminroutes | Login met `ADMIN_USERNAME` en `ADMIN_PASSWORD`; ondertekende, httpOnly sessiecookie (12 uur), `secure` in productie, vergelijking met `timingSafeEqual`. Alle `/admin`-routes staan op `noindex`. |
| Cron | `/api/cron/daily` vraagt `Authorization: Bearer $CRON_SECRET`; zonder secret weigert de route altijd. |
| CSRF | `/api/saves` en `/api/events` accepteren alleen verzoeken met een eigen `Origin` (of zonder afwijkende `Referer`). Server Actions in `/admin` gebruiken de origincontrole van Next.js. |
| Rate limiting | `/api/saves`, `/api/events`, `/go/[offerId]` en `/zoeken` hebben een token-bucket per bezoeker (cookie) of IP. Antwoord bij overschrijding: `429` met `Retry-After`. |
| Uitgaande links | Alle externe links lopen via `/go/[offerId]`. Alleen absolute `http`- en `https`-bestemmingen zijn toegestaan; alles anders wordt geweigerd. Links krijgen `rel="sponsored nofollow noopener"`. |
| Security headers | CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` en in productie HSTS. Zie `src/lib/security/headers.ts`. |
| Logging | De logger vervangt waarden van velden als `password`, `secret`, `token`, `cookie` en `DATABASE_URL` door `[verborgen]` en maskeert `postgres://`-URL's en bearer-tokens in vrije tekst. |
| Secrets | Alles komt uit de environment. `.env` staat in `.gitignore`, `.env.example` bevat geen echte waarden, en met `APP_ENV=production` start de app niet zolang een verplicht secret ontbreekt of nog een voorbeeldwaarde is. |
| Database | Alleen bereikbaar binnen het Docker-netwerk; de productiestack publiceert geen databasepoort. Queries lopen via Prisma (geparameteriseerd). |
| Scraping | Alleen bronnen met `scrapingAllowed = true`. Geen omzeiling van anti-botbeveiliging, geen CAPTCHA-omzeiling, geen stealthbrowser, geen proxyrotatie, en nooit tijdens een paginaweergave. |

## Bewust niet geregeld

- **Geen WAF en geen gedeelde rate limiting.** De limieten zijn in-memory en dus
  per proces. Zet een hardere limiet in Caddy of bij de hostingpartij zodra de
  site echt verkeer krijgt.
- **CSP met `unsafe-inline` voor scripts.** Next.js plaatst hydratatiedata
  inline. Een nonce-gebaseerde CSP kan later, maar vraagt aanpassingen in de
  proxy en de layout.
- **Geen tweefactorauthenticatie op /admin.** Bij meer dan één beheerder is dat
  de eerste uitbreiding; overweeg tot die tijd een IP-allowlist in Caddy (het
  voorbeeld staat in `deploy/Caddyfile`).
- **Geen audittrail van adminacties.** `ScrapeRun` en de eventtabel leggen wel
  vast wat de jobs deden.

## Secrets roteren

1. Genereer een nieuwe waarde: `openssl rand -base64 36`.
2. Pas `.env` op de server aan.
3. `docker compose -f docker-compose.production.yml up -d` (de app leest de
   environment bij het starten).
4. Bij `ADMIN_SESSION_SECRET` zijn bestaande adminsessies daarna ongeldig; dat is
   de bedoeling.

## Afhankelijkheden

`pnpm audit` hoort bij elke release. De CI-workflow draait lint, typecheck,
tests en een productiebuild op elke push en pull request, zonder secrets en
zonder deploystap.
