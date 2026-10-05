#!/usr/bin/env bash
# Temporary: what does tech-ai.tech actually return, and is cloudflared present?
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.diag-domain2.log"
: > "$LOG"
{
  echo "=== $(date) ==="
  echo
  echo "--- HTTP-status fra domenet (3 forsok) ---"
  for i in 1 2 3; do
    curl -s -o /dev/null -w "forsok $i: http=%{http_code} time=%{time_total}s ip=%{remote_ip}\n" --max-time 12 https://tech-ai.tech/
  done
  echo
  echo "--- forste 300 tegn av svaret ---"
  curl -s --max-time 12 https://tech-ai.tech/ | head -c 300
  echo
  echo
  echo "--- cloudflared installert/kjorer? ---"
  command -v cloudflared && systemctl status cloudflared --no-pager 2>&1 | head -6 || echo "cloudflared: ikke installert"
  echo
  echo "--- offentlig IP ---"
  curl -s --max-time 8 https://api.ipify.org; echo
  echo
  echo "--- hva lytter pa port 8000 ---"
  ps -o pid,cmd -p 2934 2>&1
  echo
  echo "--- alle systemd-tjenester som er aktive (kort) ---"
  systemctl list-units --type=service --state=running --no-pager 2>&1 | grep -iE 'myai|caddy|cloudflared|postgres|apache|nginx' || echo "ingen treff"
} >> "$LOG" 2>&1
echo "DIAG_DOMAIN2_DONE"
