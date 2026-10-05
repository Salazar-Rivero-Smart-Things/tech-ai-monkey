#!/usr/bin/env bash
# Temporary install script (root + web).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.install.log"
: > "$LOG"

{
  echo "=== started $(date) ==="
  echo
  echo "=== [1/2] root: npm install ==="
} >> "$LOG" 2>&1

cd "$ROOT" || exit 1
npm install --no-audit --no-fund >> "$LOG" 2>&1
echo "ROOT_EXIT=$?" >> "$LOG"

{
  echo
  echo "=== [2/2] web: npm install ==="
} >> "$LOG" 2>&1

cd "$ROOT/web" || exit 1
npm install --no-audit --no-fund >> "$LOG" 2>&1
echo "WEB_EXIT=$?" >> "$LOG"

echo "=== finished $(date) ===" >> "$LOG" 2>&1
echo "INSTALL_DONE"
