#!/usr/bin/env bash
# Temporary: rebuild the root agent only.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.build2.log"
: > "$LOG"
{
  echo "=== $(date) ==="
  cd "$ROOT" || exit 1
  npm run build
  echo "ROOT_BUILD_EXIT=$?"
} >> "$LOG" 2>&1
echo "BUILD2_DONE"
