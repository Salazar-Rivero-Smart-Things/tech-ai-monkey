#!/usr/bin/env bash
# Temporary: longer agent smoke test + native-dep diagnostics.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.verify3.log"
ALOG="$ROOT/.agent-test3.log"
: > "$LOG"
: > "$ALOG"

{
  echo "=== native deps that npm did NOT build ==="
  for p in node-liblzma @mongodb-js/zstd microsandbox; do
    d="$ROOT/node_modules/$p"
    if [ -d "$d" ]; then
      echo "-- $p present"
      ls "$d" | head -10
      find "$d" -name "*.node" 2>/dev/null | head -5
      [ -d "$d/build" ] && echo "   has build/ dir" || echo "   no build/ dir"
    else
      echo "-- $p MISSING"
    fi
  done
  echo
  echo "=== agent on 2100 (up to 90s) ==="
  cd "$ROOT" || exit 1
  set -a; . "$ROOT/.env"; set +a
  setsid env PORT=2100 npm run start >"$ALOG" 2>&1 &
  AGENT_PID=$!
  for i in $(seq 1 30); do
    sleep 3
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:2100/ || true)
    echo "t=$((i*3))s http=$code  | last: $(tail -1 "$ALOG" 2>/dev/null)"
    if [ "$code" != "000" ] && [ -n "$code" ]; then break; fi
  done
  echo "--- final ---"
  curl -s -o /dev/null -w "agent_home_http=%{http_code}\n" --max-time 5 http://127.0.0.1:2100/ || true
  kill -TERM -"$AGENT_PID" 2>/dev/null || kill -TERM "$AGENT_PID" 2>/dev/null
  sleep 3
  echo
  echo "=== full agent output ==="
  cat "$ALOG"
} > "$LOG" 2>&1
echo "VERIFY3_DONE"
