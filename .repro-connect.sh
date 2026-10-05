#!/usr/bin/env bash
set -uo pipefail
BASE="https://tech-ai.tech"
S="$(date +%s)"
EMAIL="copilot-diag-${S}@example.com"
PASS="DiagPass12345xyz"
J="$(mktemp -d)"

echo "=== 1) opprett testbruker: $EMAIL ==="
curl -s -X POST "$BASE/api/auth/signup" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"Copilot Diag\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | head -c 300
echo

echo
echo "=== 2) hent csrf ==="
CSRF_JSON="$(curl -s -c "$J/cj.txt" "$BASE/api/auth/csrf")"
CSRF="$(printf '%s' "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
echo "csrf: $([ -n "$CSRF" ] && echo ok || echo FEIL)"
echo "cookies: $(grep -c . "$J/cj.txt") linjer"

echo
echo "=== 3) logg inn (credentials) ==="
curl -s -i -b "$J/cj.txt" -c "$J/cj.txt" -X POST "$BASE/api/auth/callback/credentials" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  | tr -d '\r' | grep -iE '^HTTP/|^location:' | head -5
echo "session-cookies: $(grep -ciE 'session-token' "$J/cj.txt")"

echo
echo "=== 4) GET /api/integrations/google/connect  (Location = autorisasjons-URL) ==="
LOC="$(curl -s -o /dev/null -D - -b "$J/cj.txt" "$BASE/api/integrations/google/connect" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')"
echo "$LOC" | head -c 400
echo
echo
echo ">>> redirect_uri som appen FAKTISK sender:"
printf '%s' "$LOC" | grep -oE 'redirect_uri=[^&]*' | sed 's/^redirect_uri=//' \
  | python3 -c 'import sys,urllib.parse;print("   ", urllib.parse.unquote(sys.stdin.read().strip()))' 2>/dev/null \
  || echo "   (fant ingen redirect_uri i Location)"
echo
echo ">>> client_id:"
printf '%s' "$LOC" | grep -oE 'client_id=[^&]*' | head -1
echo
echo
echo "=== 5) TEST den EKTE autorisasjons-URL-en mot Google ==="
BODY="$(mktemp)"
CODE="$(curl -s -L -o "$BODY" -w '%{http_code}' --max-time 30 -A 'Mozilla/5.0' "$LOC")"
echo "final HTTP: $CODE"
if grep -qi 'redirect_uri_mismatch' "$BODY"; then
  echo "RESULTAT: mismatch JA  <-- da er problemet Google-siden, ikke appen"
else
  echo "RESULTAT: mismatch NEI <-- Google godtar denne eksakte URL-en"
fi
grep -oiE 'Error 4[0-9]{2}: [a-z_]+' "$BODY" | head -3
grep -oiE '(invalid_scope|invalid_client|access_denied|admin_policy_enforced|has not been used|is disabled)' "$BODY" | sort -u | head -5
echo
echo "Velykt testbruker (kan slettes): $EMAIL"
