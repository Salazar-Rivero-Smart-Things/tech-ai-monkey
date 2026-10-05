#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – PostgreSQL backup.
#
# Dumps the database named in DATABASE_URL (web/.env.local) to a timestamped,
# gzip'ed SQL file. Keeps 30 daily copies and 12 monthly copies, then prunes.
#
# Manual run:
#     bash deploy/backup-db.sh
#
# Automatic (nightly, installed by deploy/install-backup.sh):
#     systemctl list-timers myai-backup.timer
#
# Store the backups on another disk if you like:
#     BACKUP_DIR=/mnt/nas/tech-ai-backups bash deploy/backup-db.sh
#
# The dumps contain personal data (third-party tokens, password hashes), so
# they are written with mode 600 and must never be committed to git.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/web/.env.local}"
BACKUP_DIR="${BACKUP_DIR:-${HOME:-/home/$(id -un)}/backups/tech-ai-monkey}"
DAILY_KEEP_DAYS="${DAILY_KEEP_DAYS:-30}"
MONTHLY_KEEP_MONTHS="${MONTHLY_KEEP_MONTHS:-12}"
DB_LABEL="${DB_LABEL:-tech_ai_monkey}"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "FEIL: $*" >&2; exit 1; }

# --- 1. find the database URL -------------------------------------------------
DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ] && [ -f "$ENV_FILE" ]; then
  DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -n1 | tr -d '\r')"
fi
# strip optional surrounding quotes
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"
[ -n "$DATABASE_URL" ] || die "Fant ingen DATABASE_URL (sett den i $ENV_FILE eller som miljøvariabel)"

# --- 2. find pg_dump ----------------------------------------------------------
find_pg_tool() {
  local tool="$1" p
  if p="$(command -v "$tool" 2>/dev/null)" && [ -n "$p" ]; then
    printf '%s\n' "$p"; return 0
  fi
  p="$(ls -1 /usr/lib/postgresql/*/bin/"$tool" 2>/dev/null | sort -V | tail -n1 || true)"
  [ -n "$p" ] && { printf '%s\n' "$p"; return 0; }
  return 1
}
PG_DUMP="$(find_pg_tool pg_dump)" || die "Fant ikke pg_dump (installer postgresql-client)"

# --- 3. take the backup -------------------------------------------------------
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"
chmod 700 "$BACKUP_DIR" "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly" 2>/dev/null || true

TS="$(date '+%Y-%m-%d_%H%M')"
MONTH="$(date '+%Y-%m')"
TARGET="$BACKUP_DIR/daily/${DB_LABEL}-${TS}.sql.gz"
TMP="${TARGET}.part"

log "Starter backup av databasen → $TARGET"
trap 'rm -f "$TMP"' EXIT

"$PG_DUMP" "$DATABASE_URL" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$TMP"

[ -s "$TMP" ] || die "Backupen ble tom"
gzip -t "$TMP" 2>/dev/null || die "Backupen er korrupt (gzip-test feilet)"

mv -f "$TMP" "$TARGET"
chmod 600 "$TARGET" 2>/dev/null || true
trap - EXIT
log "✓ Backup fullført: $TARGET ($(du -h "$TARGET" | cut -f1))"

# --- 4. keep one copy per month ----------------------------------------------
if [ "$(date '+%d')" = "01" ]; then
  MONTHLY="$BACKUP_DIR/monthly/${DB_LABEL}-${MONTH}.sql.gz"
  cp -f "$TARGET" "$MONTHLY"
  chmod 600 "$MONTHLY" 2>/dev/null || true
  log "✓ Månedlig kopi lagret: $MONTHLY"
fi

# --- 5. prune old copies ------------------------------------------------------
log "Rydder gamle backuper (daglig eldre enn ${DAILY_KEEP_DAYS} d, månedlig eldre enn ${MONTHLY_KEEP_MONTHS} md) …"
find "$BACKUP_DIR/daily"   -type f -name '*.sql.gz*' -mtime "+${DAILY_KEEP_DAYS}" -print -delete
find "$BACKUP_DIR/monthly" -type f -name '*.sql.gz*' -mtime "+$((MONTHLY_KEEP_MONTHS * 31))" -print -delete

log "Ferdig. Beholdning: daglig=$(find "$BACKUP_DIR/daily" -type f 2>/dev/null | wc -l), månedlig=$(find "$BACKUP_DIR/monthly" -type f 2>/dev/null | wc -l)"
