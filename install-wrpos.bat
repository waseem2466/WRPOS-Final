@echo off
echo WR POS Command Line Installer
echo ==============================
echo.

cd /d "c:\Users\wasee\OneDrive\Desktop\wr-pos\release"

echo Available installers:
dir /b "*Setup*.exe"
echo.

echo Choose installation method:
echo 1. Silent install (no prompts)
echo 2. Normal install (with UI)
echo 3. Portable mode (no install)
echo.

set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo Installing silently...
    "WR POS Setup 4.3.9.exe" /S
    echo Installation completed silently.
) else if "%choice%"=="2" (
    echo Starting installer with UI...
    "WR POS Setup 4.3.9.exe"
) else if "%choice%"=="3" (
    echo Copying portable version...
    copy "WR POS 4.3.8.exe" "C:\Users\%USERNAME%\Desktop\WR_POS_Portable.exe"
    echo Portable version copied to desktop.
) else (
    echo Invalid choice.
)

echo.
pause