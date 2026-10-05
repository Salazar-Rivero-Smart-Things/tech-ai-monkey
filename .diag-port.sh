#!/usr/bin/env bash
# Er port 80/443 på den offentlige IP-en faktisk åpne utenfra?
IP=176.11.4.127
for PORT in 80 443; do
  echo "=== port $PORT ==="
  ID=$(curl -s -H 'Accept: application/json' \
        "https://check-host.net/check-tcp?host=${IP}:${PORT}&max_nodes=4" \
        | sed -n 's/.*"request_id":"\([^"]*\)".*/\1/p')
  echo "request_id=$ID"
  sleep 9
  curl -s -H 'Accept: application/json' "https://check-host.net/check-result/${ID}"
  echo
done
