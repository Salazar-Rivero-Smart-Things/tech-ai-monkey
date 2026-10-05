#!/usr/bin/env bash
# Diagnose etter at prosjektet ble flyttet til ny disk.
echo '=== SERVICES ==='
systemctl is-active myai-agent myai-web caddy cloudflared 2>&1
echo
echo '=== UNIT FILES ==='
for u in myai-agent myai-web caddy; do
  echo "--- $u ---"
  systemctl cat "$u" 2>/dev/null | grep -E 'WorkingDirectory|ExecStart|EnvironmentFile|^User='
done
echo
echo '=== PORTS ==='
sudo -n ss -ltnp 2>/dev/null | grep -E ':(80|443|2000|3000|8000|8080|8443) ' || echo "ingen treff"
echo
echo '=== CLOUDFLARED ==='
pgrep -a cloudflared || echo 'ikke kjorende'
ls -la "$HOME/.cloudflared" 2>&1
echo
echo '=== PATHS ==='
for p in /home/hesriverp7/Dokumenter/MyGits/Tech-ai-monkey/tech-ai-monkey \
         /run/media/hesriverp7/1CF66753F6672C68/MyGits/Tech-ai-monkey/tech-ai-monkey ; do
  if [ -d "$p" ]; then echo "OK     $p"; else echo "MANGLER $p"; fi
done
