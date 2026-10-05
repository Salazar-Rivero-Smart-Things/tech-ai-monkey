#!/usr/bin/env bash
# Temporary verification: list tables + smoke-test agent (2100) and web (3100).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.verify.log"
: > "$LOG"
DB_URL="$(grep -m1 '^DATABASE_URL=' "$ROOT/web/.env.local" | cut -d= -f2-)"

exec >> "$LOG" 2>&1

echo "=== tables in database ==="
psql -w "$DB_URL" -Atc "select tablename from pg_tables where schemaname='public' order by 1"
echo

echo "=== AGENT smoke test on port 2100 ==="
cd "$ROOT" || exit 1
set -a; . "$ROOT/.env"; set +a
setsid env PORT=2100 npm run start >/dev/null 2>&1 &
AGENT_PID=$!
sleep 14
curl -s -o /dev/null -w "agent_home_http=%{http_code}\n" --max-time 5 http://127.0.0.1:2100/ || echo "agent_home_http=FAILED"
curl -s -o /dev/null -w "agent_api_http=%{http_code}\n" --max-time 5 http://127.0.0.1:2100/eve/v1/session || echo "agent_api_http=FAILED"
kill -TERM -"$AGENT_PID" 2>/dev/null || kill -TERM "$AGENT_PID" 2>/dev/null
sleep 2
echo

echo "=== WEB smoke test on port 3100 ==="
cd "$ROOT/web" || exit 1
setsid env PORT=3100 npm run start >/dev/null 2>&1 &
WEB_PID=$!
sleep 10
curl -s -o /dev/null -w "web_home_http=%{http_code}\n" --max-time 5 http://127.0.0.1:3100/ || echo "web_home_http=FAILED"
curl -s -o /dev/null -w "web_pricing_http=%{http_code}\n" --max-time 5 http://127.0.0.1:3100/pricing || echo "web_pricing_http=FAILED"
curl -s -o /dev/null -w "web_signup_http=%{http_code}\n" --max-time 5 http://127.0.0.1:3100/signup || echo "web_signup_http=FAILED"
kill -TERM -"$WEB_PID" 2>/dev/null || kill -TERM "$WEB_PID" 2>/dev/null
sleep 2

echo
echo "=== leftover test processes on 2100/3100 (should be none) ==="
(ss -ltnp 2>/dev/null || true) | grep -E ':(2100|3100)\b' || echo "none"
echo

# mask the URL in the log
sed -i "s|$DB_URL|<DATABASE_URL>|g" "$LOG" 2>/dev/null || true
echo "VERIFY_DONE"
