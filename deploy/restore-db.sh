#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – restore a backup made by deploy/backup-db.sh.
#
# Usage:
#     bash deploy/restore-db.sh <fil.sql.gz>
#     bash deploy/restore-db.sh <fil.sql.gz> --yes     # no prompt
#
# What it does, in order:
#   1. Takes a safety backup of the CURRENT database (so a mistake is undoable).
#   2. Asks for confirmation.
#   3. Restores the chosen dump into the database in a single transaction.
#
# The web app can keep running, but you should restart it afterwards:
#     sudo systemctl restart myai-web
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/web/.env.local}"

FILE="${1:-}"
ASSUME_YES=0
[ "${2:-}" = "--yes" ] && ASSUME_YES=1

if [ -z "$FILE" ]; then
  echo "Bruk: bash deploy/restore-db.sh <fil.sql.gz> [--yes]"
  echo "Eksempel: bash deploy/restore-db.sh ~/backups/tech-ai-monkey/daily/tech_ai_monkey-2026-10-05_0330.sql.gz"
  exit 1
fi
[ -f "$FILE" ] || { echo "✗ Finner ikke filen: $FILE"; exit 1; }

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "FEIL: $*" >&2; exit 1; }

# --- database URL -------------------------------------------------------------
DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ] && [ -f "$ENV_FILE" ]; then
  DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -n1 | tr -d '\r')"
fi
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"
[ -n "$DATABASE_URL" ] || die "Fant ingen DATABASE_URL (sett den i $ENV_FILE eller som miljøvariabel)"

find_pg_tool() {
  local tool="$1" p
  if p="$(command -v "$tool" 2>/dev/null)" && [ -n "$p" ]; then
    printf '%s\n' "$p"; return 0
  fi
  p="$(ls -1 /usr/lib/postgresql/*/bin/"$tool" 2>/dev/null | sort -V | tail -n1 || true)"
  [ -n "$p" ] && { printf '%s\n' "$p"; return 0; }
  return 1
}
PSQL="$(find_pg_tool psql)" || die "Fant ikke psql (installer postgresql-client)"

# --- confirmation -------------------------------------------------------------
log "Database: ${DATABASE_URL%%\?*}"
log "Gjenoppretter fra: $FILE"
echo
echo "⚠  Dette OVERSKRIVER tabellene i databasen med innholdet i backupen."
echo "   En sikkerhetskopi av nåværende tilstand tas først."
echo

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'Skriv "ja" for å fortsette: '
  read -r ANSWER
  [ "$ANSWER" = "ja" ] || { echo "Avbrutt."; exit 1; }
fi

# --- safety backup of current state ------------------------------------------
log "Tar sikkerhetskopi av nåværende database først …"
bash "$REPO_DIR/deploy/backup-db.sh" || die "Kunne ikke ta sikkerhetskopi – avbryter for sikkerhet"

# --- restore ------------------------------------------------------------------
log "Gjenoppretter …"
if ! gunzip -t "$FILE" 2>/dev/null; then
  die "Filen er ikke en gyldig gzip-fil"
fi

gunzip -c "$FILE" | "$PSQL" "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1

log "✓ Gjenoppretting fullført. Start web-appen på nytt:  sudo systemctl restart myai-web"
