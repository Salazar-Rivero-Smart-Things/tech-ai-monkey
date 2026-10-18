#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Lag en ferdig USB-pakke av prosjektet for bygging på en Mac.
#
#   bash scripts/prepare-macos-usb.sh
#   -> .build/usb/tech-ai-monkey-macos.zip
#
# Pakken inneholder kilden som trengs for å bygge, signere og notarisere
# macOS-CLI-en på Mac'en:
#
#   cli/            CLI-kilde (kompileres av Bun)
#   scripts/        build-dmg.sh, notarize-macos.sh, macos-release.sh …
#   docs/           macos-usb-release.md og de andre guidene
#   agent/, web/    hele appen, hvis du vil kjøre den på Mac'en også
#   .env.example    mal for hemmeligheter (ekte .env følger IKKE med)
#
# Bevisst utelatt: node_modules, .git, .output, .eve, web/.next, .build,
# bøker, videoer og alle hemmelighetsfiler. Pakken blir noen få MB.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_DIR/.build/usb"
STAGE="$OUT_DIR/tech-ai-monkey"
ZIP="$OUT_DIR/tech-ai-monkey-macos.zip"

log() { printf '\033[1m▸\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

command -v rsync >/dev/null 2>&1 || die "rsync mangler"
command -v zip >/dev/null 2>&1 || die "zip mangler"

VERSION="$(node -p "require('$REPO_DIR/cli/package.json').version" 2>/dev/null || echo 0.0.0)"
log "Pakker tech-ai-monkey $VERSION"

rm -rf "$STAGE"
mkdir -p "$STAGE"

rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.build/' \
  --exclude '.output/' \
  --exclude '.eve/' \
  --exclude '.next/' \
  --exclude '.vercel/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'web/.env.local' \
  --exclude 'web/.env' \
  --exclude 'books/*' \
  --exclude 'videos/*' \
  --exclude 'skills/users/' \
  --exclude '*.log' \
  --exclude 'APPLE_DEV_ID.TXT' \
  --exclude 'APPLE_DEV_ID.csr' \
  --exclude '*.cer' \
  --exclude '*.p12' \
  --exclude 'AuthKey_*.p8' \
  --exclude '.agent-memory/' \
  --exclude 'test-*.mjs' \
  --exclude 'patch.mjs' \
  --exclude 'query_db.cjs' \
  --exclude 'shutdown.log' \
  --exclude 'web/public/downloads/*' \
  --exclude '*.dmg' \
  --exclude '*.deb' \
  --exclude '*.exe' \
  --exclude '*.iso' \
  --exclude '.DS_Store' \
  "$REPO_DIR/" "$STAGE/"

# Keep the placeholder files that explain those folders.
mkdir -p "$STAGE/books" "$STAGE/videos" "$STAGE/web/public/downloads"
[ -f "$REPO_DIR/books/README.md" ] && cp "$REPO_DIR/books/README.md" "$STAGE/books/"
[ -f "$REPO_DIR/videos/README.md" ] && cp "$REPO_DIR/videos/README.md" "$STAGE/videos/"
cp "$REPO_DIR/web/public/downloads/README.md" "$STAGE/web/public/downloads/"
cp "$REPO_DIR/web/public/downloads/.gitignore" "$STAGE/web/public/downloads/"

# Start-here file at the top level, in plain text so it opens anywhere.
cp "$REPO_DIR/docs/macos-usb-release.md" "$STAGE/START-HER.md"

# Double-clickable launcher for Mac: runs the whole release flow in Terminal.
cat > "$STAGE/Bygg macOS-DMG.command" <<'LAUNCHER'
#!/bin/bash
# Tech AI monkey - dobbeltklikk for å bygge, signere og notarisere DMG-en.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.bun/bin:$PATH"

echo "=============================================================="
echo " Tech AI monkey - macOS release"
echo "=============================================================="

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun mangler. Installerer ..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

bash scripts/macos-release.sh --check || true
echo
read -r -p "Fortsette med bygg + signering + notarisering? [J/n] " answer
case "$answer" in
  n|N|nei|Nei) echo "Avbrutt."; exit 0 ;;
esac

bash scripts/macos-release.sh
status=$?

echo
if [ "$status" -eq 0 ]; then
  echo "Ferdig. DMG-en ligger i web/public/downloads/."
else
  echo "Bygget stoppet med kode $status - les meldingen over."
fi
read -r -p "Trykk Enter for å lukke ..." _
LAUNCHER
chmod +x "$STAGE/Bygg macOS-DMG.command"

chmod +x "$STAGE"/scripts/*.sh "$STAGE"/scripts/*.py 2>/dev/null || true

log "Lager $ZIP"
rm -f "$ZIP"
( cd "$OUT_DIR" && zip -qr "$ZIP" "tech-ai-monkey" )

SIZE="$(du -h "$ZIP" | cut -f1)"
COUNT="$(unzip -l "$ZIP" | tail -1 | awk '{print $2}')"
log "✓ $ZIP ($SIZE, $COUNT filer)"
echo
echo "Kopier ZIP-en til USB-pinnen, og følg START-HER.md på Mac'en."
echo "Husk: ekte .env / web/.env.local følger ikke med — se START-HER.md."
