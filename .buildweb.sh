#!/usr/bin/env bash
# Temporary: rebuild the web app after env change.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.buildweb.log"
: > "$LOG"
{
  echo "=== $(date) ==="
  cd "$ROOT/web" || exit 1
  npm run build
  echo "WEB_BUILD_EXIT=$?"
} >> "$LOG" 2>&1
echo "BUILDWEB_DONE"
