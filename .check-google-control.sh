#!/usr/bin/env bash
# Kontrolltest: reagerer Google ulikt paa gyldig vs ugyldig redirect_uri?
F="web/.env.local"
CID="$(grep -m1 '^GOOGLE_CLIENT_ID=' "$F" | cut -d= -f2- | tr -d '\r')"
[ -n "$CID" ] || CID="$(grep -m1 '^AUTH_GOOGLE_ID=' "$F" | cut -d= -f2- | tr -d '\r')"
B="https://tech-ai.tech"

probe() {
  local label="$1" redir="$2"
  local enc; enc="$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$redir")"
  local url="https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CID}&redirect_uri=${enc}&scope=openid%20email&state=t&prompt=consent"
  local body; body="$(mktemp)"
  # folg redirects, se om FEILSIDEN dukker opp til slutt
  local code; code="$(curl -s -L -o "$body" -w '%{http_code}' --max-time 30 -A 'Mozilla/5.0' "$url")"
  printf "  %-52s final_http=%s  mismatch=%s\n" "$label" "$code" \
    "$(grep -qi 'redirect_uri_mismatch' "$body" && echo JA || echo nei)"
  rm -f "$body"
}

echo "client_id: $CID"
echo
echo "=== KONTROLL (skal gi mismatch) ==="
probe "BOGUS  /api/integrations/BOGUSx/callback" "$B/api/integrations/BOGUSx/callback"
echo
echo "=== EKTE ==="
probe "google           /api/integrations/google/callback"           "$B/api/integrations/google/callback"
probe "google_workspace /api/integrations/google_workspace/callback" "$B/api/integrations/google_workspace/callback"
probe "login            /api/auth/callback/google"                   "$B/api/auth/callback/google"
echo
echo "=== ekstra varianter (kan avsloere feil host/skjema) ==="
probe "http skjema      http://tech-ai.tech/...google/callback"      "http://tech-ai.tech/api/integrations/google/callback"
probe "localhost        http://localhost:3000/...google/callback"    "http://localhost:3000/api/integrations/google/callback"
probe "www              https://www.tech-ai.tech/...google/callback" "https://www.tech-ai.tech/api/integrations/google/callback"
