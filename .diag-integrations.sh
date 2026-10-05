#!/usr/bin/env bash
echo "=== myai-web status ==="
systemctl --no-pager is-active myai-web
PID="$(systemctl show -p MainPID --value myai-web)"
echo "MainPID=$PID"
echo
echo "=== env i KJORENDE web-prosess (kun navn + lengde, ingen verdier) ==="
if [ -r "/proc/$PID/environ" ]; then
  tr '\0' '\n' < "/proc/$PID/environ" | awk -F= '
    /^(GOOGLE_|AUTH_GOOGLE_|SLACK_)/{
      name=$1; v=substr($0, index($0,"=")+1);
      printf "  %-22s satt=%s len=%d\n", name, (length(v)>0?"JA":"NEI"), length(v)
    }'
else
  echo "  (kunne ikke lese /proc/$PID/environ)"
fi
echo
echo "=== nokler som finnes i web/.env.local ==="
grep -oE '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|AUTH_GOOGLE_ID|AUTH_GOOGLE_SECRET|SLACK_CLIENT_ID|SLACK_CLIENT_SECRET)=' web/.env.local 2>/dev/null | tr -d '='
echo
echo "=== nokler som finnes i rot .env ==="
grep -oE '^[A-Z0-9_]+=' .env 2>/dev/null | tr -d '='
echo
echo "=== web-logg: integration/oauth-treff (siste 200 linjer) ==="
journalctl -u myai-web --no-pager -n 200 2>/dev/null | grep -iE 'integration|oauth|not_configured|redirect_uri|google' | tail -25 || true
echo
echo "=== web-logg: siste 12 linjer ==="
journalctl -u myai-web --no-pager -n 12 2>/dev/null | tail -12
