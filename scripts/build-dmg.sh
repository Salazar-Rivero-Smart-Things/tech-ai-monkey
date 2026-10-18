#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey — build the macOS CLI disk image (universal).
#
#   web/public/downloads/tech-ai_<version>_macos_universal.dmg
#
# The CLI is cross-compiled with Bun for both Apple Silicon and Intel, merged
# into one universal Mach-O, placed in an HFS+ image together with an
# installer script and a README, and wrapped in a UDIF (.dmg) container.
#
# Signing is optional and controlled by MACOS_SIGN_IDENTITY. When it is set
# the universal binary is signed with the hardened runtime before it goes into
# the image, which is what Apple's notary service requires. Use
# scripts/notarize-macos.sh to sign, build, notarise and staple in one go.
# Without an identity the binary keeps Bun's ad-hoc signature and the image is
# unnotarised — users then have to approve it once (System Settings →
# Privacy & Security → "Open Anyway" on macOS 15+, see README.txt in the DMG).
#
# Requires (all installable without root except where noted):
#   bun                      npm i bun   (or npx bun@1)
#   mkfs.hfsplus, fsck.hfsplus   apt install hfsprogs   [needs root once]
#   hfsplus, dmg             built from github.com/planetbeing/libdmg-hfsplus
#                            (set HFSPLUS_TOOL / DMG_TOOL if not on PATH)
#   codesign                 only when MACOS_SIGN_IDENTITY is set (macOS)
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

# On macOS the system tools (hdiutil, fsck_hfs) build and verify the image;
# elsewhere we need the Linux helpers.
USE_HDIUTIL=0
if [ "$(uname -s 2>/dev/null)" = "Darwin" ] && command -v hdiutil >/dev/null 2>&1; then
  USE_HDIUTIL=1
fi

MKFS="$(command -v mkfs.hfsplus || true)"
FSCK="$(command -v fsck.hfsplus || command -v fsck_hfs || true)"
HFSPLUS_TOOL="${HFSPLUS_TOOL:-$(command -v hfsplus || true)}"
DMG_TOOL="${DMG_TOOL:-$(command -v dmg || true)}"
if [ "$USE_HDIUTIL" = "0" ]; then
  [ -n "$MKFS" ] || die "mkfs.hfsplus mangler (sudo apt install hfsprogs)"
  [ -n "$HFSPLUS_TOOL" ] || die "hfsplus mangler (bygg planetbeing/libdmg-hfsplus, sett HFSPLUS_TOOL)"
  [ -n "$DMG_TOOL" ] || die "dmg mangler (bygg planetbeing/libdmg-hfsplus, sett DMG_TOOL)"
fi

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

SIGN_IDENTITY="${MACOS_SIGN_IDENTITY:-}"
SIGN_P12="${MACOS_SIGN_P12:-}"
if [ -n "$SIGN_IDENTITY" ]; then
  command -v codesign >/dev/null 2>&1 \
    || die "MACOS_SIGN_IDENTITY er satt, men codesign finnes ikke (kjør på macOS)"
  log "Signerer med: $SIGN_IDENTITY"
  codesign --force --options runtime --timestamp \
    --sign "$SIGN_IDENTITY" "$STAGE/tech-ai-universal"
  codesign --verify --strict --verbose=2 "$STAGE/tech-ai-universal"
elif [ -n "$SIGN_P12" ]; then
  command -v rcodesign >/dev/null 2>&1 \
    || die "MACOS_SIGN_P12 er satt, men rcodesign mangler (cargo install --bin rcodesign apple-codesign)"
  log "Signerer med rcodesign og $SIGN_P12"
  # --for-notarization krever Developer ID-sertifikat, tidsstempel og slår på
  # hardened runtime - alt Apple krever for at notariseringen skal godtas.
  if [ -n "${MACOS_SIGN_P12_PASSWORD:-}" ]; then
    rcodesign sign --p12-file "$SIGN_P12" \
      --p12-password "$MACOS_SIGN_P12_PASSWORD" --for-notarization \
      "$STAGE/tech-ai-universal" "$STAGE/tech-ai-universal.signed"
  else
    rcodesign sign --p12-file "$SIGN_P12" --for-notarization \
      "$STAGE/tech-ai-universal" "$STAGE/tech-ai-universal.signed"
  fi
  mv "$STAGE/tech-ai-universal.signed" "$STAGE/tech-ai-universal"
fi

if [ -n "$SIGN_IDENTITY" ]; then
  GATEKEEPER_NOTE="Dette diskbildet er signert og notarisert med Apple Developer ID, så
macOS åpner det uten advarsel."
else
  GATEKEEPER_NOTE="Dette diskbildet er IKKE notarisert med Apple Developer ID. macOS 15
(Sequoia) og nyere blokkerer derfor dobbeltklikk på installasjonsskriptet
første gang. Åpne det slik (én av disse):

  A) Terminal (anbefalt - ett steg):
       xattr -dr com.apple.quarantine \"/Volumes/$VOLUME_NAME\"
       bash \"/Volumes/$VOLUME_NAME/Installer tech-ai.command\"

  B) Systeminnstillinger:
       Dobbeltklikk skriptet -> lukk advarselen ->
       Systeminnstillinger -> Personvern og sikkerhet -> 'Åpne likevel'.

  Merk: på macOS 15+ fjernet Apple snarveien 'høyreklikk -> Åpne', så den
  virker ikke lenger for ikke-notariserte filer."
fi

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
3. Start:
     tech-ai

Automatisk installasjon
-----------------------
Kjor skriptet fra Terminal:
     bash "/Volumes/$VOLUME_NAME/Installer tech-ai.command"

$GATEKEEPER_NOTE
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

if [ "$USE_HDIUTIL" = "1" ]; then
  log "Lager DMG med hdiutil ($VOLUME_NAME)"
  STAGE_DIR="$STAGE/volume"
  mkdir -p "$STAGE_DIR"
  cp "$STAGE/tech-ai-universal" "$STAGE_DIR/tech-ai"
  cp "$STAGE/README.txt" "$STAGE_DIR/README.txt"
  cp "$STAGE/Installer tech-ai.command" "$STAGE_DIR/Installer tech-ai.command"
  chmod 755 "$STAGE_DIR/tech-ai" "$STAGE_DIR/Installer tech-ai.command"
  chmod 644 "$STAGE_DIR/README.txt"

  # UDZO is the compressed read-only format Apple's own tooling produces.
  hdiutil create -quiet -ov -volname "$VOLUME_NAME" -fs HFS+ \
    -format UDZO -srcfolder "$STAGE_DIR" "$OUT_FILE"

  MNT="$STAGE/mnt"
  mkdir -p "$MNT"
  hdiutil attach -quiet -readonly -nobrowse -mountpoint "$MNT" "$OUT_FILE"
  if cmp -s "$MNT/tech-ai" "$STAGE/tech-ai-universal"; then
    log "✓ DMG-en inneholder den universelle binæren (byte-identisk)"
  else
    hdiutil detach -quiet "$MNT" || true
    die "binæren i DMG-en er ikke identisk med den byggede binæren"
  fi
  hdiutil detach -quiet "$MNT"
else
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
fi

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}
HASH="$(hash_file "$OUT_FILE")"
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
