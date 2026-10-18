#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey — sign, notarise and staple the macOS CLI disk image.
#
# Apple blocks unnotarised software, and only a "Developer ID Application"
# certificate can be notarised (an "Apple Development" certificate is not
# enough). Those credentials cannot be created here: they belong to the
# Apple Developer account.
#
# Two supported ways to run it:
#
#   macOS (Xcode Command Line Tools, recommended)
#     export MACOS_SIGN_IDENTITY="Developer ID Application: Navn (TEAMID)"
#     export NOTARY_PROFILE="tech-ai-notary"      # from notarytool store-credentials
#     bash scripts/notarize-macos.sh
#
#   Linux/Windows (rcodesign, no Mac needed)
#     export MACOS_SIGN_P12=/path/developer-id.p12
#     export MACOS_SIGN_P12_PASSWORD='...'
#     export NOTARY_API_KEY_FILE=/path/AuthKey_XXXX.p8   # App Store Connect key
#     export NOTARY_API_KEY_ID=XXXX
#     export NOTARY_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#     bash scripts/notarize-macos.sh
#
# Flags:
#   --check        only report which prerequisites are present, change nothing
#   --sign-only    sign and build the DMG, skip notarisation
#   --skip-build   notarise the DMG already in web/public/downloads
#
# Get the certificate: developer.apple.com → Certificates → "+" →
# "Developer ID Application"; export it (with its private key) as .p12.
# Get the API key: App Store Connect → Users and Access → Integrations →
# App Store Connect API → Team Keys → "+", download the .p8 once.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_DIR/web/public/downloads"
VERSION="$(node -p "require('$REPO_DIR/cli/package.json').version" 2>/dev/null || echo 0.0.0)"
DMG="$OUT_DIR/tech-ai_${VERSION}_macos_universal.dmg"

MODE="full"
for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --sign-only) MODE="sign" ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Ukjent flagg: $arg" >&2; exit 2 ;;
  esac
done
SKIP_BUILD="${SKIP_BUILD:-0}"

log() { printf '\033[1m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

ON_MACOS=0
[ "$(uname -s)" = "Darwin" ] && ON_MACOS=1

# Local, git-ignored defaults: the tool and key this repo prepared.
LOCAL_RCODESIGN="$REPO_DIR/.build/tools/rcodesign"
if [ -x "$LOCAL_RCODESIGN" ] && ! command -v rcodesign >/dev/null 2>&1; then
  PATH="$REPO_DIR/.build/tools:$PATH"
fi
DEFAULT_P12="$REPO_DIR/.build/apple/developer-id.p12"

IDENTITY="${MACOS_SIGN_IDENTITY:-}"
P12="${MACOS_SIGN_P12:-}"
if [ -z "$P12" ] && [ -z "$IDENTITY" ] && [ -f "$DEFAULT_P12" ]; then
  P12="$DEFAULT_P12"
fi
P12_PASSWORD="${MACOS_SIGN_P12_PASSWORD:-}"
PROFILE="${NOTARY_PROFILE:-}"
APPLE_ID="${NOTARY_APPLE_ID:-}"
APPLE_PASSWORD="${NOTARY_PASSWORD:-}"
TEAM_ID="${NOTARY_TEAM_ID:-${MACOS_TEAM_ID:-}}"
API_KEY_FILE="${NOTARY_API_KEY_FILE:-}"
API_KEY_ID="${NOTARY_API_KEY_ID:-}"
API_ISSUER="${NOTARY_API_ISSUER:-}"

have_codesign=0; command -v codesign >/dev/null 2>&1 && have_codesign=1
have_notarytool=0; command -v xcrun >/dev/null 2>&1 && xcrun --find notarytool >/dev/null 2>&1 && have_notarytool=1
have_rcodesign=0; command -v rcodesign >/dev/null 2>&1 && have_rcodesign=1
have_stapler=0; command -v xcrun >/dev/null 2>&1 && xcrun --find stapler >/dev/null 2>&1 && have_stapler=1

signing_ready=0
if [ -n "$IDENTITY" ] && [ "$have_codesign" = "1" ]; then signing_ready=1; fi
if [ -n "$P12" ] && [ "$have_rcodesign" = "1" ]; then signing_ready=1; fi

notary_ready=0
if [ "$have_notarytool" = "1" ] && { [ -n "$PROFILE" ] || { [ -n "$APPLE_ID" ] && [ -n "$APPLE_PASSWORD" ] && [ -n "$TEAM_ID" ]; }; }; then
  notary_ready=1
fi
if [ "$have_rcodesign" = "1" ] && { [ -n "$API_KEY_FILE" ] || { [ -n "$API_KEY_ID" ] && [ -n "$API_ISSUER" ]; }; }; then
  notary_ready=1
fi

report() {
  echo "Tech AI monkey $VERSION — macOS signering/notarisering"
  echo
  echo "Signering:"
  if [ "$signing_ready" = "1" ]; then
    [ -n "$IDENTITY" ] && ok "codesign + \"$IDENTITY\""
    [ -n "$P12" ] && ok "rcodesign + $P12"
  else
    warn "mangler. Trenger ett av:"
    echo "     • macOS: MACOS_SIGN_IDENTITY=\"Developer ID Application: Navn (TEAMID)\" + codesign"
    echo "     • Linux: MACOS_SIGN_P12=/sti/til/developer-id.p12 + rcodesign"
    [ "$have_codesign" = "0" ] && echo "       (codesign finnes ikke her — du er ikke på macOS)"
    [ "$have_rcodesign" = "0" ] && echo "       (rcodesign mangler: cargo install --bin rcodesign apple-codesign)"
  fi
  echo
  echo "Notarisering:"
  if [ "$notary_ready" = "1" ]; then
    [ -n "$PROFILE" ] && ok "notarytool --keychain-profile $PROFILE"
    [ -n "$APPLE_ID" ] && ok "notarytool med Apple ID ($APPLE_ID)"
    [ -n "$API_KEY_FILE$API_KEY_ID" ] && ok "App Store Connect API key"
    [ "$have_notarytool" = "0" ] && [ "$have_rcodesign" = "1" ] && ok "rcodesign notary-submit"
  else
    warn "mangler. Trenger ett av:"
    echo "     • macOS: xcrun notarytool store-credentials \"tech-ai-notary\" \\"
    echo "                --apple-id DIN@EPOST --team-id TEAMID --password xxxx-xxxx-xxxx-xxxx"
    echo "       (sett deretter NOTARY_PROFILE=tech-ai-notary)"
    echo "     • Linux: NOTARY_API_KEY_FILE=AuthKey_XXXX.p8 NOTARY_API_KEY_ID=XXXX \\"
    echo "              NOTARY_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  fi
  echo
  echo "Verktøy: codesign=$have_codesign notarytool=$have_notarytool stapler=$have_stapler rcodesign=$have_rcodesign"
  echo "DMG:    $DMG"
  [ -f "$DMG" ] && ok "finnes ($(du -h "$DMG" | cut -f1))" || warn "finnes ikke ennå"
  echo
  if [ "$signing_ready" = "1" ] && [ "$notary_ready" = "1" ]; then
    ok "Alt er klart — kjør uten --check for å signere og notarisere."
  else
    warn "Kan ikke notarisere ennå. Se det som mangler over."
  fi
}

if [ "$MODE" = "check" ]; then
  report
  [ "$signing_ready" = "1" ] && [ "$notary_ready" = "1" ] && exit 0 || exit 1
fi

[ "$signing_ready" = "1" ] || { report; die "signeringsnøkkel mangler"; }

# --- 1. build (and sign) the DMG -------------------------------------------
if [ "$SKIP_BUILD" = "0" ]; then
  log "Bygger signert DMG"
  if [ -n "$IDENTITY" ]; then
    MACOS_SIGN_IDENTITY="$IDENTITY" bash "$REPO_DIR/scripts/build-dmg.sh"
  else
    MACOS_SIGN_P12="$P12" MACOS_SIGN_P12_PASSWORD="$P12_PASSWORD" \
      bash "$REPO_DIR/scripts/build-dmg.sh"
  fi
else
  [ -f "$DMG" ] || die "$DMG finnes ikke (kjør uten --skip-build)"
  log "Bruker eksisterende DMG"
fi

if [ -n "$IDENTITY" ]; then
  log "Signerer DMG-en"
  codesign --force --timestamp --sign "$IDENTITY" "$DMG"
  codesign --verify --verbose=2 "$DMG"
fi

if [ "$MODE" = "sign" ]; then
  ok "Signert: $DMG"
  echo "Kjør uten --sign-only for å sende til notarisering."
  exit 0
fi

[ "$notary_ready" = "1" ] || { report; die "notariseringspålogging mangler"; }

# --- 2. submit --------------------------------------------------------------
if [ "$have_notarytool" = "1" ] && { [ -n "$PROFILE" ] || [ -n "$APPLE_ID" ]; }; then
  log "Sender til Apple (notarytool)"
  if [ -n "$PROFILE" ]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait
  else
    xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" \
      --team-id "$TEAM_ID" --wait
  fi
elif [ "$have_rcodesign" = "1" ]; then
  log "Sender til Apple (rcodesign)"
  SDK_ARGS=()
  if [ -n "$API_KEY_FILE" ]; then
    # rcodesign reads a JSON file holding issuer_id, key_id and the ECDSA
    # private key as base64 DER (not the raw .p8 PEM).
    if [ "${API_KEY_FILE##*.}" = "p8" ]; then
      [ -n "$API_KEY_ID" ] && [ -n "$API_ISSUER" ] \
        || die "NOTARY_API_KEY_ID og NOTARY_API_ISSUER må være satt sammen med .p8-filen"
      JSON="$API_KEY_FILE.json"
      DER_B64="$(openssl pkey -in "$API_KEY_FILE" -outform DER | base64 | tr -d '\n')"
      python3 - "$JSON" "$API_KEY_ID" "$API_ISSUER" "$DER_B64" <<'PYJSON'
import json, sys
path, key_id, issuer_id, private_key = sys.argv[1:5]
with open(path, "w") as fh:
    json.dump({"issuer_id": issuer_id, "key_id": key_id, "private_key": private_key}, fh)
PYJSON
      chmod 600 "$JSON"
      SDK_ARGS=(--api-key-file "$JSON")
    else
      SDK_ARGS=(--api-key-file "$API_KEY_FILE")
    fi
  else
    SDK_ARGS=(--api-issuer "$API_ISSUER" --api-key "$API_KEY_ID")
  fi
  rcodesign notary-submit --wait --staple "${SDK_ARGS[@]}" "$DMG"
else
  report
  die "fant ingen notariseringsklient"
fi

# --- 3. staple + verify -----------------------------------------------------
if [ "$have_stapler" = "1" ]; then
  log "Stifter billetten fast"
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
elif [ "$have_rcodesign" = "1" ]; then
  rcodesign staple "$DMG" || warn "staple feilet — DMG-en kan fortsatt være notarisert"
fi

if command -v spctl >/dev/null 2>&1; then
  log "Kontrollerer med Gatekeeper"
  spctl -a -t open --context context:primary-signature -vv "$DMG" || \
    warn "spctl avviste DMG-en — sjekk notariseringsloggen"
fi

ok "Ferdig: $DMG"
echo
echo "Neste steg:"
echo "  1. Last opp DMG-en på nytt:  gh release upload v$VERSION \"$DMG\" --clobber"
echo "  2. Oppdater checksums.txt og restarte myai-web."
