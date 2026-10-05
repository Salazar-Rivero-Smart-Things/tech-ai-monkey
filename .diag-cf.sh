#!/usr/bin/env bash
# Sjekk Cloudflare-innlogging for cloudflared
CFD="$HOME/.local/bin/cloudflared"
echo "=== cloudflared versjon ==="
"$CFD" --version 2>&1 | head -1
echo
echo "=== ~/.cloudflared ==="
ls -la "$HOME/.cloudflared" 2>&1
echo
echo "=== cert.pem (innlogging) ==="
if [ -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "JA – du er logget inn"
else
  echo "NEI – ikke logget inn ennå"
fi
echo
echo "=== eksisterende tunneler ==="
"$CFD" tunnel list 2>&1 | head -20
