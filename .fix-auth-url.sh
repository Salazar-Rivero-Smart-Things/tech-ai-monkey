#!/usr/bin/env bash
# Fiks: appen bak Cloudflare-tunnel trodde den kjorte paa localhost:3000.
# 1) Sett AUTH_URL i web/.env.local   2) Sett httpHostHeader i tunnel-config
set -euo pipefail

F="$PWD/web/.env.local"
echo "=== 1) AUTH_URL i web/.env.local ==="
if grep -q '^AUTH_URL=' "$F"; then
  echo "AUTH_URL finnes allerede:"
  grep '^AUTH_URL=' "$F"
else
  printf '\n# Paakrevd bak Cloudflare-tunnel / reverse proxy\nAUTH_URL=https://tech-ai.tech\n' >> "$F"
  echo "La til:  AUTH_URL=https://tech-ai.tech"
fi

echo
echo "=== 2) cloudflared config: httpHostHeader ==="
CONF_DIR="$HOME/.cloudflared"
CONF="$CONF_DIR/config.yml"
TID="$(cat "$CONF_DIR/tech-ai-monkey.id")"
cp "$CONF" "$CONF.bak.$(date +%s)"
cat > "$CONF" <<EOF
tunnel: ${TID}
credentials-file: ${CONF_DIR}/${TID}.json
no-autoupdate: true

ingress:
  - hostname: tech-ai.tech
    service: http://localhost:3000
    originRequest:
      httpHostHeader: tech-ai.tech
  - hostname: www.tech-ai.tech
    service: http://localhost:3000
    originRequest:
      httpHostHeader: tech-ai.tech
  - service: http_status:404
EOF
echo "Skrev $CONF"

echo
echo "=== 3) restart ==="
sudo -n systemctl restart cloudflared
sudo -n systemctl restart myai-web
sleep 5
systemctl --no-pager is-active cloudflared myai-web
