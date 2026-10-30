#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – install/replace the systemd services for THIS folder.
#
# The machine already has "myai-agent" and "myai-web" services, but they point
# at the OLD folder (/home/hesriverp7/Dokumenter/MyGits/MyAI) which no longer
# exists. This script points them at the current folder and restarts them.
#
# Run it YOURSELF (it will ask for your sudo password):
#     bash deploy/install-services.sh
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_UNIT="$REPO_DIR/deploy/myai-agent.service"
WEB_UNIT="$REPO_DIR/deploy/myai-web.service"

# Tjenestene skal kjøre som den som eier repoet, ikke som root. Når scriptet
# kjøres med sudo er det SUDO_USER; ellers gjeldende bruker.
RUN_USER="${AI_SERVICE_USER:-${SUDO_USER:-$(id -un)}}"
RUN_GROUP="$(id -gn "$RUN_USER" 2>/dev/null || echo "$RUN_USER")"

# Finn Node slik brukeren selv ser den, og velg den nyeste versjonen som
# finnes: login-shell, .bashrc (nvm), nvm sin standardmappe og AI_NODE_BIN.
candidates=()
add_candidate() {
  if [ -n "${1:-}" ] && [ -x "$1" ]; then
    candidates+=("$1")
  fi
  return 0
}
add_candidate "${AI_NODE_BIN:-}"
add_candidate "$(sudo -u "$RUN_USER" bash -lc 'command -v node' 2>/dev/null | head -n1)"
add_candidate "$(sudo -u "$RUN_USER" bash -ic 'command -v node' 2>/dev/null | tail -n1)"
add_candidate "$(sudo -u "$RUN_USER" bash -c 'ls -1 "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n1')"

NODE_BIN=""
NODE_VERSION=""
BEST_MAJOR=0
for cand in "${candidates[@]}"; do
  version="$("$cand" --version 2>/dev/null | head -n1 || true)"
  major="${version#v}"
  major="${major%%.*}"
  case "$major" in ''|*[!0-9]*) continue ;; esac
  if [ "$major" -gt "$BEST_MAJOR" ]; then
    BEST_MAJOR="$major"
    NODE_BIN="$cand"
    NODE_VERSION="$version"
  fi
done

if [ -z "$NODE_BIN" ]; then
  echo "✗ Fant ikke node for brukeren $RUN_USER."
  echo "  Installer Node 24 (se docs/ubuntu-server-oppsett.md) eller sett AI_NODE_BIN=/sti/til/node"
  exit 1
fi
if [ "$BEST_MAJOR" -lt 24 ]; then
  echo "! ADVARSEL: nyeste node for $RUN_USER er $NODE_VERSION — repoet krever 24 eller nyere."
fi

NODE_BIN_DIR="$(dirname "$NODE_BIN")"

sed_units() { # <fil>
  sed -e "s|@@REPO@@|$REPO_DIR|g" \
      -e "s|@@USER@@|$RUN_USER|g" \
      -e "s|@@GROUP@@|$RUN_GROUP|g" \
      -e "s|@@NODE_BIN@@|$NODE_BIN_DIR|g" "$1"
}

DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  -h|--help)
    echo "Bruk: sudo bash deploy/install-services.sh [--dry-run]"
    echo "  --dry-run  vis de ferdig utfylte tjenestefilene, endre ingenting"
    exit 0
    ;;
  "") ;;
  *) echo "Ukjent flagg: $1" >&2; exit 2 ;;
esac

echo "Prosjektmappe: $REPO_DIR"
echo "Bruker:        $RUN_USER ($RUN_GROUP)"
echo "Node:          $NODE_BIN ($NODE_VERSION)"
echo

# --- sanity: are the apps built? -------------------------------------------
if [ "$DRY_RUN" = "0" ] && [ ! -f "$REPO_DIR/.output/server/index.mjs" ]; then
  echo "✗ Agenten er ikke bygget. Kjør først:  (cd \"$REPO_DIR\" && npm run build)"
  exit 1
fi
if [ "$DRY_RUN" = "0" ] && [ ! -f "$REPO_DIR/web/.next/BUILD_ID" ]; then
  echo "✗ Web-appen er ikke bygget. Kjør først:  (cd \"$REPO_DIR/web\" && npm run build)"
  exit 1
fi
if [ "$DRY_RUN" = "0" ]; then
  echo "✓ Begge appene er bygget."
  echo
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "--- myai-agent.service ---"
  sed_units "$AGENT_UNIT"
  echo
  echo "--- myai-web.service ---"
  sed_units "$WEB_UNIT"
  echo
  echo "--- myai-healthcheck.service ---"
  sed_units "$REPO_DIR/deploy/myai-healthcheck.service"
  echo
  echo "--- myai-healthcheck.timer ---"
  sed_units "$REPO_DIR/deploy/myai-healthcheck.timer"
  echo
  echo "(dry-run: ingenting er endret)"
  exit 0
fi

# --- stop old services (they reference the old folder) ---------------------
echo "→ Stopper gamle tjenester (hvis de kjører) …"
sudo systemctl stop myai-web myai-agent 2>/dev/null || true

# --- install the unit files -------------------------------------------------
echo "→ Installasjon: /etc/systemd/system/myai-agent.service"
sed_units "$AGENT_UNIT" | sudo tee /etc/systemd/system/myai-agent.service >/dev/null
echo "→ Installasjon: /etc/systemd/system/myai-web.service"
sed_units "$WEB_UNIT" | sudo tee /etc/systemd/system/myai-web.service >/dev/null

# --- health check (ntfy-varsel ved nedetid/krasj-løkke) --------------------
chmod +x "$REPO_DIR/deploy/myai-healthcheck.sh"
echo "→ Installasjon: /etc/systemd/system/myai-healthcheck.service + .timer"
sed_units "$REPO_DIR/deploy/myai-healthcheck.service" \
  | sudo tee /etc/systemd/system/myai-healthcheck.service >/dev/null
sed_units "$REPO_DIR/deploy/myai-healthcheck.timer" \
  | sudo tee /etc/systemd/system/myai-healthcheck.timer >/dev/null

if [ ! -f /etc/myai-alert.env ]; then
  echo "→ Oppretter /etc/myai-alert.env fra malen"
  sudo install -m 600 "$REPO_DIR/deploy/myai-alert.env.example" /etc/myai-alert.env
  echo "  ⚠ Sett NTFY_TOPIC i /etc/myai-alert.env – ellers havner varslene bare i journalen."
fi

echo "→ systemctl daemon-reload"
sudo systemctl daemon-reload

echo "→ Aktiverer tjenestene (starter automatisk ved oppstart)"
sudo systemctl enable myai-agent myai-web

echo "→ Starter tjenestene"
sudo systemctl restart myai-agent
sudo systemctl restart myai-web

echo "→ Aktiverer helsesjekken (hvert 2. minutt, varsler på ntfy)"
sudo systemctl enable --now myai-healthcheck.timer
sudo systemctl start myai-healthcheck.service || true

sleep 3

# --- pek Cloudflare-tunnelen mot samme port som web-appen ------------------
WEB_PORT="$(sed -n 's|^Environment=PORT=||p' "$WEB_UNIT" | head -n1)"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
TUNNEL_CFG="$RUN_HOME/.cloudflared/config.yml"
if [ -n "$WEB_PORT" ] && [ -f "$TUNNEL_CFG" ]; then
  echo "→ Cloudflare-tunnel: tech-ai.tech -> http://localhost:$WEB_PORT"
  cp "$TUNNEL_CFG" "$TUNNEL_CFG.bak.$(date +%s)"
  sudo sed -i -E "s|service: http://localhost:[0-9]+|service: http://localhost:$WEB_PORT|g" "$TUNNEL_CFG"
  sudo systemctl restart cloudflared
  sleep 4
fi

echo
echo "==================== status ===================="
systemctl --no-pager status myai-agent | head -14 || true
echo
systemctl --no-pager status myai-web | head -14 || true
echo
systemctl --no-pager list-timers myai-healthcheck.timer --all || true
echo "==============================================="
echo
echo "Web-app:   http://localhost:${WEB_PORT:-3100}   (https://tech-ai.tech via Cloudflare Tunnel)"
echo "Agent:     http://127.0.0.1:2000"
echo "Super-Server (eget prosjekt): http://127.0.0.1:8000"
echo
echo "Sjekk logger med:  journalctl -u myai-web -f   /   journalctl -u myai-agent -f"
echo "Helsesjekk:        journalctl -u myai-healthcheck -n 30 --no-pager"
echo "Varsel-oppsett:    sudoedit /etc/myai-alert.env   (NTFY_TOPIC)"
