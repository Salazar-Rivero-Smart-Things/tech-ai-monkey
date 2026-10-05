#!/usr/bin/env bash
# Temporary: verify the LIVE systemd services end-to-end.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.check-live.log"
: > "$LOG"
DB_URL="$(grep -m1 '^DATABASE_URL=' "$ROOT/web/.env.local" | cut -d= -f2-)"
{
  echo "=== $(date) ==="
  echo
  echo "--- listeners ---"
  ss -ltnp 2>/dev/null | grep -E ':3000|:2000' || echo "no listeners"
  echo
  echo "--- web (lokal) ---"
  curl -s -o /dev/null -w "GET /                -> %{http_code}\n" --max-time 8 http://127.0.0.1:3000/
  curl -s -o /dev/null -w "GET /signin          -> %{http_code}\n" --max-time 8 http://127.0.0.1:3000/signin
  curl -s -o /dev/null -w "GET /dashboard/apps  -> %{http_code} (302 = redirect til innlogging, ok)\n" --max-time 8 http://127.0.0.1:3000/dashboard/apps
  echo
  echo "--- web (offentlig via Caddy) ---"
  curl -s -o /dev/null -w "GET https://tech-ai.tech/ -> %{http_code}\n" --max-time 15 https://tech-ai.tech/
  echo
  echo "--- agent ---"
  curl -s -o /dev/null -w "GET  /                          -> %{http_code}\n" --max-time 8 http://127.0.0.1:2000/
  curl -s -o /dev/null -w "POST /eve/v1/session (u/nokkel) -> %{http_code} (401 = auth virker)\n" --max-time 8 -X POST http://127.0.0.1:2000/eve/v1/session -H 'content-type: application/json' -d '{}'
  echo
  echo "--- tabeller i databasen ---"
  psql -w "$DB_URL" -Atc "select tablename from pg_tables where schemaname='public' order by 1" 2>&1
  echo
  echo "--- web-logg (siste 12) ---"
  journalctl -u myai-web -n 12 --no-pager 2>&1 | tail -12
  echo
  echo "--- agent-logg (siste 12) ---"
  journalctl -u myai-agent -n 12 --no-pager 2>&1 | tail -12
} >> "$LOG" 2>&1
sed -i "s|$DB_URL|<DATABASE_URL>|g" "$LOG" 2>/dev/null || true
echo "CHECK_LIVE_DONE"
