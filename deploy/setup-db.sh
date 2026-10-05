#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – local PostgreSQL setup.
#
# Creates a database role + database that match web/.env.local, writes the
# resulting DATABASE_URL into web/.env.local, and creates all tables with
# drizzle-kit. It does NOT delete an existing database.
#
# Run it YOURSELF (it will ask for your sudo password):
#     bash deploy/setup-db.sh
#
# Override names if you like:
#     DB_NAME=mydb DB_USER=myuser bash deploy/setup-db.sh
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$REPO_DIR/web"
ENV_FILE="$WEB_DIR/.env.local"

DB_NAME="${DB_NAME:-tech_ai_monkey}"
DB_USER="${DB_USER:-tech_ai_monkey}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

command -v openssl >/dev/null 2>&1 || { echo "✗ openssl mangler"; exit 1; }
command -v psql    >/dev/null 2>&1 || { echo "✗ psql mangler (installer postgresql-client)"; exit 1; }

DB_PASS="$(openssl rand -hex 24)"

echo "→ Oppretter/oppdaterer Postgres-rollen '$DB_USER' …"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

echo "→ Oppretter databasen '$DB_NAME' (hvis den ikke finnes) …"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "→ Gir '$DB_USER' eierskap/tilgang til skjemaet …"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" \
  -c "ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" \
  -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${DB_USER};" \
  -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};" \
  >/dev/null

NEW_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if [ -f "$ENV_FILE" ] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  # Replace the first active DATABASE_URL line (URL has no '|' so it is safe).
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${NEW_URL}|" "$ENV_FILE"
else
  printf '\nDATABASE_URL=%s\n' "$NEW_URL" >> "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"
echo "→ Skrev DATABASE_URL til $ENV_FILE"

echo "→ Oppretter tabellene med drizzle-kit push …"
cd "$WEB_DIR"
# drizzle-kit only auto-loads ".env", not ".env.local", so pass it explicitly.
DATABASE_URL="$NEW_URL" npx drizzle-kit push

echo
echo "✓ Ferdig. Test med:"
echo "    psql '${NEW_URL}' -c '\\dt'"
echo "Deretter:  bash deploy/install-services.sh"
