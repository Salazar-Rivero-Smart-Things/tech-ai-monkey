#!/usr/bin/env bash
# Temporary diagnostics #3 - never prompt.
export PGCONNECT_TIMEOUT=3
OUT="$PWD/.diag3.txt"
{
  echo "=== kill any stuck psql ==="
  pkill -f "psql postgresql://" 2>/dev/null && echo "killed a psql" || echo "no psql to kill"
  echo
  echo "=== sudo without password? ==="
  sudo -n true 2>&1 && echo "SUDO: passwordless OK" || echo "SUDO: needs password / not allowed"
  echo
  echo "=== postgres superuser reachable? ==="
  sudo -n -u postgres psql -w -Atc "select current_user" 2>&1 | head -3
  echo
  echo "=== databases (via sudo postgres) ==="
  sudo -n -u postgres psql -w -Atc "select datname from pg_database order by 1" 2>&1 | head -30
  echo
  echo "=== roles (via sudo postgres) ==="
  sudo -n -u postgres psql -w -Atc "select rolname from pg_roles order by 1" 2>&1 | head -30
  echo
  echo "=== pg_hba (auth methods) ==="
  sudo -n -u postgres cat /etc/postgresql/18/main/pg_hba.conf 2>&1 | grep -vE '^\s*#' | grep -vE '^\s*$'
} > "$OUT" 2>&1
echo "written $OUT"
