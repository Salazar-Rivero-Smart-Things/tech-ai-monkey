#!/usr/bin/env bash
set -euo pipefail

cd /app/web

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[web] Pushing Drizzle SQL schema to PostgreSQL..."
  npx drizzle-kit push --force || echo "[web] Warning: drizzle-kit push returned non-zero, continuing..."
  echo "[web] Ensuring admin account exists..."
  node /app/scripts/seed-admin.mjs || echo "[web] Warning: seed-admin returned non-zero, continuing..."
fi

echo "[web] Starting Next.js on [::]:${PORT:-3100}..."
exec npx next start -H :: -p "${PORT:-3100}"
