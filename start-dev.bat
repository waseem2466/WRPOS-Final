@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

cd /d d:\wr-pos

echo ============================================
echo   WR-POS Development Server Startup
echo ============================================
echo.

REM Set Node.js path
set NODE_PATH=C:\Program Files\nodejs
set PATH=%NODE_PATH%;%PATH%

echo [1/4] Checking Node.js installation...
node --version
npm --version
echo.

echo [2/4] Reinstalling dependencies...
call npm ci --legacy-peer-deps || call npm install --legacy-peer-deps
echo.

echo [3/4] Fixing vite config...
echo Vite config already patched
echo.

echo [4/4] Starting development server...
echo Please wait, this may take 1-2 minutes...
echo.

call npm run electron:dev

pause
