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
#     bash scripts/build-cli.sh
#
# The resulting files are git-ignored (they are large); the /download page on
# the website lists whatever is present in web/public/downloads/.
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

[ -f "$CLI_DIR/src/index.js" ] || die "Fant ikke cli/src/index.js"

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

  if [ "$HAVE_BUN" = "1" ]; then
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
  mkdir -p "$STAGE/usr-share"
  cp -r "$CLI_DIR/src" "$STAGE/usr-share/tech-ai-cli"
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
  DEPENDS="libc6 (>= 2.31)"
fi

cat > "$DEB_ROOT/DEBIAN/control" <<EOF
Package: $PKG
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Depends: $DEPENDS
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

# --- 4. Windows binary --------------------------------------------------------
EXE_FILE="$OUT_DIR/${PKG}_${VERSION}_windows_x64.exe"
if [ -n "$WINDOWS_BIN" ] && [ -f "$WINDOWS_BIN" ]; then
  log "Kopierer $EXE_FILE"
  cp -f "$WINDOWS_BIN" "$EXE_FILE"
else
  rm -f "$EXE_FILE"
  log "Ingen .exe produsert"
fi

# --- 5. checksums -------------------------------------------------------------
log "Skriver checksums.txt"
(
  cd "$OUT_DIR"
  : > checksums.txt
  for f in tech-ai_*; do
    [ -f "$f" ] || continue
    sha256sum "$f" >> checksums.txt
  done
  cat checksums.txt
)

echo
log "Ferdig. Innhold i web/public/downloads:"
ls -lh "$OUT_DIR" | tail -n +2 | sed 's/^/    /'
echo
echo "Deploy:  cd web && npm run build && sudo systemctl restart myai-web"
