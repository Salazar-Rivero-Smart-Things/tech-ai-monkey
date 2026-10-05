#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git add -A

echo "=== antall stagede filer ==="
git diff --cached --name-only | wc -l
echo
echo "=== stagede filer ==="
git diff --cached --name-only
echo
echo "=== diff-stat (kort) ==="
git --no-pager diff --cached --stat | tail -n 40
echo
echo "=== SIKKERHETSSJEKK: hemmeligheter ==="
BAD="$(git diff --cached --name-only | grep -iE '(^|/)\.env($|\.)|secret|credential' | grep -viE '\.env\.example$' || true)"
if [ -n "$BAD" ]; then
  echo "❌ FANT MULIGE HEMMELIGHETER – IKKE COMMIT:"
  echo "$BAD"
  exit 1
fi
echo "✓ Ingen .env/hemmelige filer blant stagede filer"
