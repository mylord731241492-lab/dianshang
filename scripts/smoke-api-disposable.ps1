$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = $env:SMOKE_TEMP_PORT
if (-not $port) {
  $port = "4595"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-smoke-api-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$dataDir = Join-Path $tempRoot "data"
$uploadDir = Join-Path $tempRoot "uploads"
$logDir = Join-Path $tempRoot "logs"
$outLog = Join-Path $tempRoot "server-out.log"
$errLog = Join-Path $tempRoot "server-err.log"

New-Item -ItemType Directory -Force -Path $dataDir, $uploadDir, $logDir | Out-Null

$oldPort = $env:PORT
$oldDataDir = $env:DATA_DIR
$oldDbPath = $env:DB_PATH
$oldUploadDir = $env:UPLOAD_DIR
$oldLogDir = $env:LOG_DIR
$oldSmokeBaseUrl = $env:SMOKE_BASE_URL
$proc = $null

try {
  $env:PORT = "$port"
  $env:DATA_DIR = $dataDir
  $env:DB_PATH = Join-Path $dataDir "data.db"
  $env:UPLOAD_DIR = $uploadDir
  $env:LOG_DIR = $logDir

  $proc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health"
      if ($health.success -and $health.database -eq "ok") {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    $errText = ""
    if (Test-Path $errLog) {
      $errText = Get-Content -Encoding UTF8 $errLog -Raw
    }
    throw "Disposable smoke server did not become ready on port $port. $errText"
  }

  $env:SMOKE_BASE_URL = "http://127.0.0.1:$port"
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "smoke-api.ps1")
  Write-Host "Disposable smoke API checks passed with temp data dir: $dataDir"
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    try {
      Wait-Process -Id $proc.Id -Timeout 5 -ErrorAction SilentlyContinue
    } catch {}
  }

  if ($null -eq $oldPort) { Remove-Item Env:\PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
  if ($null -eq $oldDataDir) { Remove-Item Env:\DATA_DIR -ErrorAction SilentlyContinue } else { $env:DATA_DIR = $oldDataDir }
  if ($null -eq $oldDbPath) { Remove-Item Env:\DB_PATH -ErrorAction SilentlyContinue } else { $env:DB_PATH = $oldDbPath }
  if ($null -eq $oldUploadDir) { Remove-Item Env:\UPLOAD_DIR -ErrorAction SilentlyContinue } else { $env:UPLOAD_DIR = $oldUploadDir }
  if ($null -eq $oldLogDir) { Remove-Item Env:\LOG_DIR -ErrorAction SilentlyContinue } else { $env:LOG_DIR = $oldLogDir }
  if ($null -eq $oldSmokeBaseUrl) { Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue } else { $env:SMOKE_BASE_URL = $oldSmokeBaseUrl }

  if ($env:SMOKE_KEEP_TEMP -ne "true") {
    $resolvedTempRoot = Resolve-Path $tempRoot -ErrorAction SilentlyContinue
    $systemTemp = [System.IO.Path]::GetTempPath()
    if ($resolvedTempRoot -and $resolvedTempRoot.Path.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
      for ($i = 0; $i -lt 8; $i++) {
        try {
          Remove-Item -LiteralPath $resolvedTempRoot.Path -Recurse -Force
          break
        } catch {
          if ($i -eq 7) {
            Write-Warning "Could not remove temp smoke directory: $($resolvedTempRoot.Path). You can delete it later."
          } else {
            Start-Sleep -Milliseconds 500
          }
        }
      }
    }
  }
}
