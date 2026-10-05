#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== 0) status FØR bygg ==="
systemctl --no-pager is-active cloudflared myai-web myai-agent 2>&1
curl -s -o /dev/null -w "  https://tech-ai.tech/ -> %{http_code}\n" --max-time 15 https://tech-ai.tech/

echo
echo "=== 1) bygg web (npm run build) ==="
cd "$ROOT/web" || exit 1
npm run build 2>&1 | tail -25
echo "web_build_exit=${PIPESTATUS[0]}"

echo
echo "=== 2) restart web ==="
sudo -n systemctl restart myai-web
sleep 5
systemctl --no-pager is-active myai-web

echo
echo "=== 3) verifiser ==="
for p in / /signin /signup /pricing /privacy /dashboard/apps; do
  curl -s -o /dev/null -w "  https://tech-ai.tech${p} -> %{http_code}\n" --max-time 15 "https://tech-ai.tech${p}"
done
curl -s -o /dev/null -w "  http://127.0.0.1:3000/ (lokal) -> %{http_code}\n" --max-time 8 http://127.0.0.1:3000/
