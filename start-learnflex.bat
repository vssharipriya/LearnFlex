@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or later, then reopen this file.
  pause
  exit /b 1
)
echo Starting LearnFlex Saathi...
npm start
pause
