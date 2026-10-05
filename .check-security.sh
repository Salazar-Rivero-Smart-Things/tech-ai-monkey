#!/usr/bin/env bash
echo "=== sider ==="
for p in / /signin /privacy /terms /pricing /dashboard/apps /dashboard/privacy; do
  curl -s -o /dev/null -w "  https://tech-ai.tech${p} -> %{http_code}\n" --max-time 15 "https://tech-ai.tech${p}"
done
echo
echo "=== security headers (fra https://tech-ai.tech/) ==="
curl -s -o /dev/null -D - --max-time 15 https://tech-ai.tech/ | tr -d '\r' \
  | grep -iE 'strict-transport-security|content-security-policy|x-content-type-options|x-frame-options|referrer-policy|permissions-policy' \
  | sed 's/^/  /'
echo
echo "=== /api/account/export uten innlogging (skal gi 401) ==="
curl -s -o /dev/null -w "  -> %{http_code}\n" --max-time 15 https://tech-ai.tech/api/account/export
