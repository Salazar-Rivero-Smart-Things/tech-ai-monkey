#!/usr/bin/env bash
# Temporary: boot the built web app on port 3100 and hit a few pages.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.smoke.log"
: > "$LOG"
cd "$ROOT/web" || exit 1

PORT=3100 node_modules/.bin/next start -p 3100 >> "$LOG" 2>&1 &
PID=$!
sleep 8
{
  echo "=== requests ==="
  curl -s -o /dev/null -w "GET /        -> HTTP %{http_code}\n" http://127.0.0.1:3100/
  curl -s -o /dev/null -w "GET /signin  -> HTTP %{http_code}\n" http://127.0.0.1:3100/signin
  curl -s -o /dev/null -w "GET /pricing -> HTTP %{http_code}\n" http://127.0.0.1:3100/pricing
} >> "$LOG" 2>&1
kill "$PID" 2>/dev/null
wait "$PID" 2>/dev/null
echo "SMOKE_DONE"
