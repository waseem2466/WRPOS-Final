@echo off
cd /d "c:\Users\wasee\OneDrive\Desktop\wr-pos"

REM Add Node.js to PATH for this session
set PATH=C:\Program Files\nodejs;%PATH%

echo Building WR-POS application...
echo Current directory: %CD%
echo Node version: 
node --version
echo NPM version:
npm --version
echo.

echo Installing dependencies...
npm install

echo.
echo Building application...
npm run dist

echo.
echo Build completed! Check the 'release' folder for the installer.
pause