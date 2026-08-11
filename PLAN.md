# PLAN — homeandlivingdeals.nl MVP

Discovery-commerce magazine (NL) voor bijzondere woon-, kook-, tech-, tuin- en
speelproducten. De site verkoopt niets: alle CTA's gaan via `/go/[offerId]`.

## Stack

Next.js (App Router, RSC-first) · TypeScript strict · Tailwind v4 · Prisma +
PostgreSQL · Zod · Lucide · Vitest (unit) · Playwright (e2e) · pnpm.

## Fasering

1. **Scaffold** — pnpm workspace, Next config, Tailwind tokens (koraal #FF5B4D,
   canvas #F7F7F4), Manrope/Inter via `next/font`, tsconfig strict, eslint.
2. **Data** — `prisma/schema.prisma` met Merchant, Product, Offer,
   PriceSnapshot, EditorialContent, DailyEdition(+Item), AnonymousSave,
   OutboundClick, ScrapeRun + enums (SourceType, ProductStatus,
   ReferencePriceType, EditionSection, …).
3. **Domeinlogica (pure, unit-getest)** — `lib/pricing` (formatting nl-NL,
   korting, referentieprijs-validatie, stale >24u), `lib/deals/dedupe`
   (EAN → merk+model → externalId → genormaliseerde titel → fuzzy),
   `lib/deals/score` (gewogen samengestelde score), `lib/deals/edition`
   (hero + secties, max 4/categorie, max 3/merchant).
4. **Merchants** — `MerchantAdapter`-interface + fixture-, JSON-, CSV- en
   HTML-(Cheerio)-adapters met timeouts, retries/backoff, rate limiting en
   veilige prijsparsing. Optionele Playwright-fetcher achter een flag.
5. **AI-laag** — `EditorialContentProvider` (fixture | template | anthropic),
   Zod-validatie van de JSON-output, één retry, fallback naar template.
6. **Jobs** — `pnpm job:daily` (ingest → snapshots → stale → dedupe → content →
   score → atomair publiceren) + beveiligde `/api/cron/daily` met CRON_SECRET.
7. **UI** — layout (topbar, sticky header, categoriebalk, footer),
   `ProductCard`, hero, redactionele blokken, `AdSlot` (uitgeschakeld,
   placeholder in dev), save-hartje (cookie + localStorage + optimistic).
8. **Routes** — `/`, `/categorie/[slug]`, `/product/[slug]`, `/zoeken`,
   `/bewaard`, `/nieuw`, `/collectie/[slug]`, `/over`, `/hoe-wij-selecteren`,
   `/affiliateverklaring`, `/privacy`, `/cookies`, `/contact`, `/admin/*`,
   `/go/[offerId]`, `/api/saves`, `/api/events`, `/api/cron/daily`.
9. **SEO** — metadata per route, canonicals, robots.ts, sitemap.ts, JSON-LD
   (Product, Offer, BreadcrumbList, ItemList, Organization). Geen Review/rating.
   Noindex: admin, zoeken, bewaard, demo-producten.
10. **Seed** — 24+ fictieve demo-producten (`isDemo=true`, noindex), 1 editie
    voor vandaag; saves/clicks alleen in testfixtures.
11. **Ops** — `.env.example`, Dockerfile (standalone output), docker-compose
    (app + postgres + healthchecks), README met VPS-crontab en merchant-onboarding.
12. **Kwaliteit** — lint, typecheck, vitest, Playwright-smoketest, prod build.

## Bewuste grenzen

Geen cart/checkout/accounts, geen externe analytics (interne eventlaag met één
interface), geen CMS, geen echte advertentiescripts zonder env-vars, geen
gefabriceerde social proof (save-aantal pas vanaf 10 echte saves).
