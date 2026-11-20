@echo off
title Tech AI Monkey - Master Service Launcher
cd /d "%~dp0"

echo ==========================================================
echo        TECH AI MONKEY v2.1 (llama.cpp + RTX 2070)
echo ==========================================================
echo.

:: -----------------------------------------------------------
:: 1. PostgreSQL [Port 5432]
:: -----------------------------------------------------------
echo [1/5] Kontrollerer PostgreSQL...

:: Rydd opp foreldet postmaster.pid hvis prosessen ikke er i live
if exist "%~dp0pgdata\postmaster.pid" (
    "%~dp0pgsql\bin\pg_ctl.exe" status -D "%~dp0pgdata" >nul 2>&1
    if errorlevel 1 (
        del /f /q "%~dp0pgdata\postmaster.pid" >nul 2>&1
    )
)

netstat -ano -p tcp | find ":5432 " | find "LISTENING" >nul
if errorlevel 1 (
    echo       Starter PostgreSQL [port 5432]...
    "%~dp0pgsql\bin\pg_ctl.exe" start -D "%~dp0pgdata" -w -t 15 >nul 2>&1
    if errorlevel 1 (
        start "PostgreSQL Server" /min "%~dp0pgsql\bin\postgres.exe" -D "%~dp0pgdata" -p 5432
    )
) else (
    echo       PostgreSQL kjorer allerede.
)

:: Vent til port 5432 svarer [maks 10 sekunder]
set PG_OK=0
for /l %%i in (1,1,10) do (
    netstat -ano -p tcp | find ":5432 " | find "LISTENING" >nul && (
        set PG_OK=1
        goto :pg_ready
    )
    ping -n 2 127.0.0.1 >nul
)
:pg_ready
if "%PG_OK%"=="1" (
    echo       [OK] PostgreSQL er klar pa port 5432.
) else (
    echo       [INFO] Fortsetter oppstart...
)

echo.

:: -----------------------------------------------------------
:: 2. llama-server [Port 8080]
:: -----------------------------------------------------------
echo [2/5] Kontrollerer llama-server [GPU]...
netstat -ano -p tcp | find ":8080 " | find "LISTENING" >nul
if errorlevel 1 (
    echo       Starter llama-server med Qwen 2.5 Coder pa RTX 2070...
    start "llama-server GPU" /min "%~dp0llama-cpp\llama-server.exe" -m "%~dp0models\qwen2.5-coder-7b-instruct-q4_k_m.gguf" --port 8080 --host 127.0.0.1 -ngl 99 -c 16384
) else (
    echo       llama-server kjorer allerede.
)

:: Vent til port 8080 svarer [maks 20 sekunder for modellasting til GPU]
set LLAMA_OK=0
for /l %%i in (1,1,20) do (
    curl.exe -s --max-time 1 http://127.0.0.1:8080/health >nul 2>&1 && (
        set LLAMA_OK=1
        goto :llama_ready
    )
    ping -n 2 127.0.0.1 >nul
)
:llama_ready
if "%LLAMA_OK%"=="1" (
    echo       [OK] llama-server er klar pa port 8080.
) else (
    echo       [INFO] llama-server laster ferdig i bakgrunnen.
)

echo.

:: -----------------------------------------------------------
:: 3. AI Agent [Port 2000]
:: -----------------------------------------------------------
echo [3/5] Kontrollerer AI Agent...
netstat -ano -p tcp | find ":2000 " | find "LISTENING" >nul
if errorlevel 1 (
    echo       Starter AI Agent [port 2000]...
    start "Tech AI Monkey - Agent" /min cmd /c "npm.cmd run start"
) else (
    echo       AI Agent kjorer allerede.
)

:: Vent til port 2000 svarer [maks 15 sekunder]
set AGENT_OK=0
for /l %%i in (1,1,15) do (
    netstat -ano -p tcp | find ":2000 " | find "LISTENING" >nul && (
        set AGENT_OK=1
        goto :agent_ready
    )
    ping -n 2 127.0.0.1 >nul
)
:agent_ready
if "%AGENT_OK%"=="1" (
    echo       [OK] AI Agent er klar pa port 2000.
) else (
    echo       [INFO] AI Agent starter ferdig i bakgrunnen.
)

echo.

:: -----------------------------------------------------------
:: 4. Web Application [Port 3100]
:: -----------------------------------------------------------
echo [4/5] Kontrollerer Web App...
netstat -ano -p tcp | find ":3100 " | find "LISTENING" >nul
if errorlevel 1 (
    echo       Starter Web App [port 3100]...
    start "Tech AI Monkey - Web" /d "%~dp0web" /min cmd /c "npm.cmd run start"
) else (
    echo       Web App kjorer allerede.
)

:: Vent til port 3100 svarer [maks 20 sekunder]
set WEB_OK=0
for /l %%i in (1,1,20) do (
    netstat -ano -p tcp | find ":3100 " | find "LISTENING" >nul && (
        set WEB_OK=1
        goto :web_ready
    )
    ping -n 2 127.0.0.1 >nul
)
:web_ready
if "%WEB_OK%"=="1" (
    echo       [OK] Web App er klar pa port 3100.
) else (
    echo       [INFO] Web App initialiserer i bakgrunnen.
)

echo.

:: -----------------------------------------------------------
:: 5. Cloudflare Tunnel [https://tech-ai.tech -> localhost:3100]
:: -----------------------------------------------------------
echo [5/5] Kontrollerer Cloudflare Tunnel [tech-ai.tech]...

:: Les CLOUDFLARE_TUNNEL_TOKEN fra .env hvis satt
set "CF_TOKEN="
if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
        if /i "%%A"=="CLOUDFLARE_TUNNEL_TOKEN" set "CF_TOKEN=%%B"
    )
)

:: Finn cloudflared.exe (PATH eller Program Files)
set "CFD_EXE="
for /f "delims=" %%C in ('where cloudflared 2^>nul') do if not defined CFD_EXE set "CFD_EXE=%%C"
if not defined CFD_EXE if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" set "CFD_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not defined CFD_EXE if exist "C:\Program Files\cloudflared\cloudflared.exe" set "CFD_EXE=C:\Program Files\cloudflared\cloudflared.exe"

tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /I "cloudflared.exe" >nul
if not errorlevel 1 (
    echo       [OK] Cloudflare Tunnel [cloudflared] kjorer allerede.
) else (
    if not defined CFD_EXE (
        echo       [ADVARSEL] cloudflared.exe er ikke installert pa denne PC-en!
        echo       Installer med:  winget install --id Cloudflare.cloudflared
        echo       Og legg inn CLOUDFLARE_TUNNEL_TOKEN=... i .env eller kjor: cloudflared tunnel login
    ) else (
        if defined CF_TOKEN (
            echo       Starter Cloudflare Tunnel med CLOUDFLARE_TUNNEL_TOKEN fra .env...
            start "Tech AI Monkey - Cloudflare Tunnel" /min "%CFD_EXE%" tunnel --no-autoupdate run --token %CF_TOKEN%
            echo       [OK] Cloudflare Tunnel startet [https://tech-ai.tech].
        ) else if exist "%USERPROFILE%\.cloudflared\config.yml" (
            echo       Starter Cloudflare Tunnel med %USERPROFILE%\.cloudflared\config.yml...
            start "Tech AI Monkey - Cloudflare Tunnel" /min "%CFD_EXE%" tunnel --no-autoupdate --config "%USERPROFILE%\.cloudflared\config.yml" run
            echo       [OK] Cloudflare Tunnel startet [https://tech-ai.tech].
        ) else (
            echo       [ADVARSEL] Fant verken CLOUDFLARE_TUNNEL_TOKEN i .env eller %USERPROFILE%\.cloudflared\config.yml!
            echo       Legg til CLOUDFLARE_TUNNEL_TOKEN=din-token i .env og kjor dette scriptet pa nytt.
        )
    )
)

echo.
echo ==========================================================
echo        ALT ER STARTET OG KJORER:
echo ==========================================================
echo  - Offentlig nettside:   https://tech-ai.tech
echo  - Lokal Dashboard:      http://localhost:3100
echo  - AI Agent:             http://localhost:2000
echo  - Llama Engine (GPU):   http://localhost:8080
echo  - Database (Postgres):  localhost:5432
echo ==========================================================
echo.
echo Apner http://localhost:3100 i nettleseren...
start http://localhost:3100
echo.
echo [INFO] Alle tjenester kjorer na i bakgrunnen.
echo For a stoppe alt: kjor stop-tech-ai-monkey.bat
echo.
echo Dette vinduet lukkes om 8 sekunder...
ping -n 9 127.0.0.1 >nul
