#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey — build the macOS CLI disk image (universal, unsigned).
#
#   web/public/downloads/tech-ai_<version>_macos_universal.dmg
#
# The CLI is cross-compiled with Bun for both Apple Silicon and Intel, merged
# into one universal Mach-O, placed in an HFS+ image together with an
# installer script and a README, and wrapped in a UDIF (.dmg) container.
#
# Apple signing/notarisation can only be done on a Mac with a Developer ID —
# see docs/macos-bygg-cli.txt. This script produces an ad-hoc signed binary in
# an unnotarised image, so users must right-click → Open the first time.
#
# Requires (all installable without root except where noted):
#   bun                      npm i bun   (or npx bun@1)
#   mkfs.hfsplus, fsck.hfsplus   apt install hfsprogs   [needs root once]
#   hfsplus, dmg             built from github.com/planetbeing/libdmg-hfsplus
#                            (set HFSPLUS_TOOL / DMG_TOOL if not on PATH)
#
# Run:
#     bash scripts/build-dmg.sh
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI_DIR="$REPO_DIR/cli"
OUT_DIR="$REPO_DIR/web/public/downloads"
VERSION="$(node -p "require('$CLI_DIR/package.json').version" 2>/dev/null || echo 0.0.0)"
STAGE="$REPO_DIR/.build/dmg"
VOLUME_NAME="Tech AI monkey"
OUT_FILE="$OUT_DIR/tech-ai_${VERSION}_macos_universal.dmg"

log() { printf '\033[1m▸\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

BUN=""
if command -v bun >/dev/null 2>&1; then
  BUN="bun"
elif npx --yes bun@1 --version >/dev/null 2>&1; then
  BUN="npx --yes bun@1"
else
  die "bun mangler (npm i bun)"
fi

MKFS="$(command -v mkfs.hfsplus || true)"
FSCK="$(command -v fsck.hfsplus || true)"
HFSPLUS_TOOL="${HFSPLUS_TOOL:-$(command -v hfsplus || true)}"
DMG_TOOL="${DMG_TOOL:-$(command -v dmg || true)}"
[ -n "$MKFS" ] || die "mkfs.hfsplus mangler (sudo apt install hfsprogs)"
[ -n "$HFSPLUS_TOOL" ] || die "hfsplus mangler (bygg planetbeing/libdmg-hfsplus, sett HFSPLUS_TOOL)"
[ -n "$DMG_TOOL" ] || die "dmg mangler (bygg planetbeing/libdmg-hfsplus, sett DMG_TOOL)"

log "tech-ai CLI $VERSION -> $OUT_FILE"
rm -rf "$STAGE"
mkdir -p "$STAGE" "$OUT_DIR"

compile() { # <bun-target> <outfile>
  # shellcheck disable=SC2086
  $BUN build "$CLI_DIR/src/index.js" --compile --minify --target="$1" --outfile "$2" >/dev/null
}

log "Kompilerer arm64 (bun-darwin-arm64)"
compile bun-darwin-arm64 "$STAGE/tech-ai-arm64"
log "Kompilerer x86_64 (bun-darwin-x64)"
compile bun-darwin-x64 "$STAGE/tech-ai-x64"

log "Slår sammen til universal Mach-O"
node "$REPO_DIR/scripts/make-universal-macho.mjs" \
  "$STAGE/tech-ai-arm64" "$STAGE/tech-ai-x64" "$STAGE/tech-ai-universal"

cat > "$STAGE/README.txt" <<EOF
Tech AI monkey - CLI for macOS (universal)
Versjon $VERSION

Innhold i dette diskbildet:
  tech-ai                     Universal binær (Apple Silicon + Intel)
  Installer tech-ai.command   Automatisk installasjon til /usr/local/bin
  README.txt                  Denne filen

Installasjon manuelt
--------------------
1. Apne Terminal.
2. Kopier binæren til /usr/local/bin:
     sudo cp "/Volumes/$VOLUME_NAME/tech-ai" /usr/local/bin/tech-ai
     sudo chmod 755 /usr/local/bin/tech-ai
3. Fjern karantene (DMG-en er ikke notarisert av Apple):
     xattr -d com.apple.quarantine /usr/local/bin/tech-ai 2>/dev/null || true
4. Start:
     tech-ai

Automatisk installasjon
-----------------------
Dobbeltklikk "Installer tech-ai.command". macOS kan sperre den fordi den
kommer fra en ikke-notarisert DMG: høyreklikk -> Åpne første gang.

VIKTIG
------
Binæren er ad-hoc-signert, men DMG-en er ikke signert og notarisert med
Apple Developer-ID (det kan bare gjøres på en Mac med Apple-sertifikat).
Hvis macOS blokkerer: høyreklikk -> Åpne, eller kjør:
     xattr -dr com.apple.quarantine "/Volumes/$VOLUME_NAME"
EOF

cat > "$STAGE/Installer tech-ai.command" <<'EOF'
#!/bin/bash
# Tech AI monkey - installerer CLI-en fra dette diskbildet til /usr/local/bin.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/tech-ai"

[ -f "$BIN" ] || { echo "Fant ikke tech-ai i $DIR" >&2; exit 1; }
chmod +x "$BIN" 2>/dev/null || true

echo "Installerer tech-ai til /usr/local/bin ..."
sudo install -m 755 "$BIN" /usr/local/bin/tech-ai
sudo xattr -d com.apple.quarantine /usr/local/bin/tech-ai 2>/dev/null || true
echo "Ferdig. Versjon:"
/usr/local/bin/tech-ai --version || true
echo
echo "Start med: tech-ai"
EOF
chmod +x "$STAGE/Installer tech-ai.command"

log "Lager HFS+ image ($VOLUME_NAME)"
IMG="$STAGE/TechAI.img"
truncate -s 320M "$IMG"
"$MKFS" -v "$VOLUME_NAME" "$IMG" >/dev/null

"$HFSPLUS_TOOL" "$IMG" add "$STAGE/tech-ai-universal" /tech-ai
"$HFSPLUS_TOOL" "$IMG" add "$STAGE/README.txt" /README.txt
"$HFSPLUS_TOOL" "$IMG" add "$STAGE/Installer tech-ai.command" "/Installer tech-ai.command"
"$HFSPLUS_TOOL" "$IMG" chmod 755 /tech-ai
"$HFSPLUS_TOOL" "$IMG" chmod 755 "/Installer tech-ai.command"

if [ -n "$FSCK" ]; then
  "$FSCK" -n "$IMG" >/dev/null || die "HFS+-volumet er ikke gyldig"
  log "✓ HFS+ volumet er gyldig (fsck.hfsplus)"
fi

log "Pakker til DMG"
"$DMG_TOOL" build "$IMG" "$OUT_FILE" >/dev/null

# Read it back: the DMG must contain the universal binary byte for byte.
"$DMG_TOOL" extract "$OUT_FILE" "$STAGE/verify.img" >/dev/null 2>&1 \
  || die "kunne ikke lese tilbake DMG-en"
"$HFSPLUS_TOOL" "$STAGE/verify.img" extract /tech-ai "$STAGE/verify-tech-ai" >/dev/null
if cmp -s "$STAGE/verify-tech-ai" "$STAGE/tech-ai-universal"; then
  log "✓ DMG-en inneholder den universelle binæren (byte-identisk)"
else
  die "binæren i DMG-en er ikke identisk med den byggede binæren"
fi

HASH="$(sha256sum "$OUT_FILE" | awk '{print $1}')"
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}
(
  cd "$OUT_DIR"
  : > checksums.txt
  for f in $(ls -1 tech-ai_* 2>/dev/null | sort); do
    [ -f "$f" ] || continue
    printf '%s  %s\n' "$(hash_file "$f")" "$f" >> checksums.txt
  done
)
log "✓ $(basename "$OUT_FILE") — $(du -h "$OUT_FILE" | cut -f1), sha256 $HASH"
log "checksums.txt oppdatert"
