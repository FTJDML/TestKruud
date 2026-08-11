#!/usr/bin/env bash
#
# Zet in één keer een werkende stagingomgeving op en start haar.
#
# Dit is de applicatie zelf, met een database, server-side rendering, de jobs en
# het adminpaneel: alles werkt zoals in productie, met voorbeelddata en zonder
# affiliatelinks, tracking of advertenties.
#
# Nodig: PostgreSQL bereikbaar via DATABASE_URL uit .env.
#
# Gebruik:
#   pnpm staging              # migreren, seeden, data ophalen, bouwen, starten
#   pnpm staging --no-seed    # alleen bouwen en starten
#   PORT=3200 pnpm staging    # op een andere poort
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3100}"
SEED=1
for arg in "$@"; do
  if [ "$arg" = "--no-seed" ]; then SEED=0; fi
done

# Staging is nooit productie: de vlaggen hieronder horen bij een testomgeving.
export APP_ENV="${APP_ENV:-development}"
export STAGING_MODE=true
export DEMO_CONTENT_ENABLED=true
export SEARCH_ENGINE_INDEXING_ENABLED=false
export ADS_ENABLED=false
export AFFILIATE_LINKS_ENABLED=false

echo "▸ Databaseschema bijwerken"
pnpm prisma migrate deploy

if [ "$SEED" = "1" ]; then
  echo "▸ Voorbeelddata plaatsen (demo-merchants, fixtureproducten en de open democatalogus)"
  pnpm tsx prisma/seed.ts

  echo "▸ Redactionele structuur plaatsen (clusters en vergelijkingscriteria)"
  pnpm tsx prisma/seed-editorial.ts

  echo "▸ Redactionele pagina's voor staging plaatsen"
  pnpm tsx prisma/seed-staging.ts

  echo "▸ Dagelijkse pipeline draaien: bronnen inlezen, prijzen, afbeeldingen, editie"
  pnpm tsx src/jobs/daily.ts > /dev/null

  echo "▸ Afbeeldingen van alle gepubliceerde producten opnieuw controleren"
  pnpm tsx src/jobs/images.ts --all > /dev/null
fi

echo "▸ Productiebuild maken"
pnpm next build

echo
echo "Staging draait straks op http://localhost:${PORT}"
echo "Adminpaneel: http://localhost:${PORT}/admin (ADMIN_USERNAME en ADMIN_PASSWORD uit .env)"
echo
exec pnpm next start --port "${PORT}"
