$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = "4597"
$session = "codex-admin-core-ui"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-admin-core-ui-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$dataDir = Join-Path $tempRoot "data"
$uploadDir = Join-Path $tempRoot "uploads"
$logDir = Join-Path $tempRoot "logs"
$outLog = Join-Path $tempRoot "server-out.log"
$errLog = Join-Path $tempRoot "server-err.log"
$playwrightOut = Join-Path $tempRoot "playwright-out.log"
$playwrightErr = Join-Path $tempRoot "playwright-err.log"
$playwrightVerifyOut = Join-Path $tempRoot "playwright-verify-out.log"
$playwrightVerifyErr = Join-Path $tempRoot "playwright-verify-err.log"
$proc = $null

New-Item -ItemType Directory -Force -Path $dataDir, $uploadDir, $logDir | Out-Null

$oldPort = $env:PORT
$oldDataDir = $env:DATA_DIR
$oldDbPath = $env:DB_PATH
$oldUploadDir = $env:UPLOAD_DIR
$oldLogDir = $env:LOG_DIR
$oldEnableRealAi = $env:ENABLE_REAL_AI

try {
  $env:PORT = $port
  $env:DATA_DIR = $dataDir
  $env:DB_PATH = Join-Path $dataDir "data.db"
  $env:UPLOAD_DIR = $uploadDir
  $env:LOG_DIR = $logDir
  $env:ENABLE_REAL_AI = "false"

  $proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $repoRoot -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru

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
    $errText = if (Test-Path $errLog) { Get-Content -Raw -Encoding UTF8 $errLog } else { "" }
    throw "Disposable admin UI server did not become ready. $errText"
  }

  $openArguments = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "open", "http://127.0.0.1:$port/admin/login")
  $openOutput = @(& npx.cmd @openArguments 2>&1)
  $openExitCode = $LASTEXITCODE
  if ($openOutput.Count) { Write-Host ($openOutput -join [Environment]::NewLine) }
  if ($openExitCode -ne 0) {
    throw "Could not open isolated admin UI browser."
  }

  $runner = Join-Path $PSScriptRoot "smoke-admin-core-ui-runner.js"
  $arguments = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "run-code", "--filename", $runner)
  $playwright = Start-Process -FilePath "npx.cmd" -ArgumentList $arguments -WorkingDirectory $repoRoot -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $playwrightOut -RedirectStandardError $playwrightErr
  $outText = ""
  $errText = ""
  if (Test-Path $playwrightOut) { $outText = [string](Get-Content -Raw -Encoding UTF8 $playwrightOut) }
  if (Test-Path $playwrightErr) { $errText = [string](Get-Content -Raw -Encoding UTF8 $playwrightErr) }
  if (-not [string]::IsNullOrWhiteSpace($outText)) { Write-Host $outText.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($errText)) { Write-Host $errText.Trim() }
  if ($playwright.ExitCode -ne 0 -or $outText -match "### Error" -or $errText -match "### Error") {
    throw "Isolated admin UI smoke failed with exit code $($playwright.ExitCode)"
  }

  $verifyArguments = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "eval", "document.body.dataset.adminCoreUiSmoke")
  $playwrightVerify = Start-Process -FilePath "npx.cmd" -ArgumentList $verifyArguments -WorkingDirectory $repoRoot -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $playwrightVerifyOut -RedirectStandardError $playwrightVerifyErr
  $verifyText = ""
  $verifyError = ""
  if (Test-Path $playwrightVerifyOut) { $verifyText = [string](Get-Content -Raw -Encoding UTF8 $playwrightVerifyOut) }
  if (Test-Path $playwrightVerifyErr) { $verifyError = [string](Get-Content -Raw -Encoding UTF8 $playwrightVerifyErr) }
  if (-not [string]::IsNullOrWhiteSpace($verifyText)) { Write-Host $verifyText.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($verifyError)) { Write-Host $verifyError.Trim() }
  if ($playwrightVerify.ExitCode -ne 0 -or $verifyText -notmatch "done") {
    throw "Isolated admin UI smoke did not reach its completion marker"
  }
  Write-Host "Isolated admin core UI smoke checks passed"
} finally {
  try {
    & npx.cmd --yes --package "@playwright/cli" playwright-cli --session $session close 2>&1 | Out-Null
  } catch {}
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    try { Wait-Process -Id $proc.Id -Timeout 5 -ErrorAction SilentlyContinue } catch {}
  }
  if ($null -eq $oldPort) { Remove-Item Env:\PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
  if ($null -eq $oldDataDir) { Remove-Item Env:\DATA_DIR -ErrorAction SilentlyContinue } else { $env:DATA_DIR = $oldDataDir }
  if ($null -eq $oldDbPath) { Remove-Item Env:\DB_PATH -ErrorAction SilentlyContinue } else { $env:DB_PATH = $oldDbPath }
  if ($null -eq $oldUploadDir) { Remove-Item Env:\UPLOAD_DIR -ErrorAction SilentlyContinue } else { $env:UPLOAD_DIR = $oldUploadDir }
  if ($null -eq $oldLogDir) { Remove-Item Env:\LOG_DIR -ErrorAction SilentlyContinue } else { $env:LOG_DIR = $oldLogDir }
  if ($null -eq $oldEnableRealAi) { Remove-Item Env:\ENABLE_REAL_AI -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_AI = $oldEnableRealAi }

  $resolvedTempRoot = Resolve-Path $tempRoot -ErrorAction SilentlyContinue
  $systemTemp = [System.IO.Path]::GetTempPath()
  if ($resolvedTempRoot -and $resolvedTempRoot.Path.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    for ($i = 0; $i -lt 8; $i++) {
      try {
        Remove-Item -LiteralPath $resolvedTempRoot.Path -Recurse -Force
        break
      } catch {
        if ($i -eq 7) { Write-Warning "Could not remove temp admin UI directory: $($resolvedTempRoot.Path)" } else { Start-Sleep -Milliseconds 500 }
      }
    }
  }
}
