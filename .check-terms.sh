#!/usr/bin/env bash
for p in /terms /privacy /copyright /pricing; do
  curl -s -o /dev/null -w "https://tech-ai.tech${p} -> %{http_code}\n" --max-time 15 "https://tech-ai.tech${p}"
done
echo "--- tittel paa /terms ---"
curl -s --max-time 15 https://tech-ai.tech/terms | grep -oE '<title>[^<]*</title>' | head -1
