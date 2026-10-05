#!/usr/bin/env bash
# Sjekk at Google godtar client_id + redirect_uri (dvs. ingen redirect_uri_mismatch).
BASE=https://tech-ai.tech
CJ="$(mktemp)"
T="$(curl -s -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
LOC="$(curl -s -i -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/signin/google" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=$T" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')"

echo "redirect_uri sendt:"
echo "$LOC" | grep -oE 'redirect_uri=[^&]*'
echo
echo "client_id sendt:"
echo "$LOC" | grep -oE 'client_id=[^&]*' | head -1
echo

BODY="$(mktemp)"
CODE="$(curl -s -o "$BODY" -w '%{http_code}' --max-time 25 -A 'Mozilla/5.0' "$LOC")"
echo "Google svarer HTTP: $CODE"
echo
if grep -qi 'redirect_uri_mismatch' "$BODY"; then
  echo "RESULTAT: ❌ redirect_uri_mismatch – URI-en er fortsatt ikke lagret/aktiv i Google Console"
  grep -oiE 'Error 400: [a-z_]+' "$BODY" | head -1
elif grep -qiE 'invalid_client|unauthorized_client' "$BODY"; then
  echo "RESULTAT: ⚠️ annen feil:"
  grep -oiE 'Error 40[0-9]: [a-z_]+' "$BODY" | head -1
else
  echo "RESULTAT: ✅ Google godtar client_id + redirect_uri (consent-/innloggingsside)"
fi
rm -f "$CJ" "$BODY"
