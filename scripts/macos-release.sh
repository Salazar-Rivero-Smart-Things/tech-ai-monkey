#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey — bygg, signer, notariser og stift macOS-DMG-en på en Mac.
#
#   bash scripts/macos-release.sh --check    # hva mangler?
#   bash scripts/macos-release.sh            # gjør alt
#
# Forutsetninger (alt installeres på Mac'en, se docs/macos-usb-release.md):
#   • Xcode Command Line Tools:  xcode-select --install
#   • Bun:                       curl -fsSL https://bun.sh/install | bash
#   • Innlogget i Xcode med Apple Developer-kontoen din, og et
#     «Developer ID Application»-sertifikat i Nøkkelringtilgang
#   • Notariseringspassord lagret én gang:
#       xcrun notarytool store-credentials "tech-ai-notary" \
#         --apple-id DIN@EPOST --team-id TEAMID --password xxxx-xxxx-xxxx-xxxx
#
# Skriptet gjør dette:
#   1. sjekker verktøy og sertifikat
#   2. bygger universal-binæren (arm64 + x86_64) med Bun
#   3. signerer den med hardened runtime (påkrevd for notarisering)
#   4. lager DMG med hdiutil og leser den tilbake for å verifisere innholdet
#   5. signerer DMG-en, sender til Apple og venter på svar
#   6. stifter billetten fast (stapler) og kontrollerer med spctl
#   7. oppdaterer checksums.txt
#
# Etterpå: last opp DMG-en på nytt med
#   gh release upload v2.0.0 web/public/downloads/tech-ai_<v>_macos_universal.dmg --clobber
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

MODE="full"
for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --sign-only) MODE="sign" ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Ukjent flagg: $arg" >&2; exit 2 ;;
  esac
done
SKIP_BUILD="${SKIP_BUILD:-0}"

log() { printf '\033[1m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "dette skriptet må kjøres på macOS"

VERSION="$(node -p "require('$REPO_DIR/cli/package.json').version" 2>/dev/null || echo 0.0.0)"
DMG="$REPO_DIR/web/public/downloads/tech-ai_${VERSION}_macos_universal.dmg"

# --- 1. prerequisites -------------------------------------------------------
have_xcode=0
xcode-select -p >/dev/null 2>&1 && have_xcode=1
have_hdiutil=0; command -v hdiutil >/dev/null 2>&1 && have_hdiutil=1
have_notarytool=0; xcrun --find notarytool >/dev/null 2>&1 && have_notarytool=1
have_stapler=0; xcrun --find stapler >/dev/null 2>&1 && have_stapler=1
have_bun=0; command -v bun >/dev/null 2>&1 && have_bun=1

IDENTITY="${MACOS_SIGN_IDENTITY:-}"
if [ -z "$IDENTITY" ]; then
  IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)"
fi

PROFILE="${NOTARY_PROFILE:-tech-ai-notary}"
have_profile=0
if [ -n "${NOTARY_APPLE_ID:-}" ] && [ -n "${NOTARY_PASSWORD:-}" ] && [ -n "${NOTARY_TEAM_ID:-}" ]; then
  have_profile=1
elif xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  have_profile=1
fi

report() {
  echo "Tech AI monkey $VERSION — macOS release"
  echo
  [ "$have_xcode" = "1" ] && ok "Xcode Command Line Tools" || warn "mangler: xcode-select --install"
  [ "$have_hdiutil" = "1" ] && ok "hdiutil" || warn "hdiutil mangler (skal følge med macOS)"
  [ "$have_bun" = "1" ] && ok "bun $(bun --version 2>/dev/null)" \
    || warn "bun mangler: curl -fsSL https://bun.sh/install | bash"
  if [ -n "$IDENTITY" ]; then
    ok "sertifikat: $IDENTITY"
  else
    warn "fant ikke «Developer ID Application» i nøkkelringen"
    echo "     Xcode → Settings → Accounts → velg konto → Manage Certificates"
    echo "     → «+» → Developer ID Application"
    echo "     (et «Apple Development»-sertifikat kan IKKE notariseres)"
  fi
  if [ "$have_profile" = "1" ]; then
    ok "notariseringspålogging klar"
  else
    warn "notariseringspålogging mangler. Kjør én gang:"
    echo "     xcrun notarytool store-credentials \"$PROFILE\" \\"
    echo "       --apple-id DIN@EPOST --team-id TEAMID --password xxxx-xxxx-xxxx-xxxx"
  fi
  [ "$have_notarytool" = "1" ] && ok "notarytool" || warn "notarytool mangler"
  [ "$have_stapler" = "1" ] && ok "stapler" || warn "stapler mangler"
  echo
  echo "DMG: $DMG"
  [ -f "$DMG" ] && ok "finnes fra før ($(du -h "$DMG" | cut -f1))" || warn "bygges av skriptet"
  echo
  if [ "$have_xcode$have_hdiutil$have_bun" = "111" ] && [ -n "$IDENTITY" ] && [ "$have_profile" = "1" ]; then
    ok "Alt er klart — kjør uten --check."
  else
    warn "Noe mangler; se punktene over."
  fi
}

if [ "$MODE" = "check" ]; then
  report
  exit 0
fi

[ "$have_xcode" = "1" ] || { report; die "Xcode Command Line Tools mangler"; }
[ "$have_hdiutil" = "1" ] || { report; die "hdiutil mangler"; }
[ "$have_bun" = "1" ] || { report; die "bun mangler"; }
[ -n "$IDENTITY" ] || { report; die "Developer ID Application-sertifikat mangler"; }
[ "$have_notarytool" = "1" ] || { report; die "notarytool mangler"; }
[ "$have_profile" = "1" ] || { report; die "notariseringspålogging mangler"; }

# --- 2. build + sign --------------------------------------------------------
if [ "$SKIP_BUILD" = "0" ]; then
  log "Bygger signert DMG"
  MACOS_SIGN_IDENTITY="$IDENTITY" bash "$REPO_DIR/scripts/build-dmg.sh"
else
  [ -f "$DMG" ] || die "$DMG finnes ikke (kjør uten --skip-build)"
  log "Bruker eksisterende DMG"
fi

log "Signerer diskbildet"
codesign --force --timestamp --sign "$IDENTITY" "$DMG"
codesign --verify --verbose=2 "$DMG"

if [ "$MODE" = "sign" ]; then
  ok "Signert: $DMG"
  exit 0
fi

# --- 3. notarise ------------------------------------------------------------
log "Sender til Apple (2–15 minutter)"
if [ -n "${NOTARY_APPLE_ID:-}" ] && [ -n "${NOTARY_PASSWORD:-}" ] && [ -n "${NOTARY_TEAM_ID:-}" ]; then
  set +e
  NOTARY_OUT="$(xcrun notarytool submit "$DMG" \
    --apple-id "$NOTARY_APPLE_ID" \
    --password "$NOTARY_PASSWORD" \
    --team-id "$NOTARY_TEAM_ID" --wait 2>&1)"
  NOTARY_RC=$?
  set -e
else
  set +e
  NOTARY_OUT="$(xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait 2>&1)"
  NOTARY_RC=$?
  set -e
fi
printf '%s\n' "$NOTARY_OUT"

if ! printf '%s' "$NOTARY_OUT" | grep -q 'status: Accepted'; then
  warn "Apple godtok ikke leveransen (se tabellen over)."
  SUBMISSION_ID="$(printf '%s' "$NOTARY_OUT" | sed -n 's/^ *id: *//p' | head -1)"
  if [ -n "$SUBMISSION_ID" ]; then
    echo "Hent begrunnelsen med:"
    echo "  xcrun notarytool log $SUBMISSION_ID --keychain-profile \"$PROFILE\""
  fi
  exit 3
fi
ok "Apple: Accepted"

# --- 4. staple + verify -----------------------------------------------------
log "Stifter billetten fast"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

log "Kontrollerer med Gatekeeper"
if spctl -a -t open --context context:primary-signature -vv "$DMG" 2>&1 | tee /tmp/spctl-dmg.txt | grep -q 'accepted'; then
  ok "Gatekeeper godtar DMG-en ($(grep -o 'source=.*' /tmp/spctl-dmg.txt | head -1))"
else
  warn "spctl avviste DMG-en:"
  cat /tmp/spctl-dmg.txt
fi

# --- 5. checksums -----------------------------------------------------------
log "Oppdaterer checksums.txt"
(
  cd "$REPO_DIR/web/public/downloads"
  : > checksums.txt
  for f in $(ls -1 tech-ai_* 2>/dev/null | sort); do
    [ -f "$f" ] || continue
    printf '%s  %s\n' "$(shasum -a 256 "$f" | awk '{print $1}')" "$f" >> checksums.txt
  done
  cat checksums.txt
)

ok "Ferdig: $DMG"
echo
echo "Neste steg:"
echo "  1. Last opp DMG-en på nytt:"
echo "       gh release upload v$VERSION \"$DMG\" --clobber"
echo "  2. Kopier den nye DMG-en til serveren og restart myai-web."
