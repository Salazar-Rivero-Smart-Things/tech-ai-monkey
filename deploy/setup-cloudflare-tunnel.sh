#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – sett opp Cloudflare Tunnel for tech-ai.tech -> localhost:3000
#
# Forutsetter at du ALLEREDE har kjørt:   cloudflared tunnel login
# (den åpner nettleser og lager ~/.cloudflared/cert.pem)
#
# Deretter kan dette scriptet kjøres trygt flere ganger (idempotent).
#   bash deploy/setup-cloudflare-tunnel.sh
# ---------------------------------------------------------------------------
set -euo pipefail

TUNNEL_NAME="tech-ai-monkey"
HOST1="tech-ai.tech"
HOST2="www.tech-ai.tech"
APP="http://localhost:3000"

CONF_DIR="$HOME/.cloudflared"
CONF="$CONF_DIR/config.yml"
ID_FILE="$CONF_DIR/${TUNNEL_NAME}.id"
CFD="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"

echo "cloudflared: $CFD"

if [ ! -x "$CFD" ]; then
  echo "✗ cloudflared ikke funnet."; exit 1
fi

if [ ! -f "$CONF_DIR/cert.pem" ]; then
  echo "✗ Ikke logget inn på Cloudflare ennå."
  echo "  Kjør først:  cloudflared tunnel login"
  echo "  (velg sonen tech-ai.tech i nettleseren)"
  exit 1
fi

# --- 1) opprett eller gjenbruk tunnel --------------------------------------
if [ -f "$ID_FILE" ]; then
  TUNNEL_ID="$(cat "$ID_FILE")"
  echo "→ Gjenbruker tunnel $TUNNEL_NAME ($TUNNEL_ID)"
else
  echo "→ Oppretter tunnel: $TUNNEL_NAME"
  OUT="$("$CFD" tunnel create "$TUNNEL_NAME")"
  echo "$OUT"
  TUNNEL_ID="$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  [ -n "$TUNNEL_ID" ] || { echo "✗ Klarte ikke å lese tunnel-ID"; exit 1; }
  echo "$TUNNEL_ID" > "$ID_FILE"
fi

CREDS="$CONF_DIR/${TUNNEL_ID}.json"
if [ ! -f "$CREDS" ]; then
  echo "✗ Mangler credentials-fil: $CREDS"; exit 1
fi

# --- 2) skriv config.yml ----------------------------------------------------
echo "→ Skriver $CONF"
cat > "$CONF" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDS}
no-autoupdate: true

ingress:
  - hostname: ${HOST1}
    service: ${APP}
    originRequest:
      httpHostHeader: ${HOST1}
  - hostname: ${HOST2}
    service: ${APP}
    originRequest:
      httpHostHeader: ${HOST1}
  - hostname: ntfy.tech-ai.tech
    service: http://127.0.0.1:2586
  - service: http_status:404
EOF

# --- 3) DNS-ruting (CNAME -> tunnel) ---------------------------------------
echo "→ Setter DNS for ${HOST1} og ${HOST2}"
for H in "$HOST1" "$HOST2"; do
  if "$CFD" tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$H" 2>/dev/null; then
    echo "  ✓ $H"
  elif "$CFD" tunnel route dns "$TUNNEL_NAME" "$H" 2>/dev/null; then
    echo "  ✓ $H"
  else
    echo "  ⚠ Kunne ikke sette DNS for $H automatisk."
    echo "    (Det finnes trolig en eksisterende A/AAAA-record. Slett den i"
    echo "     Cloudflare → DNS for tech-ai.tech, og kjør scriptet på nytt.)"
  fi
done

# --- 4) systemd-tjeneste ----------------------------------------------------
echo "→ Installerer /etc/systemd/system/cloudflared.service"
sudo -n tee /etc/systemd/system/cloudflared.service >/dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel (tech-ai.tech)
After=network-online.target
Wants=network-online.target

[Service]
User=${USER}
Group=${USER}
ExecStart=${CFD} --no-autoupdate --config ${CONF} tunnel run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo -n systemctl daemon-reload
sudo -n systemctl enable --now cloudflared
sudo -n systemctl restart cloudflared
sleep 4

# --- 5) slå av Caddy (tunnelen tar HTTPS) ----------------------------------
echo "→ Stopper Caddy (unødvendig nå; tunnelen håndterer HTTPS)"
sudo -n systemctl disable --now caddy 2>/dev/null || true

echo
echo "==================== status ===================="
systemctl --no-pager status cloudflared | head -14 || true
echo "==============================================="
echo
echo "→ Tester https://${HOST1}/ fra denne maskinen:"
curl -s -o /dev/null -w "  https://${HOST1}/  -> %{http_code}\n" --max-time 20 "https://${HOST1}/" || echo "  (ingen respons ennå – vent litt og prøv igjen)"
echo
echo "Ferdig. Logg: journalctl -u cloudflared -f"
