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
echo [1/4] Kontrollerer PostgreSQL...

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
echo [2/4] Kontrollerer llama-server [GPU]...
netstat -ano -p tcp | find ":8080 " | find "LISTENING" >nul
if errorlevel 1 (
    echo       Starter llama-server med Qwen 2.5 Coder pa RTX 2070...
    start "llama-server GPU" /min "%~dp0llama-cpp\llama-server.exe" -m "%~dp0models\qwen2.5-coder-7b-instruct-q4_k_m.gguf" --port 8080 --host 127.0.0.1 -ngl 99 -c 8192
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
echo [3/4] Kontrollerer AI Agent...
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
echo [4/4] Kontrollerer Web App...
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
echo ==========================================================
echo        ALT ER STARTET OG KJORER LOKALT:
echo ==========================================================
echo  - Nettside / Dashboard: http://localhost:3100
echo  - AI Agent:             http://localhost:2000
echo  - Llama Engine (GPU):   http://localhost:8080
echo  - Database (Postgres):  localhost:5432
echo.
echo Innlogging:
echo  E-post:  riveroosx7@gmail.com
echo  Passord: zzMy7-68F()07
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
