#!/usr/bin/env bash
# Diagnose why tech-ai.tech is not reachable from the outside.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$ROOT/.diag-domain3.log"
: > "$LOG"

{
  echo "=== $(date) ==="

  echo
  echo "--- sudo -n tilgjengelig? ---"
  sudo -n true 2>&1; echo "sudo_exit=$?"

  echo
  echo "--- DNS: A / AAAA / www ---"
  if command -v dig >/dev/null; then
    echo "A    : $(dig +short A tech-ai.tech | tr '\n' ' ')"
    echo "AAAA : $(dig +short AAAA tech-ai.tech | tr '\n' ' ')"
    echo "www A: $(dig +short A www.tech-ai.tech | tr '\n' ' ')"
    echo "NS   : $(dig +short NS tech-ai.tech | tr '\n' ' ')"
  else
    getent ahosts tech-ai.tech
  fi

  echo
  echo "--- offentlig IP ---"
  curl -s --max-time 8 https://api.ipify.org; echo

  echo
  echo "--- lyttere 80/443/3000/2000 ---"
  ss -tlnp 2>/dev/null | grep -E ':80\b|:443\b|:3000|:2000' || echo "ingen"

  echo
  echo "--- lokal HTTP port 80 ---"
  curl -s -o /dev/null -w 'http://127.0.0.1:80/ -> %{http_code}\n' --max-time 6 http://127.0.0.1:80/

  echo
  echo "--- lokal HTTPS 443 med SNI tech-ai.tech ---"
  curl -sk -o /dev/null -w 'https://tech-ai.tech (lokal) -> %{http_code}\n' --max-time 6 \
    --resolve tech-ai.tech:443:127.0.0.1 https://tech-ai.tech/

  echo
  echo "--- /etc/caddy/Caddyfile ---"
  cat /etc/caddy/Caddyfile 2>&1

  echo
  echo "--- caddy status ---"
  systemctl status caddy --no-pager 2>&1 | head -12

  echo
  echo "--- caddy logg: sertifikat/feil (siste 60 linjer, filtrert) ---"
  journalctl -u caddy --no-pager -n 60 -o cat 2>&1 | grep -iE 'certificate|obtain|serving|error|acme|tls|challenge|timeout' | tail -30

  echo
  echo "--- caddy sine sertifikater ---"
  sudo -n ls -la /var/lib/caddy/.local/share/caddy/certificates/ 2>&1 | head -10

  echo
  echo "--- ufw ---"
  sudo -n ufw status verbose 2>&1 | head -20

  echo
  echo "--- brannmur-tjenester ---"
  systemctl is-active ufw firewalld 2>&1

  echo
  echo "--- cloudflared ---"
  command -v cloudflared && cloudflared --version 2>&1 | head -1
  ls -la "$HOME/.cloudflared" 2>&1
  systemctl list-units --all --no-pager 2>/dev/null | grep -i cloudflared || echo 'ingen cloudflared-unit'

  echo
  echo "--- apache/nginx ---"
  systemctl is-active apache2 nginx 2>&1

  echo
  echo "--- ekstern port-skan av offentlig IP ---"
  curl -s --max-time 25 'https://api.hackertarget.com/nmap/?q=176.11.4.127' 2>&1 | head -30
} >> "$LOG" 2>&1

echo "DIAG_DOMAIN3_DONE"
