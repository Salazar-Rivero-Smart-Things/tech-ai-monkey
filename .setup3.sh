#!/usr/bin/env bash
# Temporary diagnostics #5.
OUT="$PWD/.diag5.txt"
{
  echo "=== MyGits folder ==="
  ls -la /home/hesriverp7/Dokumenter/MyGits/ 2>&1
  echo
  echo "=== Tech-ai-monkey folder ==="
  ls -la /home/hesriverp7/Dokumenter/MyGits/Tech-ai-monkey/ 2>&1
  echo
  echo "=== systemctl status myai-agent ==="
  systemctl status myai-agent --no-pager 2>&1 | head -20
  echo
  echo "=== systemctl status myai-web ==="
  systemctl status myai-web --no-pager 2>&1 | head -20
  echo
  echo "=== systemctl cat myai-agent (current) ==="
  systemctl cat myai-agent --no-pager 2>&1 | head -30
  echo
  echo "=== find DATABASE_URL in MyGits ==="
  grep -rIl --include='.env*' -e 'DATABASE_URL' /home/hesriverp7/Dokumenter/MyGits/ 2>/dev/null | head -20
  echo
  echo "=== all .env* files under MyGits ==="
  find /home/hesriverp7/Dokumenter/MyGits/ -maxdepth 4 -name '.env*' -type f 2>/dev/null | head -40
} > "$OUT" 2>&1
echo "written $OUT"
