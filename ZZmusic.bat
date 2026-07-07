@echo off
cd /d "%~dp0"

if exist "out\main\main.js" (
  npm start
) else (
  npm run dev
)

pause
