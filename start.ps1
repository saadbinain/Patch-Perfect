Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Starting Patch Perfect Backend and Frontend...  " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; python manage.py migrate; python manage.py runserver 0.0.0.0:8000"
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; cmd /c npm run dev"

Write-Host "Both servers launched in dedicated PowerShell windows." -ForegroundColor Green
