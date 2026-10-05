#!/usr/bin/env bash
# Nettverk + bygg-artefakter etter diskytting.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo '=== BUILD ARTIFACTS ==='
for f in "$REPO/.output/server/index.mjs" "$REPO/web/.next/BUILD_ID"; do
  [ -f "$f" ] && echo "OK      $f" || echo "MANGLER $f"
done
echo
echo '=== UFW ==='
sudo -n ufw status verbose 2>&1
echo
echo '=== IP / ROUTE ==='
ip -br addr show 2>&1 | grep -v ' lo '
ip route 2>&1 | head -5
echo
echo '=== OFFENTLIG IP ==='
curl -s --max-time 8 https://api.ipify.org; echo
echo
echo '=== LISTENERS 80/443/2000/3000 ==='
sudo -n ss -ltnp 2>/dev/null | grep -E ':(80|443|2000|3000) ' || echo "ingen treff"
echo
echo '=== CADDY SISTE FEIL ==='
sudo -n journalctl -u caddy --no-pager -n 6 2>&1 | tail -6
