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

echo "Prosjektmappe: $REPO_DIR"
echo

# --- sanity: are the apps built? -------------------------------------------
if [ ! -f "$REPO_DIR/.output/server/index.mjs" ]; then
  echo "✗ Agenten er ikke bygget. Kjør først:  (cd \"$REPO_DIR\" && npm run build)"
  exit 1
fi
if [ ! -f "$REPO_DIR/web/.next/BUILD_ID" ]; then
  echo "✗ Web-appen er ikke bygget. Kjør først:  (cd \"$REPO_DIR/web\" && npm run build)"
  exit 1
fi
echo "✓ Begge appene er bygget."
echo

# --- stop old services (they reference the old folder) ---------------------
echo "→ Stopper gamle tjenester (hvis de kjører) …"
sudo systemctl stop myai-web myai-agent 2>/dev/null || true

# --- install the unit files -------------------------------------------------
echo "→ Installasjon: /etc/systemd/system/myai-agent.service"
sed "s|@@REPO@@|$REPO_DIR|g" "$AGENT_UNIT" | sudo tee /etc/systemd/system/myai-agent.service >/dev/null
echo "→ Installasjon: /etc/systemd/system/myai-web.service"
sed "s|@@REPO@@|$REPO_DIR|g" "$WEB_UNIT" | sudo tee /etc/systemd/system/myai-web.service >/dev/null

echo "→ systemctl daemon-reload"
sudo systemctl daemon-reload

echo "→ Aktiverer tjenestene (starter automatisk ved oppstart)"
sudo systemctl enable myai-agent myai-web

echo "→ Starter tjenestene"
sudo systemctl restart myai-agent
sudo systemctl restart myai-web

sleep 3
echo
echo "==================== status ===================="
systemctl --no-pager status myai-agent | head -14 || true
echo
systemctl --no-pager status myai-web | head -14 || true
echo "==============================================="
echo
echo "Web-app:   http://localhost:3000   (og https://tech-ai.tech via Caddy)"
echo "Agent:     http://127.0.0.1:2000"
echo
echo "Sjekk logger med:  journalctl -u myai-web -f   /   journalctl -u myai-agent -f"
