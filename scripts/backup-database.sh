#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Dagelijkse back-up van de PostgreSQL-database.
#
#   ./scripts/backup-database.sh                 # gebruikt $DATABASE_URL
#   BACKUP_DIR=/srv/backups ./scripts/backup-database.sh
#
# - schrijft een pg_dump in custom format (-Fc), het formaat dat pg_restore
#   nodig heeft voor selectief terugzetten;
# - bewaart maximaal zeven dumps en verwijdert de oudste;
# - schrijft eerst naar een .partial en hernoemt pas na succes, zodat een
#   afgebroken run nooit een halve back-up achterlaat.
#
# Off-site: zie het einde van dit bestand en de README.
# ---------------------------------------------------------------------------
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP:-7}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f .env ]]; then
    # Alleen DATABASE_URL overnemen; de rest van .env blijft buiten dit script.
    DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"'')"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL ontbreekt. Zet de variabele of vul .env." >&2
  exit 1
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

DATABASE_URL="$(libpq_url "$DATABASE_URL")"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/homeandlivingdeals-$stamp.dump"

echo "Back-up maken naar $target"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --file="$target.partial"
mv "$target.partial" "$target"

size="$(du -h "$target" | cut -f1)"
echo "Back-up klaar ($size)"

# Ouder dan $KEEP dumps opruimen (nieuwste eerst laten staan).
mapfile -t dumps < <(ls -1t "$BACKUP_DIR"/homeandlivingdeals-*.dump 2>/dev/null || true)
if (( ${#dumps[@]} > KEEP )); then
  for old in "${dumps[@]:$KEEP}"; do
    echo "Oude back-up verwijderen: $old"
    rm -f "$old"
  done
fi

echo "Aanwezige back-ups: $(ls -1 "$BACKUP_DIR"/homeandlivingdeals-*.dump 2>/dev/null | wc -l) (maximaal $KEEP)"

# ---------------------------------------------------------------------------
# Off-site bestemming toevoegen
# ---------------------------------------------------------------------------
# Deze back-up staat op dezelfde machine als de database. Voeg één van de
# volgende regels toe zodra er een off-site doel is; de rest van het script
# hoeft daarvoor niet te veranderen.
#
#   rclone copy "$target" "remote:homeandlivingdeals/db"     # S3, B2, Storage Box
#   restic -r "$RESTIC_REPOSITORY" backup "$BACKUP_DIR"      # met versleuteling
#   scp "$target" backup@offsite.example:/srv/hald/          # simpelste variant
#
# Aandachtspunten: bewaar de sleutel of het wachtwoord niet op dezelfde server,
# test het terugzetten met ./scripts/restore-database.sh, en houd de retentie
# off-site langer dan de zeven lokale dumps.
