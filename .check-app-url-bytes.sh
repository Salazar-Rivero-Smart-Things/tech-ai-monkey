#!/usr/bin/env bash
F="web/.env.local"
echo "=== NEXT_PUBLIC_APP_URL / AUTH_URL: lengde + raa bytes (cat -A) ==="
grep -nE '^(NEXT_PUBLIC_APP_URL|AUTH_URL)=' "$F" | cat -A
echo
echo "=== lengde paa siste verdi (skal vaere 19 for https://tech-ai.tech) ==="
for k in NEXT_PUBLIC_APP_URL AUTH_URL; do
  v="$(grep "^${k}=" "$F" | tail -1 | cut -d= -f2-)"
  printf "  %-22s len=%d\n" "$k" "${#v}"
done
echo
echo "=== hva node lager av base og redirect_uri (samme logikk som appen) ==="
node -e '
const fs=require("fs");
const raw=fs.readFileSync("web/.env.local","utf8");
const line=raw.split(/\r?\n/).filter(l=>l.startsWith("NEXT_PUBLIC_APP_URL=")).pop()||"";
const val=line.slice("NEXT_PUBLIC_APP_URL=".length);
console.log("  raa verdi JSON:", JSON.stringify(val), "len", val.length);
const base=val.replace(/\/+$/,"");
console.log("  base         :", JSON.stringify(base));
console.log("  redirect_uri :", JSON.stringify(base+"/api/integrations/google/callback"));
'
