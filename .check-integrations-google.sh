#!/usr/bin/env bash
# Sjekk at Google godtar client_id + redirect_uri for INTEGRASJONENE.
F="web/.env.local"
CID="$(grep -m1 '^GOOGLE_CLIENT_ID=' "$F" | cut -d= -f2- | tr -d '\r')"
[ -n "$CID" ] || CID="$(grep -m1 '^AUTH_GOOGLE_ID=' "$F" | cut -d= -f2- | tr -d '\r')"
BASE="https://tech-ai.tech"

check() {
  local name="$1" redir="$2" scope="$3"
  command -v python3 >/dev/null && RQ="$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$redir")" || RQ="$redir"
  local url="https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CID}&redirect_uri=${RQ}"
  url="${url}&scope=$(printf '%s' "$scope" | sed 's/ /%20/g')&state=diagtest&access_type=offline&prompt=consent"
  local body; body="$(mktemp)"
  local code; code="$(curl -s -o "$body" -w '%{http_code}' --max-time 25 -A 'Mozilla/5.0' "$url")"
  echo "=== $name ==="
  echo "  redirect_uri : $redir"
  echo "  HTTP         : $code"
  if grep -qi 'redirect_uri_mismatch' "$body"; then
    echo "  RESULTAT     : ❌ redirect_uri_mismatch"
  elif grep -qiE 'invalid_client|unauthorized_client|invalid_scope|invalid_request|access_denied|admin_policy_enforced' "$body"; then
    echo -n "  RESULTAT     : ⚠️ "; grep -oiE 'Error 40[0-9]: [a-z_]+' "$body" | head -1
  else
    echo "  RESULTAT     : ✅ godtatt (302 = innloggingssiden)"
  fi
  rm -f "$body"
}

echo "client_id: $CID"
echo
check "Google services"  "$BASE/api/integrations/google/callback"           "openid email https://www.googleapis.com/auth/calendar.readonly"
check "Google Workspace" "$BASE/api/integrations/google_workspace/callback" "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly"
echo
echo "=== appens egen connect-route (forventer 307 -> /signin, dvs. den finnes) ==="
curl -s -o /dev/null -w "  /api/integrations/google/connect -> %{http_code}\n" --max-time 15 "$BASE/api/integrations/google/connect"
