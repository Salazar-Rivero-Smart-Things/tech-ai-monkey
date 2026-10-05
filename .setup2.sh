#!/usr/bin/env bash
# Temporary diagnostics #4 - never prompt.
export PGCONNECT_TIMEOUT=4
OUT="$PWD/.diag4.txt"
{
  echo "=== ~/.pgpass exists? ==="
  if [ -f "$HOME/.pgpass" ]; then echo "YES (lines: $(wc -l < "$HOME/.pgpass"))"; else echo "NO"; fi
  echo
  echo "=== pg_hba.conf readable? ==="
  if [ -r /etc/postgresql/18/main/pg_hba.conf ]; then
    grep -vE '^\s*#' /etc/postgresql/18/main/pg_hba.conf | grep -vE '^\s*$'
  else
    echo "not readable without sudo"
  fi
  echo
  echo "=== TCP connect as URL user (no prompt) ==="
  psql -w "postgresql://hollmane.salazarrivero@127.0.0.1:5432/tech_ai_monkey" -Atc "select 1" 2>&1 | head -3
  echo
  echo "=== TCP connect, db postgres ==="
  psql -w "postgresql://hollmane.salazarrivero@127.0.0.1:5432/postgres" -Atc "select 1" 2>&1 | head -3
  echo
  echo "=== old deployment folder ==="
  OLD=/home/hesriverp7/Dokumenter/MyGits/MyAI
  if [ -d "$OLD" ]; then
    echo "exists: YES"
    [ -d "$OLD/node_modules" ] && echo "old root node_modules: YES" || echo "old root node_modules: NO"
    [ -d "$OLD/web/node_modules" ] && echo "old web node_modules: YES" || echo "old web node_modules: NO"
    [ -f "$OLD/web/.next/BUILD_ID" ] && echo "old web build: YES" || echo "old web build: NO"
    echo "--- old web/.env.local DATABASE_URL ---"
    grep -E '^DATABASE_URL=' "$OLD/web/.env.local" 2>&1 | head -3
    echo "--- old root .env.agent? ---"
    ls -la "$OLD/.env"* 2>&1
  else
    echo "exists: NO"
  fi
  echo
  echo "=== systemd units for MyAI installed? ==="
  ls -la /etc/systemd/system/myai-*.service 2>&1
  systemctl is-enabled myai-agent myai-web 2>&1 | head -4
  echo
  echo "=== caddy installed? ==="
  command -v caddy || echo "no caddy"
} > "$OUT" 2>&1
echo "written $OUT"
