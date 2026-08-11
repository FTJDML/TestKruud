#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Zet een back-up terug. Bedoeld om ook echt te oefenen: standaard gaat de dump
# naar een aparte testdatabase, niet over de productiedatabase heen.
#
#   ./scripts/restore-database.sh                       # nieuwste dump -> testdatabase
#   ./scripts/restore-database.sh backups/x.dump        # specifieke dump
#   RESTORE_TARGET_URL="postgresql://..." ./scripts/restore-database.sh
#
# De doeldatabase wordt leeggemaakt (--clean) en opnieuw gevuld. Geef een
# doel-URL op die je mag overschrijven.
# ---------------------------------------------------------------------------
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi

# Prisma-specifieke queryparameters (schema, connection_limit, pgbouncer) kent
# libpq niet; die worden eruit gefilterd. sslmode en dergelijke blijven staan.
libpq_url() {
  python3 - "$1" <<'PYEOF'
import sys
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

drop = {"schema", "connection_limit", "pool_timeout", "pgbouncer", "connect_timeout_ms", "socket_timeout"}
parts = urlsplit(sys.argv[1])
query = urlencode([(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in drop])
print(urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment)))
PYEOF
}

if [[ -n "${DATABASE_URL:-}" ]]; then DATABASE_URL="$(libpq_url "$DATABASE_URL")"; fi

dump="${1:-}"
if [[ -z "$dump" ]]; then
  dump="$(ls -1t "$BACKUP_DIR"/homeandlivingdeals-*.dump 2>/dev/null | head -1 || true)"
fi
if [[ -z "$dump" || ! -f "$dump" ]]; then
  echo "Geen dump gevonden. Maak er eerst een met ./scripts/backup-database.sh" >&2
  exit 1
fi

# Standaard naar <database>_restoretest, zodat een oefening niets kapotmaakt.
target="${RESTORE_TARGET_URL:-}"
if [[ -z "$target" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Geef RESTORE_TARGET_URL op of zet DATABASE_URL." >&2
    exit 1
  fi
  base="${DATABASE_URL%%\?*}"
  target="${base}_restoretest"
fi

target="$(libpq_url "$target")"

echo "Dump:  $dump"
echo "Doel:  ${target%%\?*}"

# Doeldatabase aanmaken wanneer zij nog niet bestaat.
db_name="$(basename "${target%%\?*}")"
admin_url="${target%/*}/postgres"
if ! psql "$target" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "Doeldatabase $db_name bestaat nog niet; aanmaken."
  psql "$admin_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$db_name\";"
fi

pg_restore --dbname="$target" --clean --if-exists --no-owner --no-privileges "$dump"

echo "Terugzetten klaar. Steekproef:"
psql "$target" -X -A -t -c 'SELECT count(*) || $$ producten$$ FROM "Product";'
psql "$target" -X -A -t -c 'SELECT count(*) || $$ aanbiedingen$$ FROM "Offer";'
psql "$target" -X -A -t -c 'SELECT count(*) || $$ edities$$ FROM "DailyEdition";'
