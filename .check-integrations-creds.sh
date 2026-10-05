#!/usr/bin/env bash
F="web/.env.local"
echo "=== innhold sjekket KUN som lengde (ingen verdier vises) ==="
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET SLACK_CLIENT_ID SLACK_CLIENT_SECRET; do
  n="$(grep -c "^${k}=" "$F" 2>/dev/null || echo 0)"
  v="$(grep "^${k}=" "$F" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
  printf "  %-22s forekomster=%s  siste_len=%d  satt=%s\n" "$k" "$n" "${#v}" "$([[ -n "$v" ]] && echo JA || echo NEI)"
done
echo
echo "=== roten .env (agent) - relevante ==="
for k in DEEPSEEK_API_KEY AI_GATEWAY_API_KEY AGENT_API_KEY_SECRET EVE_PUBLIC_URL; do
  v="$(grep "^${k}=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r')"
  printf "  %-22s satt=%s len=%d\n" "$k" "$([[ -n "$v" ]] && echo JA || echo NEI)" "${#v}"
done
