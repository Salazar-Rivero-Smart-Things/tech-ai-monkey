#!/usr/bin/env bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

git add -A
echo "=== stagede filer: $(git diff --cached --name-only | wc -l) ==="
echo
echo "=== SJEKK 1: ingen .env-filer (kun .env.example) ==="
if git diff --cached --name-only | grep -iE '(^|/)\.env($|\.)' | grep -viE '\.env\.example$'; then
  echo "  ❌ Stopp: en .env-fil er staget!"
  exit 1
else
  echo "  ✓ OK"
fi
echo
echo "=== SJEKK 2: kjente nøkkelmønstre i stagede filer ==="
FILES="$(git diff --cached --name-only --diff-filter=ACM \
  | grep -vE '\.(png|jpg|jpeg|gif|ico|woff2?|ttf|pdf|map)$' \
  | grep -vE '(^|/)node_modules/' \
  | grep -vE '(^|/)\.next/' || true)"
HITS=0
for pat in 'sk_live_' 'sk_test_' 'whsec_' 'GOCSPX-' 'AIza' 'xoxb-' 'ghp_' 'BEGIN [A-Z ]*PRIVATE KEY' 'AGENT_API_KEY_SECRET=[^c]' 'DEEPSEEK_API_KEY=sk'; do
  M="$(grep -rlI -- "$pat" $FILES 2>/dev/null || true)"
  if [ -n "$M" ]; then
    echo "  ⚠️  mønster '$pat' funnet i:"
    echo "$M" | sed 's/^/      /'
    HITS=1
  fi
done
[ "$HITS" = 0 ] && echo "  ✓ OK – ingen kjente nøkkelmønstre"
echo
echo "=== SJEKK 3: kontroll av at .env.local er ignorert ==="
git check-ignore -v .env .env.local web/.env.local 2>&1 || echo "  (obs: ikke ignorert?)"
