@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python "%~dp0bridge.py" --open-browser
) else (
  py -3 "%~dp0bridge.py" --open-browser
)
if errorlevel 1 pause
