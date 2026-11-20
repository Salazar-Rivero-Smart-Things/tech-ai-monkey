@echo off
title Tech AI Monkey - Stop Services
cd /d "%~dp0"

echo ==========================================================
echo        Stopper Tech AI Monkey-tjenester...
echo ==========================================================
echo.

:: 0. Stopp Cloudflare Tunnel
taskkill /F /IM cloudflared.exe >nul 2>&1
if not errorlevel 1 (
    echo [x] Cloudflare Tunnel [cloudflared] stoppet.
) else (
    echo [-] Cloudflare Tunnel kjorte ikke.
)

:: 1. Stopp Web App (port 3100)
for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":3100 " ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [x] Web App (port 3100) stoppet.

:: 2. Stopp AI Agent (port 2000)
for /f "tokens=5" %%a in ('netstat -ano -p tcp ^| findstr ":2000 " ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [x] AI Agent (port 2000) stoppet.

:: 3. Stopp llama-server
taskkill /F /IM llama-server.exe >nul 2>&1
if not errorlevel 1 (
    echo [x] llama-server stoppet.
) else (
    echo [-] llama-server kjorte ikke.
)

:: 4. Stopp PostgreSQL
"%~dp0pgsql\bin\pg_ctl.exe" stop -D "%~dp0pgdata" -m fast >nul 2>&1
if errorlevel 1 (
    taskkill /F /IM postgres.exe >nul 2>&1
)
if exist "%~dp0pgdata\postmaster.pid" (
    del /f /q "%~dp0pgdata\postmaster.pid" >nul 2>&1
)
echo [x] PostgreSQL stoppet.

echo.
echo ==========================================================
echo Alle Tech AI Monkey-tjenester er na stoppet.
echo ==========================================================
echo.
ping -n 4 127.0.0.1 >nul
