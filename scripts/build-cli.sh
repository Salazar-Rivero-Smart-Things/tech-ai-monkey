#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey — build the standalone CLI:
#
#   * Linux   -> web/public/downloads/tech-ai_<version>_amd64.deb
#   * Windows -> web/public/downloads/tech-ai_<version>_windows_x64.exe
#   * checksums.txt with SHA-256 for both
#
# Binaries are compiled with Bun (single-file executables). If Bun is not
# available we fall back to a Node-based .deb (the target machine then needs
# Node.js 18+ and no .exe is produced).
#
# Run:
#     bash scripts/build-cli.sh                  # Linux + Windows
#     bash scripts/build-cli.sh --linux-only     # skip the Windows build
#
# The script verifies what it produces before declaring success: the Linux
# binary is executed, the .deb is read back, and the .exe is checked to be a
# real 64-bit PE. The glibc requirement written into the .deb is measured from
# the binary's own symbols instead of guessed, so the package is not refused by
# dpkg on older-but-capable distributions.
#
# The resulting files are git-ignored (they are large); the /download page on
# the website lists whatever is present in web/public/downloads/.
#
# macOS is NOT built here: the binary can be cross-compiled with
# --target=bun-darwin-arm64 / bun-darwin-x64, but it must be code-signed and
# notarised on a Mac. See docs/macos-bygg-cli.txt.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLI_DIR="$REPO_DIR/cli"
OUT_DIR="$REPO_DIR/web/public/downloads"
VERSION="$(node -p "require('$CLI_DIR/package.json').version" 2>/dev/null || echo 1.0.0)"
PKG="tech-ai"
STAGE="$REPO_DIR/.build/cli"

log() { printf '\033[1m▸\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

LINUX_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --linux-only|--no-windows) LINUX_ONLY=1 ;;
    -h|--help)
      echo "Bruk: bash scripts/build-cli.sh [--linux-only]"
      echo "  Bygger .deb (Linux) og .exe (Windows) til web/public/downloads/"
      exit 0
      ;;
    *) die "Ukjent flagg: $arg" ;;
  esac
done

[ -f "$CLI_DIR/src/index.js" ] || die "Fant ikke cli/src/index.js"
command -v dpkg-deb >/dev/null 2>&1 || die "dpkg-deb mangler (installer dpkg-dev)"

echo "tech-ai CLI $VERSION -> $OUT_DIR"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$OUT_DIR"

# --- 1. locate a compiler -----------------------------------------------------
BUN=""
if command -v bun >/dev/null 2>&1; then
  BUN="bun"
elif command -v npx >/dev/null 2>&1; then
  log "bun er ikke installert – provde a hente det via npx (kan ta litt tid)"
  if npx --yes bun@1 --version >/dev/null 2>&1; then
    BUN="npx --yes bun@1"
  fi
fi

compile_binary() { # <target> <outfile>
  local target="$1" outfile="$2"
  # shellcheck disable=SC2086
  $BUN build "$CLI_DIR/src/index.js" --compile --minify \
    --target="$target" --outfile="$outfile"
}

# --- 2. compile ---------------------------------------------------------------
LINUX_BIN="$STAGE/tech-ai"
WINDOWS_BIN=""
HAVE_BUN=0

if [ -n "$BUN" ]; then
  log "Kompilerer Linux-binær (bun-linux-x64)"
  if compile_binary bun-linux-x64 "$LINUX_BIN"; then
    HAVE_BUN=1
  else
    log "Kompilering feilet – gar over til Node-varianten"
  fi

  if [ "$HAVE_BUN" = "1" ] && [ "$LINUX_ONLY" = "0" ]; then
    log "Kompilerer Windows-binær (bun-windows-x64)"
    WINDOWS_BIN="$STAGE/tech-ai.exe"
    compile_binary bun-windows-x64 "$WINDOWS_BIN" || {
      WINDOWS_BIN=""
      log "Windows-bygget feilet – hopper over .exe"
    }
  fi
else
  log "bun er utilgjengelig – lager en Node-basert .deb i stedet"
fi

if [ "$HAVE_BUN" = "0" ]; then
  cat > "$LINUX_BIN" <<EOF
#!/usr/bin/env node
// Tech AI monkey CLI $VERSION — Node launcher.
// The real implementation is installed under /usr/share/tech-ai-cli.
import("/usr/share/tech-ai-cli/index.js");
EOF
  chmod +x "$LINUX_BIN"
fi

# --- 3. build the .deb --------------------------------------------------------
DEB_ROOT="$STAGE/deb"
mkdir -p "$DEB_ROOT/DEBIAN" "$DEB_ROOT/usr/bin" "$DEB_ROOT/usr/share/doc/$PKG"

log "Setter opp .deb-struktur"
install -m 0755 "$LINUX_BIN" "$DEB_ROOT/usr/bin/tech-ai"
if [ "$HAVE_BUN" = "0" ]; then
  mkdir -p "$DEB_ROOT/usr/share/tech-ai-cli"
  cp -r "$CLI_DIR/src/." "$DEB_ROOT/usr/share/tech-ai-cli/"
  DEPENDS="nodejs (>= 18)"
else
  # Declare the glibc version the binary ACTUALLY needs, measured from its own
  # symbols. Over-declaring makes dpkg refuse the package on older distributions
  # that would run it perfectly well.
  GLIBC_MIN="2.17"
  if command -v objdump >/dev/null 2>&1; then
    MEASURED="$(objdump -T "$LINUX_BIN" 2>/dev/null \
      | grep -oE 'GLIBC_[0-9]+\.[0-9]+' | sed 's/^GLIBC_//' | sort -uV | tail -n1 || true)"
    [ -n "$MEASURED" ] && GLIBC_MIN="$MEASURED"
  else
    log "objdump mangler — bruker konservativ libc6 (>= $GLIBC_MIN)"
  fi
  log "Linux-binæren krever libc6 (>= $GLIBC_MIN)"
  DEPENDS="libc6 (>= $GLIBC_MIN)"
fi

INSTALLED_SIZE="$(du -sk "$DEB_ROOT/usr" | cut -f1)"

cat > "$DEB_ROOT/DEBIAN/control" <<EOF
Package: $PKG
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Depends: $DEPENDS
Installed-Size: $INSTALLED_SIZE
Maintainer: Salazar Rivero Smart Things <support@tech-ai.tech>
Homepage: https://tech-ai.tech
Description: Command-line client for Tech AI monkey
 Ask the Tech AI monkey agent from your terminal. Sign in with Google,
 e-mail/password or an API key, then use "tech-ai ask" or "tech-ai chat".
EOF

cat > "$DEB_ROOT/usr/share/doc/$PKG/README.md" <<EOF
# Tech AI monkey CLI

Install:  sudo dpkg -i ${PKG}_${VERSION}_amd64.deb
Sign in:  tech-ai login
Ask:      tech-ai ask "hello"
Chat:     tech-ai chat

Docs: https://tech-ai.tech/download
EOF

DEB_FILE="$OUT_DIR/${PKG}_${VERSION}_amd64.deb"
log "Bygger $DEB_FILE"
dpkg-deb --build --root-owner-group "$DEB_ROOT" "$DEB_FILE" >/dev/null

# --- 3b. verify what we just built --------------------------------------------
if dpkg-deb -f "$DEB_FILE" >/dev/null 2>&1; then
  log "✓ .deb er gyldig — $(dpkg-deb -f "$DEB_FILE" Depends)"
else
  die ".deb-pakken kunne ikke leses tilbake. Bygget er ugyldig."
fi

if [ "$HAVE_BUN" = "1" ]; then
  if RUNS="$("$LINUX_BIN" --version 2>&1 | head -n1)" && [ -n "$RUNS" ]; then
    log "✓ Linux-binæren kjører: $RUNS"
  else
    die "Linux-binæren ble bygget, men kjører ikke. Avbryter før noe publiseres."
  fi
fi

# --- 4. Windows binary --------------------------------------------------------
EXE_FILE="$OUT_DIR/${PKG}_${VERSION}_windows_x64.exe"
if [ "$LINUX_ONLY" = "1" ]; then
  rm -f "$EXE_FILE"
  log "Hoppet over Windows — ba om --linux-only (.exe fjernet fra nedlastingene)"
elif [ -n "$WINDOWS_BIN" ] && [ -f "$WINDOWS_BIN" ]; then
  cp -f "$WINDOWS_BIN" "$EXE_FILE"
  if command -v file >/dev/null 2>&1; then
    if file "$EXE_FILE" | grep -q 'PE32+'; then
      log "✓ Windows-binæren er en gyldig 64-bit .exe"
    else
      rm -f "$EXE_FILE"
      die "Windows-binæren er ikke en gyldig 64-bit PE — fjernet, ikke publisert."
    fi
  else
    log "Kopierte $EXE_FILE"
  fi
else
  rm -f "$EXE_FILE"
  log "ADVARSEL: ingen .exe ble laget."
  log "          Windows-knappen på /download vil forsvinne. Kjør på nytt med"
  log "          bun tilgjengelig for å få den med igjen."
fi

# --- 5. checksums -------------------------------------------------------------
# Portable SHA-256: sha256sum on Linux, shasum on macOS.
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

log "Skriver checksums.txt"
(
  cd "$OUT_DIR"
  : > checksums.txt
  for f in $(ls -1 tech-ai_* 2>/dev/null | sort); do
    [ -f "$f" ] || continue
    printf '%s  %s\n' "$(hash_file "$f")" "$f" >> checksums.txt
  done
  cat checksums.txt
)

echo
log "Ferdig. Innhold i web/public/downloads:"
ls -lh "$OUT_DIR" | tail -n +2 | sed 's/^/    /'
echo
log "Neste steg (filen må kopieres til serveren som viser tech-ai.tech, og"
log "tjenesten MÅ restartes — Next.js leser public/ ved oppstart):"
echo "    sudo systemctl restart myai-web"
