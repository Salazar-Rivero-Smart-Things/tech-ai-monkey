#!/usr/bin/env bash
DB="$(grep -m1 '^DATABASE_URL=' web/.env.local | cut -d= -f2- | tr -d '\r')"
echo "=== testbrukere ==="
psql -w "$DB" -Atc "select email from \"user\" where email like 'copilot-diag-%';" 2>&1
echo
echo "=== slett (med avhengige rader) ==="
psql -w "$DB" -v ON_ERROR_STOP=0 <<'SQL' 2>&1 | tail -20
DO $$
DECLARE ids text[];
BEGIN
  SELECT array_agg(id::text) INTO ids FROM "user" WHERE email LIKE 'copilot-diag-%';
  IF ids IS NULL THEN RAISE NOTICE 'ingen testbrukere'; RETURN; END IF;
  DELETE FROM integration        WHERE "userId" = ANY(ids);
  DELETE FROM "tokenTransaction" WHERE "userId" = ANY(ids);
  DELETE FROM "tokenBalance"     WHERE "userId" = ANY(ids);
  DELETE FROM subscription       WHERE "userId" = ANY(ids);
  DELETE FROM "auditLog"         WHERE "userId" = ANY(ids);
  DELETE FROM artifact           WHERE "userId" = ANY(ids);
  DELETE FROM notebook           WHERE "userId" = ANY(ids);
  DELETE FROM session            WHERE "userId" = ANY(ids);
  DELETE FROM account            WHERE "userId" = ANY(ids);
  DELETE FROM "user"             WHERE id::text = ANY(ids);
  RAISE NOTICE 'slettet % brukere', array_length(ids,1);
END $$;
SQL
echo
echo "=== igjen ==="
psql -w "$DB" -Atc "select count(*) from \"user\" where email like 'copilot-diag-%';" 2>&1
