$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$session = $env:SMOKE_SOURCE_FRONTEND_UI_SESSION
if (-not $session) {
  $session = "source-frontend-ui-smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function Invoke-PlaywrightCli {
  param(
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string[]]$Arguments
  )

  $stdout = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-source-frontend-ui-" + $Step + "-out.log")
  $stderr = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-source-frontend-ui-" + $Step + "-err.log")
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }

  $process = Start-Process -FilePath "npx.cmd" -ArgumentList $Arguments -WorkingDirectory $root -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $outText = ""
  $errText = ""
  if (Test-Path $stdout) { $outText = Get-Content -Encoding UTF8 -Raw $stdout }
  if (Test-Path $stderr) { $errText = Get-Content -Encoding UTF8 -Raw $stderr }
  if ($outText -and $outText.Trim()) { Write-Host $outText.Trim() }
  if ($errText -and $errText.Trim()) { Write-Host $errText.Trim() }
  if ($outText -match "### Error" -or $errText -match "### Error") {
    throw "playwright-cli $Step reported an error"
  }
  if ($process.ExitCode -ne 0) {
    throw "playwright-cli $Step failed with exit code $($process.ExitCode)"
  }
}

$frontendUrl = $env:SOURCE_FRONTEND_BASE_URL
if (-not $frontendUrl) {
  $frontendUrl = "http://127.0.0.1:5173"
}

$backendUrl = $env:SOURCE_FRONTEND_API_BASE_URL
if (-not $backendUrl) {
  $backendUrl = "http://127.0.0.1:3456"
}

$screenshotDir = Join-Path $root "docs\design-references\source-frontend-2026-06-26"
if (-not (Test-Path $screenshotDir)) {
  New-Item -ItemType Directory -Force -Path $screenshotDir | Out-Null
}

Write-Host "Running source frontend UI smoke checks with Playwright session: $session"
try {
  Invoke-RestMethod "$backendUrl/api/health" | Out-Null
} catch {
  throw "Backend health check failed at $backendUrl/api/health"
}

try {
  Invoke-WebRequest "$frontendUrl/login?source-frontend-ui-smoke=health" -UseBasicParsing | Out-Null
} catch {
  throw "Frontend check failed at $frontendUrl/login"
}

$runnerScript = Join-Path $PSScriptRoot "smoke-source-frontend-ui-runner.js"
$openArgs = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "open", "$frontendUrl/login?source-frontend-ui-smoke=open")
Start-Process -FilePath "npx.cmd" -ArgumentList $openArgs -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 8
Invoke-PlaywrightCli -Step "run-code" -Arguments @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "run-code", "--filename", $runnerScript)
Write-Host "Source frontend UI smoke checks passed"
