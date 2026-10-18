# CLI downloads

This folder is served at `/downloads`. Build artifacts are git-ignored by
default; released downloads must be explicitly unignored and committed so the
website deployment can serve them.

Build them on the machine that serves the site:

```bash
bash scripts/build-cli.sh
```

That produces:

| File | Platform | Runs on |
| --- | --- | --- |
| `tech-ai_<version>_amd64.deb` | Ubuntu / Debian, 64-bit x86 | Ubuntu 20.04 LTS+ / Debian 11+ tested; the package only needs `libc6 >= 2.17`, so it also installs on Debian 10 and Ubuntu 18.04. Adds an application-menu entry |
| `tech-ai_<version>_windows_x64_setup.exe` | Windows, 64-bit x86 | Windows 10, Windows 11, Windows Server 2019+. Per-user NSIS install: Start-menu entry with the app icon, optional desktop shortcut, PATH entry, uninstaller |
| `tech-ai_<version>_windows_x64.exe` | Windows, 64-bit x86 | The portable single file — no installation, no Start-menu entry, default Windows icon |
| `tech-ai_<version>_macos_universal.dmg` | macOS, Universal | Apple Silicon (M1 and newer), macOS Sequoia 15.7.9 or newer |
| `checksums.txt` | — | SHA-256 for the released files |

The macOS 2.0.0 disk image is served at
`/downloads/tech-ai_2.0.0_macos_universal.dmg`. It contains a universal
(Apple Silicon + Intel) `tech-ai` binary that is ad-hoc signed, but the disk
image itself is **not notarised** with an Apple Developer ID. Its checksum is
listed in `checksums.txt`. It is explicitly unignored in this folder's
`.gitignore`; remember to repeat that exception for future releases.

Installing on macOS without notarisation:

```bash
xattr -dr com.apple.quarantine "/Volumes/Tech AI monkey"
bash "/Volumes/Tech AI monkey/Installer tech-ai.command"
```

On macOS 15 (Sequoia) and newer the old "right-click → Open" shortcut no
longer works; double-clicking the installer is instead approved under
System Settings → Privacy & Security → "Open Anyway".

To ship a warning-free image, sign it with a **Developer ID Application**
certificate (an "Apple Development" certificate is rejected by Apple's notary
service) and notarise it:

```bash
bash scripts/notarize-macos.sh --check   # lists what is missing
bash scripts/notarize-macos.sh           # sign + notarise + staple
```

The script works on macOS with `notarytool`, or on Linux with `rcodesign` and
an App Store Connect API key. See `docs/macos-bygg-cli.txt`.

Everything is built by `bash scripts/build-cli.sh`, which also verifies what it produced.
The macOS image is built by `bash scripts/build-dmg.sh` (cross-compiled with Bun,
packed into HFS+ and wrapped in a UDIF container).
The icons come from `cli/assets/` (`python3 scripts/make-icons.py` regenerates them), and
the Windows installer is cross-built on Linux by `makensis` — no emulation layer involved.

The `/download` page on the website lists whatever is present here, together
with the system requirements. If you change what the build produces, update the
requirements text in `web/app/download/page.tsx` too.

## Not built yet

- **Linux ARM64** (`bun-linux-arm64`) — for Raspberry Pi and ARM servers. Can be
  added to `scripts/build-cli.sh` as an extra target.

## Verifying

```bash
sha256sum tech-ai_2.0.0_amd64.deb
dpkg-deb -f tech-ai_2.0.0_amd64.deb          # metadata (Depends, Arch, Version)
objdump -f tech-ai_2.0.0_windows_x64.exe     # PE header -> x86-64 console app
shasum -a 256 tech-ai_2.0.0_macos_universal.dmg
```
