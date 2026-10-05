#!/usr/bin/env bash
# Verifiser at tech-ai.tech er live for omverdenen.
echo "=== $(date) ==="
echo
echo "--- tunnel status ---"
systemctl --no-pager is-active cloudflared
cloudflared tunnel info tech-ai-monkey 2>&1 | head -12
echo
echo "--- lokale HTTPS-kall ---"
for p in / /signin /signup /pricing /privacy /dashboard/apps; do
  curl -s -o /dev/null -w "  https://tech-ai.tech${p}  -> %{http_code}\n" --max-time 15 "https://tech-ai.tech${p}"
done
echo
echo "--- HTTP -> HTTPS redirect ---"
curl -s -o /dev/null -w "  http://tech-ai.tech/  -> %{http_code}  (301/308 = redirect, ok)\n" --max-time 15 http://tech-ai.tech/
echo
echo "--- www ---"
curl -s -o /dev/null -w "  https://www.tech-ai.tech/  -> %{http_code}\n" --max-time 15 https://www.tech-ai.tech/
echo
echo "--- ekstern henting (via r.jina.ai, utenfra) ---"
curl -s --max-time 30 "https://r.jina.ai/https://tech-ai.tech/" 2>&1 | head -25
echo
echo "--- server-headere (utenfra via allorigins) ---"
curl -s --max-time 30 "https://api.allorigins.win/raw?url=https://tech-ai.tech/" -D - -o /dev/null 2>&1 | head -15
