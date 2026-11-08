# Windows PowerShell: install, then start API (8000) and UI (5173)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

if (-not (Test-Path .venv)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

$PyExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$PipExe = Join-Path $ProjectRoot ".venv\Scripts\pip.exe"

Write-Host "Verifying Python dependencies..." -ForegroundColor Cyan
& $PipExe install -r requirements.txt --quiet

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host "Starting TravelShield API on http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-ExecutionPolicy","Bypass","-Command","Set-Location '$ProjectRoot'; & '$PyExe' -m uvicorn travelshield.api:app --port 8000"

Write-Host "Starting Frontend UI on http://127.0.0.1:5173..." -ForegroundColor Green
Push-Location frontend
npm run dev
