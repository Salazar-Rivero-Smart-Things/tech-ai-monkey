#!/usr/bin/env bash
# Temporary: diagnose public domain (Caddy) and agent exposure.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.diag-domain.log"
: > "$LOG"
{
  echo "=== $(date) ==="
  echo
  echo "--- DNS: tech-ai.tech ---"
  (command -v dig >/dev/null && dig +short tech-ai.tech) || getent hosts tech-ai.tech || echo "no dig/getent result"
  echo
  echo "--- local IP ---"
  hostname -I 2>/dev/null
  echo
  echo "--- curl -v mot domenet (kort) ---"
  curl -sv -o /dev/null https://tech-ai.tech/ 2>&1 | grep -iE 'trying|connected|SSL|certificate|HTTP/|error|refused|timed out|resolve' | head -15
  echo
  echo "--- caddy status ---"
  systemctl status caddy --no-pager 2>&1 | head -12
  echo
  echo "--- caddy logg (siste 25) ---"
  journalctl -u caddy -n 25 --no-pager 2>&1 | tail -25
  echo
  echo "--- listener 80/443 ---"
  ss -ltnp 2>/dev/null | grep -E ':80|:443' || echo "ingen pa 80/443"
  echo
  echo "--- ufw ---"
  sudo -n ufw status 2>&1 | head -10 || echo "ufw: krever sudo / ikke satt opp"
} >> "$LOG" 2>&1
echo "DIAG_DOMAIN_DONE"
