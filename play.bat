@echo off
title Pocket Masters - Head-to-Head 8-Ball Pool
echo ========================================================
echo    Pocket Masters - Head-to-Head 8-Ball Pool
echo ========================================================
echo.
echo  PC Browser:
echo    http://localhost:8000
echo.
echo  Mobile Phone / Tablet (Same Wi-Fi):
echo    http://192.168.1.62:8000
echo.
echo ========================================================
echo (Press Ctrl+C in this terminal window to stop the server)
echo.

start "" "http://localhost:8000"
python -m http.server 8000
