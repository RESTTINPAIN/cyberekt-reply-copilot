@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed on this computer.
  echo Install Node.js 18 or newer from https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
set "NODE_VER=%NODE_VER:v=%"
if %NODE_VER% lss 18 (
  echo.
  echo Your Node.js version is too old. Please update to version 18 or newer.
  echo Download from: https://nodejs.org
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root='%~dp0'; $port=$null; foreach ($candidate in 8785..8795) { $listening = Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue; if (-not $listening) { $port = $candidate; break } }; if (-not $port) { throw 'No free local port found between 8785 and 8795.' }; $proc = Start-Process node -ArgumentList 'server.js',$port -WorkingDirectory $root -PassThru -WindowStyle Hidden; $ready=$false; foreach ($i in 1..25) { Start-Sleep -Milliseconds 300; try { $health = Invoke-WebRequest ('http://127.0.0.1:' + $port + '/api/health') -UseBasicParsing -TimeoutSec 2; if ($health.StatusCode -eq 200) { $ready=$true; break } } catch { } }; if (-not $ready) { try { Stop-Process -Id $proc.Id -Force } catch { }; throw 'The local server did not start. Make sure nothing else is using ports 8785-8795.' }; Start-Process ('http://127.0.0.1:' + $port + '/index.html')"

if errorlevel 1 (
  echo.
  echo Something went wrong starting the server.
  echo Try running manually: node server.js
  echo.
  pause
  exit /b 1
)

exit /b 0
