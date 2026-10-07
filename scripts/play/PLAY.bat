@echo off
title Rocket Village
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node play-server.mjs
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8173/
  python -m http.server 8173 --bind 127.0.0.1
  goto :eof
)
echo.
echo  Rocket Village needs Node.js to run on this computer.
echo  Install it (free) from https://nodejs.org , then double-click PLAY.bat again.
echo.
pause
