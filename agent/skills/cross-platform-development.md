---
description: Use when writing scripts, CLI tools, automation, or applications that must work on macOS, Linux, and Windows, or when switching between multiple projects in /workspace.
---

# Cross-Platform Development & Multi-Project Mastery (macOS, Linux, Windows)

You run inside an isolated Linux container (`/workspace`), while the user may download and run your code on **macOS (Darwin/BSD)**, **Linux (GNU)**, or **Windows (PowerShell / CMD / Git Bash / WSL)**. Always write code that works reliably on the user's target machine — or across all three platforms simultaneously.

## 1. Continuous Multi-Project Workflow in `/workspace`

- **Never refuse a new project or project switch:** When a user finishes one project and asks for a new project, a new script, or to switch back to an earlier project, immediately create or enter its dedicated folder under `/workspace/<project-name>` (e.g. `/workspace/processs_tool`, `/workspace/web_dashboard`, `/workspace/windows_cleaner`).
- **Bundle only the active project:** When calling `save_artifact`, pass the `directory` parameter pointing to the specific project folder (e.g. `directory: "/workspace/processs_tool"`). This keeps each downloaded artifact clean and separate even when you build 5 different projects in the same chat session.
- **Never leave background processes holding stdout open:** In your sandbox `bash` tool, running `cmd &` without redirecting stdout/stderr/stdin will block the subshell until `cmd` exits or times out! Always redirect all three streams when testing background processes:
  ```bash
  sleep 20 >/dev/null 2>&1 </dev/null &
  ```

## 2. Shell Scripts: macOS (BSD) vs. Linux (GNU) Portability

When writing `.sh` scripts that run on both **macOS** and **Linux**:

1. **Always force `LC_ALL=C` at the top of scripts using `ps`, `sort`, `awk`, or `printf`:**
   - Norwegian/European locales use `,` as the decimal separator (`0,5`), which breaks `sort -k4 -nr` and `awk` numeric comparisons unless `export LC_ALL=C` is set.
2. **macOS `ps` vs. Linux `ps` differences:**
   - On macOS, `ps -Ao pid,comm` prints the **full executable path** (often containing spaces, like `/Applications/Antigravity.app/Contents/MacOS/Electron`), so `$2` in `awk` is truncated at the first space!
   - Instead, use `ps -Ao pid=,ppid=,user=,%cpu=,%mem=,etime=,command=` with `export LC_ALL=C`, and in `awk` extract the command from field 7 onward (`substr($0, index($0, $7))`), or use `pgrep -f -i` when available.
   - Sorting by CPU: on Linux `ps aux --sort=-%cpu` works, but macOS BSD `ps` does **not** support `--sort`. Portable sorting across both macOS and Linux:
     ```bash
     export LC_ALL=C
     ps -Ao pid,ppid,user,%cpu,%mem,etime,command | awk 'NR==1{next} {print}' | sort -k4,4nr | head -n 25
     ```
3. **`sed -i` portability:**
   - macOS BSD `sed` requires `sed -i '' 's/a/b/g' file`, whereas GNU `sed` requires `sed -i 's/a/b/g' file`.
   - Portable alternative: use a temporary file (`sed 's/a/b/g' file > file.tmp && mv file.tmp file`) or `perl -pi -e 's/a/b/g' file` or Python/Node.
4. **OS Detection in Bash:**
   ```bash
   OS_TYPE="$(uname -s 2>/dev/null || echo Unknown)"
   case "$OS_TYPE" in
     Darwin*) PLATFORM="macos" ;;
     Linux*)  PLATFORM="linux" ;;
     MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
     *)       PLATFORM="unknown" ;;
   esac
   ```
5. **Graceful App Shutdown Across Platforms:**
   - **macOS:** `osascript -e 'tell application "AppName" to quit' 2>/dev/null` followed by `SIGTERM` (`kill -15`) and `SIGKILL` (`kill -9`).
   - **Linux:** `wmctrl -c "AppName"` or `pkill -15 -i "AppName"` followed by `pkill -9 -i "AppName"`.
   - **Windows (Git Bash / MSYS / PowerShell):** `taskkill //IM "AppName.exe"` or `Stop-Process -Name "AppName"`.

## 3. Windows Support (PowerShell `.ps1`, Batch `.bat`, or Cross-Platform Python/Node)

- Whenever the user asks for a tool/project that can run on **any machine (macOS, Linux, Windows)**:
  - Include **both** the POSIX shell script (`.sh` for macOS & Linux) **and** a native Windows PowerShell script (`.ps1` / `.bat`) or a zero-dependency cross-platform script (`.py` or `.mjs`) so the project works out-of-the-box on Windows 10/11, macOS, and Linux.
- Always use `path.join` / `pathlib.Path` instead of hardcoded `/` or `\` in Node.js and Python scripts.
- Always strip `\r` (`CRLF`) when parsing command output in bash on Windows/WSL (`tr -d '\r'`).
