@echo off
REM Winning Product Finder - tek tikla baslat (Windows)
REM Bu dosya proje kokunden calistirilmalidir.
cd /d "%~dp0\.."
echo.
echo   Winning Product Finder baslatiliyor...
echo   Tarayicida ac: http://localhost:4545
echo.
node src/index.js
pause
