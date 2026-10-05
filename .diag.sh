#!/usr/bin/env bash
# Temporary diagnostics script.
OUT="$PWD/.diag.txt"
{
  echo "=== node ==="
  node -v
  echo "=== npm ==="
  npm -v
  echo "=== npx ==="
  npx -v
  echo "=== user / home ==="
  whoami
  echo "$HOME"
  echo "=== OS ==="
  head -4 /etc/os-release 2>/dev/null
  echo "=== DB binaries ==="
  command -v psql || echo "no psql"
  command -v pg_ctlcluster || echo "no pg_ctlcluster"
  command -v mariadb || echo "no mariadb"
  command -v mysql || echo "no mysql"
  echo "=== DB services ==="
  systemctl list-units --type=service --all 2>/dev/null | grep -iE 'postgres|mysql|mariadb' || echo "none"
  echo "=== listening ports (3000/2000/5432/3306) ==="
  (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(3000|2000|5432|3306)\b' || echo "none"
  echo "=== disk ==="
  df -h / | tail -1
} > "$OUT" 2>&1
echo "diagnostics written to $OUT"
