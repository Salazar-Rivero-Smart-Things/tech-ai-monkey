#!/usr/bin/env bash
# Finn noyaktig redirect_uri som appen sender til Google.
BASE=https://tech-ai.tech
CJ="$(mktemp)"
CSRF_JSON="$(curl -s -c "$CJ" "$BASE/api/auth/csrf")"
TOKEN="$(echo "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
echo "csrf ok: $([ -n "$TOKEN" ] && echo ja || echo NEI)"
echo
echo "=== POST /api/auth/signin/google -> Location ==="
LOC="$(curl -s -i -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/signin/google" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$TOKEN" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')"

echo "$LOC" | head -c 1200
echo
echo
echo "=== redirect_uri sendt til Google ==="
echo "$LOC" | grep -oE 'redirect_uri=[^&]*' | sed 's/redirect_uri=//' | python3 -c 'import sys,urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))' 2>/dev/null \
  || echo "$LOC" | grep -oE 'redirect_uri=[^&]*'

echo
echo "=== client_id sendt (skal matche AUTH_GOOGLE_ID) ==="
echo "$LOC" | grep -oE 'client_id=[^&]*' | head -1

echo
echo "=== providers som er aktive ==="
curl -s "$BASE/api/auth/providers" | head -c 600
echo
rm -f "$CJ"
