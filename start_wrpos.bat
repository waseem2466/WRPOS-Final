@echo off
REM ─────────────────────────────────────────────────────────────
REM  WR POS — Silent Background Bot Launcher
REM  This batch file starts the Electron POS app silently.
REM  Double-click or place in Startup folder to auto-run.
REM ─────────────────────────────────────────────────────────────

cd /d "C:\Users\smile\Downloads\wr-pos"

REM Start Electron POS app (silent, no extra console window)
start "" /B ".\node_modules\electron\dist\electron.exe" . --no-sandbox

echo [WR POS] Started successfully.
