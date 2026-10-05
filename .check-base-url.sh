#!/usr/bin/env bash
# Hva bruker den KJØRENDE appen som base-URL? (avsløres av Location-header)
B="https://tech-ai.tech"
echo "=== /api/integrations/google/connect (uinnlogget -> /signin) ==="
curl -s -o /dev/null -D - --max-time 15 "$B/api/integrations/google/connect" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: /  Location: /p'
echo
echo "=== /api/integrations/google/callback?error=x (-> /dashboard/apps) ==="
curl -s -o /dev/null -D - --max-time 15 "$B/api/integrations/google/callback?error=x" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: /  Location: /p'
echo
echo "=== samme, men via www ==="
curl -s -o /dev/null -D - --max-time 15 "https://www.tech-ai.tech/api/integrations/google/connect" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: /  Location: /p'
echo
echo "=== og via localhost for sammenligning ==="
curl -s -o /dev/null -D - --max-time 15 "http://127.0.0.1:3000/api/integrations/google/connect" \
  | tr -d '\r' | sed -n 's/^[Ll]ocation: /  Location: /p'
