# CLI downloads

This folder is served at `/downloads`. It is **git-ignored** — the files here
are build output, not source.

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
| `checksums.txt` | — | SHA-256 for the files above |

Everything is built by `bash scripts/build-cli.sh`, which also verifies what it produced.
The icons come from `cli/assets/` (`python3 scripts/make-icons.py` regenerates them), and
the Windows installer is cross-built on Linux by `makensis` — no emulation layer involved.

The `/download` page on the website lists whatever is present here, together
with the system requirements. If you change what the build produces, update the
requirements text in `web/app/download/page.tsx` too.

## Not built yet

- **macOS** (`bun-darwin-arm64` / `bun-darwin-x64`) — the CLI code already
  handles macOS (it uses `open` to launch the browser), so this is a packaging
  job: compile both targets, wrap them in a `.pkg` or `.dmg`, then **code-sign
  and notarise** with an Apple Developer ID. Planned for macOS 12+.
- **Linux ARM64** (`bun-linux-arm64`) — for Raspberry Pi and ARM servers. Can be
  added to `scripts/build-cli.sh` as an extra target.

## Verifying

```bash
sha256sum tech-ai_1.0.0_amd64.deb
dpkg-deb -f tech-ai_1.0.0_amd64.deb          # metadata (Depends, Arch, Version)
objdump -f tech-ai_1.0.0_windows_x64.exe     # PE header -> x86-64 console app
```
