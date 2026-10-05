#!/usr/bin/env bash
# Temporary: start the agent on 2100, capture output, test, stop.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.verify2.log"
ALOG="$ROOT/.agent-test.log"
: > "$LOG"
: > "$ALOG"

{
  echo "=== AGENT on port 2100 (30s wait) ==="
  cd "$ROOT" || exit 1
  set -a; . "$ROOT/.env"; set +a
  setsid env PORT=2100 npm run start >"$ALOG" 2>&1 &
  AGENT_PID=$!
  echo "started pid=$AGENT_PID"
  for i in $(seq 1 15); do
    sleep 2
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:2100/ || true)
    echo "t=$((i*2))s http=$code"
    if [ "$code" != "000" ] && [ -n "$code" ]; then break; fi
  done
  echo "--- final curls ---"
  curl -s -o /dev/null -w "agent_home_http=%{http_code}\n" --max-time 5 http://127.0.0.1:2100/ || true
  curl -s -o /dev/null -w "agent_api_http=%{http_code}\n" --max-time 5 http://127.0.0.1:2100/eve/v1/session || true
  kill -TERM -"$AGENT_PID" 2>/dev/null || kill -TERM "$AGENT_PID" 2>/dev/null
  sleep 3
  echo
  echo "=== agent output (last 60 lines) ==="
  tail -60 "$ALOG"
} > "$LOG" 2>&1
echo "VERIFY2_DONE"
