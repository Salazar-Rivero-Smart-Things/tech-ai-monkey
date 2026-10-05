#!/usr/bin/env bash
# List nokkelNAVN (ikke verdier) i web/.env.local + roten .env
echo "=== web/.env.local: nokkelNavn ==="
grep -oE '^[A-Za-z0-9_]+=' web/.env.local 2>/dev/null | tr -d '=' | sort
echo
echo "=== .env: nokkelNavn ==="
grep -oE '^[A-Za-z0-9_]+=' .env 2>/dev/null | tr -d '=' | sort
echo
echo "=== AUTH/URL-relaterte noekler (navn + om de har verdi) ==="
grep -E '^(AUTH_URL|NEXTAUTH_URL|AUTH_TRUST_HOST|NEXTAUTH_SECRET|AUTH_SECRET|SITE_URL|NEXT_PUBLIC_SITE_URL)=' web/.env.local .env 2>/dev/null \
  | sed -E 's/=(.*)/= <satt>/'
