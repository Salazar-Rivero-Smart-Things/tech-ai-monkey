#!/usr/bin/env bash
F="web/.env.local"
gid="$(grep -m1 '^GOOGLE_CLIENT_ID=' "$F" | cut -d= -f2- | tr -d '\r')"
aid="$(grep -m1 '^AUTH_GOOGLE_ID=' "$F" | cut -d= -f2- | tr -d '\r')"
gs="$([[ -n "$gid" ]] && echo ja || echo nei)"
as="$([[ -n "$aid" ]] && echo ja || echo nei)"
echo "GOOGLE_CLIENT_ID satt: $gs"
echo "AUTH_GOOGLE_ID   satt: $as"
echo
if [ -n "$gid" ] && [ -n "$aid" ]; then
  [ "$gid" = "$aid" ] && echo "=> SAMME klient (integrasjoner og innlogging deler klient)" \
                      || echo "=> ULIKE klienter! Integrasjoner bruker GOOGLE_CLIENT_ID"
fi
echo
echo "client_ids som brukes:"
echo "  GOOGLE_CLIENT_ID : ${gid:-<tom>}"
echo "  AUTH_GOOGLE_ID   : ${aid:-<tom>}"
echo
echo "callback-URI-er som må registreres på klienten(e):"
for p in google google_workspace slack; do
  echo "  https://tech-ai.tech/api/integrations/${p}/callback"
done
