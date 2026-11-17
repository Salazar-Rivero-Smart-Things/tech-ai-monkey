@echo off
setlocal
title Tech AI Monkey - CLI Builder (Windows)
cd /d "%~dp0.."

echo ==========================================================
echo        TECH AI MONKEY v2.1 - CLI BUILDER (Windows .exe)
echo ==========================================================
echo.

if not exist "web\public\downloads" mkdir "web\public\downloads"

echo [1/3] Kompilerer standalone .exe med Bun...
cmd /c "npx --yes bun@latest build cli/src/index.js --compile --minify --target=bun-windows-x64 --outfile=web/public/downloads/tech-ai.exe --windows-icon=cli/assets/icon.ico"
if errorlevel 1 (
    echo [FEIL] Bun-kompilering feilet.
    exit /b 1
)

echo [2/3] Oppretter versjonert fil (tech-ai_2.1.0_windows_x64.exe)...
copy /y "web\public\downloads\tech-ai.exe" "web\public\downloads\tech-ai_2.1.0_windows_x64.exe" >nul

echo [3/3] Beregner SHA-256 kontrollsum...
powershell -NoProfile -Command "Get-FileHash -Path 'web\public\downloads\tech-ai.exe' -Algorithm SHA256 | ForEach-Object { $_.Hash.ToLower() + '  tech-ai.exe' } | Set-Content -Path 'web\public\downloads\checksums.txt' -Encoding utf8"

echo.
echo ==========================================================
echo  BYGG FULLFORT!
echo  Fil:        web\public\downloads\tech-ai.exe
echo  Versjonert: web\public\downloads\tech-ai_2.1.0_windows_x64.exe
echo  Checksum:   web\public\downloads\checksums.txt
echo ==========================================================
echo.
