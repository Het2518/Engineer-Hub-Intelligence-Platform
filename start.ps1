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

$ROOT     = $PSScriptRoot
$BACKEND  = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"
$LOGS     = Join-Path $ROOT "logs"

# ── Ensure logs directory exists ─────────────────────────────────────────────
New-Item -ItemType Directory -Force $LOGS | Out-Null

# ── Pre-checks ───────────────────────────────────────────────────────────────

if (-not (Test-Path (Join-Path $BACKEND ".env"))) {
    Write-Host "[WARN] No backend/.env found. Copy .env.example to backend/.env and set your API keys." -ForegroundColor Yellow
    Write-Host ""
}

if (-not (Test-Path (Join-Path $FRONTEND "node_modules"))) {
    Write-Host "[INFO] Installing frontend dependencies (first run)..." -ForegroundColor Yellow
    Push-Location $FRONTEND
    npm install --silent
    Pop-Location
}

# ── Kill any stale processes on ports 8000 / 3000 ────────────────────────────

Write-Host "[0/2] Clearing stale processes on ports 8000 and 3000..." -ForegroundColor DarkGray
foreach ($port in @(8000, 3000)) {
    $portPid = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
    if ($portPid) {
        Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue
        Write-Host "      Killed PID $portPid on port $port" -ForegroundColor DarkGray
    }
}
Start-Sleep -Milliseconds 500

# ── Start Backend ─────────────────────────────────────────────────────────────

Write-Host "[1/2] Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($dir, $logFile)
    Set-Location $dir
    python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0 2>&1 | Tee-Object -FilePath $logFile
} -ArgumentList $BACKEND, (Join-Path $LOGS "backend.log")

# ── Start Frontend ────────────────────────────────────────────────────────────

Write-Host "[2/2] Starting Next.js frontend on http://localhost:3000 ..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    param($dir, $logFile)
    Set-Location $dir
    npm run dev 2>&1 | Tee-Object -FilePath $logFile
} -ArgumentList $FRONTEND, (Join-Path $LOGS "frontend.log")

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs : http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Health   : http://localhost:8000/health" -ForegroundColor White
Write-Host "  Logs     : $LOGS" -ForegroundColor DarkGray
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
