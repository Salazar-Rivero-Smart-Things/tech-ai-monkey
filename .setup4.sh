#!/usr/bin/env bash
# Temporary diagnostics #6 - read env of the currently-running (old) services.
OUT="$PWD/.diag6.txt"
{
  echo "=== myai-web (pid 3516) env (filtered) ==="
  tr '\0' '\n' < /proc/3516/environ 2>&1 | grep -E '^(DATABASE_URL|NEXT_PUBLIC_APP_URL|EVE_AGENT_URL|AUTH_GOOGLE_ID|GOOGLE_CLIENT_ID|SLACK_CLIENT_ID|HUBSPOT_CLIENT_ID|PAYPAL_ENV|MODEL_NAME|MODEL_VERSION|COMPANY_NAME|SUPPORT_EMAIL)=' | sed -E 's/(=.{6}).*/\1…[masked]/'
  echo
  echo "=== myai-agent (pid 2931/5380) env (filtered) ==="
  tr '\0' '\n' < /proc/2931/environ 2>&1 | grep -E '^(EVE_PUBLIC_URL|PORT|AGENT_API_KEY_SECRET|DEEPSEEK_API_KEY|AI_GATEWAY_API_KEY)=' | sed -E 's/(=.{6}).*/\1…[masked]/'
  echo
  echo "=== full web env: DATABASE_URL length (to detect password) ==="
  tr '\0' '\n' < /proc/3516/environ 2>&1 | grep -E '^DATABASE_URL=' | sed -E 's#(://)([^:]+)(:([^@]*))?@#\1\2:HAS_PASSWORD_OR_NOT@#' | sed -E 's/(@[^/]+\/[^?]+).*/\1/'
  echo
  echo "=== caddy service ==="
  systemctl is-active caddy 2>&1
  systemctl is-enabled caddy 2>&1
  echo "--- /etc/caddy/Caddyfile ---"
  cat /etc/caddy/Caddyfile 2>&1 | head -40
} > "$OUT" 2>&1
chmod 600 "$OUT"
echo "written $OUT"
