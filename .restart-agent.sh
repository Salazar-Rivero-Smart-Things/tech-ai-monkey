#!/usr/bin/env bash
# Restart agenten og vent til den svarer paa helse-endepunktet.
set -u
sudo -n systemctl restart myai-agent
echo "→ restartet, venter ..."
code=""
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:2000/eve/v1/health || true)"
  echo "forsok $i: HTTP ${code:-000}"
  [ "$code" = "200" ] && break
  sleep 3
done
echo
echo "=== status ==="
systemctl --no-pager status myai-agent 2>&1 | head -12
echo
echo "=== logg (siste 30) ==="
journalctl -u myai-agent --no-pager -n 30 -o cat 2>&1
echo
echo "=== port 2000 ==="
ss -ltnp 2>/dev/null | grep ':2000' || echo "ingen lytter paa 2000"
