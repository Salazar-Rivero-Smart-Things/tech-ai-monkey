#!/usr/bin/env bash
# Temporary diagnostics script #2.
OUT="$PWD/.diag2.txt"
{
  echo "=== processes on 2000 / 3000 ==="
  ps -o pid,ppid,etime,cmd -p 5380,3516 2>/dev/null
  echo
  echo "--- all node/next/eve processes ---"
  ps -eo pid,ppid,etime,cmd | grep -iE 'node|next|eve' | grep -v grep
  echo
  echo "=== node_modules present? ==="
  [ -d "$PWD/node_modules" ] && echo "root node_modules: YES ($(du -sh "$PWD/node_modules" 2>/dev/null | cut -f1))" || echo "root node_modules: NO"
  [ -d "$PWD/web/node_modules" ] && echo "web node_modules: YES ($(du -sh "$PWD/web/node_modules" 2>/dev/null | cut -f1))" || echo "web node_modules: NO"
  [ -f "$PWD/web/.next/BUILD_ID" ] && echo "web build: YES" || echo "web build: NO"
  [ -d "$PWD/.next" ] && echo "root .next: YES" || echo "root .next: NO"
  echo
  echo "=== git ==="
  git -C "$PWD" rev-parse --abbrev-ref HEAD 2>&1
  git -C "$PWD" status --short 2>&1 | head -20
  echo
  echo "=== postgres roles ==="
  psql -Atc "select rolname from pg_roles order by 1" 2>&1 | head -20
  echo
  echo "=== postgres databases ==="
  psql -Atc "select datname from pg_database order by 1" 2>&1 | head -20
  echo
  echo "=== can we connect as the URL user? ==="
  psql "postgresql://hollmane.salazarrivero@localhost:5432/tech_ai_monkey" -Atc "select version()" 2>&1 | head -3
} > "$OUT" 2>&1
echo "written $OUT"
