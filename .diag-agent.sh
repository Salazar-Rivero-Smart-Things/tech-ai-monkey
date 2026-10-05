#!/usr/bin/env bash
# Diagnose: hvorfor feiler myai-agent etter flytting?
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "=== myai-agent status ==="
systemctl --no-pager status myai-agent 2>&1 | head -25
echo
echo "=== siste logg (80 linjer) ==="
journalctl -u myai-agent --no-pager -n 80 -o cat 2>&1
echo
echo "=== port 2000 ==="
ss -ltnp 2>/dev/null | grep -E ':2000' || echo "ingen lytter paa 2000"
echo
echo "=== noekkelfiler i prosjektmappa ==="
for f in .env .output/server/index.mjs node_modules/.bin/eve package.json; do
  if [ -e "$ROOT/$f" ]; then echo "OK      $f"; else echo "MANGLER $f"; fi
done
echo
echo "=== .eve-mappe ==="
ls -la "$ROOT/.eve" 2>&1 | head
echo
echo "=== package.json (scripts) ==="
sed -n '1,45p' "$ROOT/package.json"
