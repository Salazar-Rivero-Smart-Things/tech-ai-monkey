#!/usr/bin/env bash
# Temporary: run drizzle-kit push with the DATABASE_URL from web/.env.local.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.push.log"
: > "$LOG"
cd "$ROOT/web" || exit 1
DB_URL="$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-)"
if [ -z "$DB_URL" ]; then
  echo "no DATABASE_URL found" >> "$LOG"
  echo "PUSH_DONE"
  exit 1
fi
{
  echo "=== drizzle-kit push $(date) ==="
  DATABASE_URL="$DB_URL" npx drizzle-kit push
  echo "PUSH_EXIT=$?"
} >> "$LOG" 2>&1
# mask the URL in the log, just in case
sed -i "s|$DB_URL|<DATABASE_URL>|g" "$LOG" 2>/dev/null || true
echo "PUSH_DONE"
