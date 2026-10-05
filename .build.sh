#!/usr/bin/env bash
# Temporary build script (root agent + web).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.build.log"
: > "$LOG"

{
  echo "=== started $(date) ==="
  echo
  echo "=== [1/2] root: eve build ==="
} >> "$LOG" 2>&1

cd "$ROOT" || exit 1
npm run build >> "$LOG" 2>&1
echo "ROOT_BUILD_EXIT=$?" >> "$LOG"

{
  echo
  echo "=== [2/2] web: next build ==="
} >> "$LOG" 2>&1

cd "$ROOT/web" || exit 1
npm run build >> "$LOG" 2>&1
echo "WEB_BUILD_EXIT=$?" >> "$LOG"

echo "=== finished $(date) ===" >> "$LOG" 2>&1
echo "BUILD_DONE"
