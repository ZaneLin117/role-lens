@echo off
cd /d "%~dp0"
if exist "dist\index.html" (
  start "" "dist\index.html"
) else (
  echo 请先运行 npm install 和 npm run build
  pause
)
