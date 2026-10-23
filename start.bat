@echo off
echo ===================================================
echo   Starting Patch Perfect Backend and Frontend...
echo ===================================================
start "Patch Perfect - Django Backend" cmd /k "cd /d ""%~dp0backend"" && python manage.py runserver 127.0.0.1:8000"
start "Patch Perfect - Vite Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm.cmd run dev"
echo Both servers have been launched in dedicated terminal windows.
