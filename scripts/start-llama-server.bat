@echo off
set MODEL=%~1
if "%MODEL%"=="" (
  for %%f in (models\*.gguf) do set MODEL=%%f
)
if "%MODEL%"=="" (
  echo Ingen GGUF-modell funnet i models\ mappen.
  echo Legg en .gguf modell i models\ eller angi banen som parameter.
  exit /b 1
)
echo ========================================================
echo Starter llama-server med GPU-akselerasjon (NVIDIA RTX)
echo Modell: %MODEL%
echo API:    http://127.0.0.1:8080/v1
echo ========================================================
llama-cpp\llama-server.exe -m "%MODEL%" --port 8080 --host 127.0.0.1 -ngl 99 -c 8192
