#!/usr/bin/env bash
# Ekstern HTTP-test av tech-ai.tech fra flere noder
echo "=== check-host.net check-http ==="
ID=$(curl -s -H 'Accept: application/json' \
     "https://check-host.net/check-http?host=https%3A%2F%2Ftech-ai.tech%2F&max_nodes=6" \
     | sed -n 's/.*"request_id":"\([^"]*\)".*/\1/p')
echo "request_id=$ID"
sleep 12
curl -s -H 'Accept: application/json' "https://check-host.net/check-result/${ID}"
echo
echo
echo "=== allorigins (nytt forsok) ==="
curl -s -o /dev/null -w "allorigins -> %{http_code}\n" --max-time 30 \
  "https://api.allorigins.win/raw?url=https://tech-ai.tech/"
echo
echo "=== r.jina.ai (tekst, utenfra) forste linjer ==="
curl -s --max-time 30 "https://r.jina.ai/https://tech-ai.tech/" 2>&1 | sed -n '1,6p'
