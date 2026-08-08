# AI Research Assistant v2 — One-Click Windows Launcher
# Usage: Right-click -> "Run with PowerShell"  OR  .\start.ps1

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "AI Research Assistant v2"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         AI Research Assistant  v2.0                  ║" -ForegroundColor Cyan
Write-Host "║  Hybrid OKF + Multi-RAG Platform                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ROOT = $PSScriptRoot
$BACKEND = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"

# ── Pre-checks ──────────────────────────────────────────────────────────────

if (-not (Test-Path (Join-Path $BACKEND ".env")) -and -not (Test-Path (Join-Path $ROOT ".env"))) {
    Write-Host "[WARN] No .env file found. Copy .env.example to .env and fill in your API key." -ForegroundColor Yellow
    Write-Host "       backend\.env  or  .env (project root)" -ForegroundColor Yellow
    Write-Host ""
}

if (-not (Test-Path (Join-Path $FRONTEND "node_modules"))) {
    Write-Host "[INFO] Installing frontend dependencies (first run)..." -ForegroundColor Yellow
    Push-Location $FRONTEND
    npm install --silent
    Pop-Location
}

# ── Start Backend ────────────────────────────────────────────────────────────

Write-Host "[1/2] Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0
} -ArgumentList $BACKEND

# ── Start Frontend ────────────────────────────────────────────────────────────

Write-Host "[2/2] Starting Next.js frontend on http://localhost:3000 ..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $FRONTEND

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs : http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Health   : http://localhost:8000/health" -ForegroundColor White
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop both services." -ForegroundColor DarkGray
Write-Host ""

# Stream logs from both jobs
try {
    while ($true) {
        $backendJob  | Receive-Job | ForEach-Object { Write-Host "[BACKEND] $_"  -ForegroundColor DarkCyan }
        $frontendJob | Receive-Job | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor DarkGreen }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`nShutting down..." -ForegroundColor Yellow
    Stop-Job  $backendJob, $frontendJob
    Remove-Job $backendJob, $frontendJob
    Write-Host "Done. Goodbye!" -ForegroundColor Cyan
}
