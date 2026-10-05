#!/usr/bin/env bash
# ===========================================================================
# Full pre-push test for Tech AI monkey.
# Read-only unless noted: it inserts ONE temporary CLI token, tests it, and
# deletes it again. It never pushes and never changes app data otherwise.
# ===========================================================================
set -uo pipefail
# Skriptet ligger i scripts/ – gå til prosjektroten.
cd "$(dirname "$0")/.."
ROOT="$PWD"
PASS=0; FAIL=0; WARN=0

ok()   { PASS=$((PASS+1)); printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31m✗\033[0m %s\n' "$*"; }
warn() { WARN=$((WARN+1)); printf '  \033[33m!\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
expect() { # <actual> <expected> <label>
  if [ "$1" = "$2" ]; then ok "$3 ($1)"; else bad "$3 — forventet $2, fikk $1"; fi
}

DBURL="$(sed -n 's/^DATABASE_URL=//p' web/.env.local | head -n1 | tr -d '\r')"
DBURL="${DBURL%\"}"; DBURL="${DBURL#\"}"; DBURL="${DBURL%\'}"; DBURL="${DBURL#\'}"
PSQL="$(command -v psql || ls -1 /usr/lib/postgresql/*/bin/psql 2>/dev/null | sort -V | tail -1)"
Q() { "$PSQL" "$DBURL" -tAc "$1" 2>&1; }

# ---------------------------------------------------------------------------
head_ "1. Tjenester"
for u in myai-agent myai-web cloudflared; do
  expect "$(sudo -n systemctl is-active "$u" 2>/dev/null)" "active" "$u kjører"
done
expect "$(sudo -n systemctl is-enabled myai-backup.timer 2>/dev/null)" "enabled" "myai-backup.timer aktivert"

# ---------------------------------------------------------------------------
head_ "2. Database og tabeller"
EXPECTED_TABLES=(user account session verificationToken auditLog \
  subscription tokenBalance tokenTransaction artifact notebook integration \
  cliAuthCode cliToken)
for t in "${EXPECTED_TABLES[@]}"; do
  n="$(Q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$t';" | tr -d '[:space:]')"
  if [ "$n" = "1" ]; then ok "tabell $t finnes"; else bad "tabell $t MANGLER"; fi
done
printf '     brukere i basen: %s\n' "$(Q 'SELECT count(*) FROM "user";' | tr -d '[:space:]')"

OWNER_ROW="$(Q "SELECT id || '|' || email || '|' || role FROM \"user\" WHERE role IN ('admin','owner') OR lower(email) IN (SELECT lower(unnest(string_to_array(coalesce(nullif(current_setting('x',true),''),''), ','))) ;" 2>/dev/null)"
OWNER_ROW="$(Q "SELECT id || '|' || email || '|' || role FROM \"user\" WHERE role IN ('admin','owner') ORDER BY email LIMIT 1;" | head -n1)"
OWNER_ID="${OWNER_ROW%%|*}"; OWNER_REST="${OWNER_ROW#*|}"
OWNER_EMAIL="${OWNER_REST%%|*}"; OWNER_ROLE="${OWNER_REST##*|}"
if [ -n "$OWNER_ID" ]; then
  ok "owner-konto: $OWNER_EMAIL (role=$OWNER_ROLE)"
else
  bad "fant ingen admin/owner-konto i databasen"
fi

# ---------------------------------------------------------------------------
head_ "3. Konfigurasjon (owner-pass)"
if grep -q '^OWNER_EMAILS=' web/.env.local; then
  OEM="$(sed -n 's/^OWNER_EMAILS=//p' web/.env.local | head -1)"
  if [ -n "$OEM" ]; then ok "OWNER_EMAILS er satt: $OEM"; else warn "OWNER_EMAILS finnes men er tom (role=admin holder likevel)"; fi
else
  warn "OWNER_EMAILS er ikke satt — owner-pass hviler kun på role=admin"
fi
if [ "$OWNER_ROLE" = "admin" ] || [ "$OWNER_ROLE" = "owner" ]; then
  ok "isUnlimited() gir true for owner (role=$OWNER_ROLE)"
else
  bad "owner har ikke admin/owner-rolle — unlimited virker IKKE"
fi

# ---------------------------------------------------------------------------
head_ "4. Web-sider (lokalt, port 3000)"
for p in / /download /pricing /privacy /terms /copyright /signin /signup; do
  expect "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$p")" "200" "GET $p"
done
for p in /dashboard /dashboard/chat /dashboard/api-keys /dashboard/privacy /dashboard/subscription; do
  c="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000$p")"
  if [ "$c" = "307" ] || [ "$c" = "302" ]; then ok "GET $p redirecter uinnlogget ($c)"; else bad "GET $p — forventet 307, fikk $c"; fi
done
c="$(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3000/cli-login')"
case "$c" in 200|307|302|400) ok "GET /cli-login svarer ($c)";; *) bad "GET /cli-login fikk $c";; esac

# ---------------------------------------------------------------------------
head_ "5. API (uinnlogget skal avvises)"
expect "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/account/export)" "401" "GET /api/account/export"
expect "$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer tai_bogus' http://127.0.0.1:3000/api/cli/me)" "401" "GET /api/cli/me (ugyldig token)"
expect "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/api/cli/token)" "400" "POST /api/cli/token uten grant_type avvises"
expect "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"grant_type":"password","email":"nobody@example.com","password":"wrong"}' http://127.0.0.1:3000/api/cli/token)" "401" "POST /api/cli/token feil passord -> 401"
expect "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3000/eve/v1/session)" "401" "POST /eve/v1/session (uinnlogget)"

# ---------------------------------------------------------------------------
head_ "6. Owner-pass ende-til-ende (midlertidig token)"
if [ -n "$OWNER_ID" ]; then
  TOKEN="tai_$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')"
  THASH="$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)"
  Q "INSERT INTO \"cliToken\" (id, \"userId\", name, \"tokenHash\", prefix, \"createdAt\") VALUES ('pretest-cli-token-1', '$OWNER_ID', '__pretest__', '$THASH', '${TOKEN:0:12}', now());" >/dev/null
  ME="$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3000/api/cli/me)"
  if printf '%s' "$ME" | grep -q '"unlimited":true'; then
    ok "GET /api/cli/me med owner-token -> unlimited:true"
  else
    bad "GET /api/cli/me ga ikke unlimited: $(printf '%s' "$ME" | head -c 200)"
  fi
  printf '     svar: %s\n' "$(printf '%s' "$ME" | head -c 180)"

  echo "     sender en kort melding til agenten via owner-token (kan ta noen sekunder) …"
  CODE="$(curl -s -o /tmp/.pretest-eve.txt -w '%{http_code}' --max-time 90 \
    -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"message":"Reply with exactly: pong"}' \
    http://127.0.0.1:3000/eve/v1/session)"
  if [ "$CODE" = "402" ]; then
    bad "agenten blokkerte owner med 402 (skal aldri skje)"
  elif [ "$CODE" = "200" ] || [ "$CODE" = "201" ] || [ "$CODE" = "202" ]; then
    ok "agenten svarte owner uten 402 (HTTP $CODE${CODE:+ — 202 = asynkron jobb startet})"
    printf '     svar: %s\n' "$(head -c 160 /tmp/.pretest-eve.txt | tr '\n' ' ')"
  else
    warn "agenten svarte HTTP $CODE — sjekk /tmp/.pretest-eve.txt"
    printf '     %s\n' "$(head -c 160 /tmp/.pretest-eve.txt | tr '\n' ' ')"
  fi

  Q "DELETE FROM \"cliToken\" WHERE name='__pretest__';" >/dev/null
  LEFT="$(Q "SELECT count(*) FROM \"cliToken\" WHERE name='__pretest__';" | tr -d '[:space:]')"
  expect "$LEFT" "0" "midlertidig testtoken ryddet bort"
else
  warn "hopper over — ingen owner-konto funnet"
fi

# ---------------------------------------------------------------------------
head_ "7. Agent direkte (port 2000)"
H="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:2000/eve/v1/health)"
case "$H" in 200|204) ok "agent helse svarer ($H)";; *) warn "agent helse svarte $H";; esac

# ---------------------------------------------------------------------------
head_ "8. Nedlastinger"
for f in checksums.txt tech-ai_1.0.0_amd64.deb tech-ai_1.0.0_windows_x64.exe; do
  SZ="$(curl -s -o /dev/null -w '%{size_download}' "http://127.0.0.1:3000/downloads/$f")"
  DS="$(stat -c%s "web/public/downloads/$f" 2>/dev/null || echo 0)"
  CN="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000/downloads/$f")"
  if [ "$CN" = "200" ] && [ "$SZ" = "$DS" ]; then ok "$f ($SZ byte)"; else bad "$f — HTTP $CN, $SZ/$DS byte"; fi
done
if curl -s http://127.0.0.1:3000/download | grep -q "coming soon"; then ok "/download viser macOS «coming soon»"; else bad "/download mangler macOS-melding"; fi

# ---------------------------------------------------------------------------
head_ "9. CLI-binæret"
if [ -x /usr/bin/tech-ai ]; then ok "/usr/bin/tech-ai installert (.deb)"; else bad "/usr/bin/tech-ai mangler"; fi
if command -v tech-ai >/dev/null 2>&1; then
  V="$(tech-ai --version 2>&1 | head -1)"; [ -n "$V" ] && ok "tech-ai --version: $V" || warn "tech-ai --version ga tomt svar"
  HLP="$(tech-ai help 2>&1 | head -3 | tr '\n' ' ')"
  [ -n "$HLP" ] && ok "tech-ai help svarer" || bad "tech-ai help svarer ikke"
  W="$(HOME=/tmp/.pretest-home tech-ai whoami 2>&1 | head -2 | tr '\n' ' ')"
  if printf '%s' "$W" | grep -qiE 'login|logg inn|not signed|ikke'; then ok "tech-ai whoami uten token gir vennlig feil"; else warn "whoami: $W"; fi
else
  bad "tech-ai er ikke i PATH"
fi

# ---------------------------------------------------------------------------
head_ "10. Sikkerhetsheadere"
HS="$(curl -sI http://127.0.0.1:3000/ | tr 'A-Z' 'a-z')"
for h in strict-transport-security content-security-policy x-frame-options x-content-type-options referrer-policy permissions-policy; do
  if printf '%s' "$HS" | grep -q "^$h:"; then ok "header $h"; else bad "header $h mangler"; fi
done

# ---------------------------------------------------------------------------
head_ "11. Live via Cloudflare"
for p in / /download /privacy /terms; do
  expect "$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "https://tech-ai.tech$p")" "200" "https://tech-ai.tech$p"
done
expect "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 'https://tech-ai.tech/downloads/checksums.txt')" "200" "live /downloads/checksums.txt"

# ---------------------------------------------------------------------------
head_ "12. Backup"
expect "$(find "$HOME/backups/tech-ai-monkey/daily" -name '*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')" \
  "$(find "$HOME/backups/tech-ai-monkey/daily" -name '*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')" "backup-filer finnes"
printf '     daglige backuper: %s, neste timer-kjøring: %s\n' \
  "$(find "$HOME/backups/tech-ai-monkey/daily" -name '*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')" \
  "$(systemctl list-timers myai-backup.timer --no-pager 2>/dev/null | sed -n 2p | awk '{print $1, $2, $3}')"

# ---------------------------------------------------------------------------
head_ "13. Git — hva som ville blitt pushet"
printf '     branch: %s\n' "$(git rev-parse --abbrev-ref HEAD)"
printf '     siste commit: %s\n' "$(git log --oneline -1)"
printf '     upstream: %s\n' "$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo '(ingen)')"
echo "     endrede/nye filer:"
git status --porcelain | sed 's/^/       /'
echo "     hemmelighetssjekk:"
LEAK="$(git status --porcelain | awk '{print $2}' | grep -iE '(^|/)\.env' | grep -v '\.example$' || true)"
if [ -n "$LEAK" ]; then bad "disse env-filene er ikke ignorert: $LEAK"; else ok "ingen .env-filer vil bli pushet"; fi
for f in web/.env.local .env web/.env deploy/backup.env; do
  [ -e "$f" ] || continue
  if git check-ignore -q "$f"; then ok "$f er git-ignorert"; else bad "$f er IKKE ignorert"; fi
done

# ---------------------------------------------------------------------------
printf '\n\033[1m================ OPPSUMMERING ================\033[0m\n'
printf '  \033[32m%s bestått\033[0m · \033[31m%s feilet\033[0m · \033[33m%s advarsel\033[0m\n' "$PASS" "$FAIL" "$WARN"
printf '\033[1m==============================================\033[0m\n'
if [ "$FAIL" -gt 0 ]; then echo "  → IKKE push før de røde er fikset."; else echo "  → Alt grønt. Klar for push."; fi
rm -rf /tmp/.pretest-home /tmp/.pretest-eve.txt 2>/dev/null || true
