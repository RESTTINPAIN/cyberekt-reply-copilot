@echo off
setlocal

:: ─── Check if Node.js is installed ───
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo  ╔══════════════════════════════════════════════════════╗
  echo  ║  Node.js is not installed on this computer.         ║
  echo  ║                                                     ║
  echo  ║  To run Reply Studio you need Node.js 18 or newer.  ║
  echo  ║                                                     ║
  echo  ║  1. Go to  https://nodejs.org                       ║
  echo  ║  2. Download the LTS version                        ║
  echo  ║  3. Install it (just click Next through the wizard) ║
  echo  ║  4. Restart your computer                           ║
  echo  ║  5. Double-click this file again                    ║
  echo  ╚══════════════════════════════════════════════════════╝
  echo.
  echo  Opening nodejs.org for you now...
  start https://nodejs.org
  pause
  exit /b 1
)

:: ─── Check Node.js version is 18+ ───
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
set "NODE_VER=%NODE_VER:v=%"
if %NODE_VER% lss 18 (
  echo.
  echo  Your Node.js version is too old. Please update to version 18 or newer.
  echo  Download from: https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: ─── Find a free port and start the server ───
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root='%~dp0'; $port=$null; foreach ($candidate in 8785..8795) { $listening = Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue; if (-not $listening) { $port = $candidate; break } }; if (-not $port) { throw 'No free local port found between 8785 and 8795.' }; $proc = Start-Process node -ArgumentList 'server.js',$port -WorkingDirectory $root -PassThru -WindowStyle Hidden; $ready=$false; foreach ($i in 1..25) { Start-Sleep -Milliseconds 300; try { $health = Invoke-WebRequest ('http://127.0.0.1:' + $port + '/api/health') -UseBasicParsing -TimeoutSec 2; if ($health.StatusCode -eq 200) { $ready=$true; break } } catch { } }; if (-not $ready) { try { Stop-Process -Id $proc.Id -Force } catch { }; throw 'The local server did not start. Make sure nothing else is using ports 8785-8795.' }; Start-Process ('http://127.0.0.1:' + $port + '/index.html')"

if %errorlevel% neq 0 (
  echo.
  echo  Something went wrong starting the server.
  echo  Try running manually:  node server.js
  echo.
  pause
)
