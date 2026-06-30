$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$baseUrl = $env:SMOKE_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3456"
}

$canvasPath = $env:SMOKE_CANVAS_PATH
if (-not $canvasPath) {
  $canvasPath = "/canvas"
}
if (-not $canvasPath.StartsWith("/")) {
  $canvasPath = "/" + $canvasPath
}
$separator = "?"
if ($canvasPath.Contains("?")) {
  $separator = "&"
}
$openUrl = "$baseUrl$canvasPath${separator}canvas-frame-budget-smoke=open"

$session = $env:SMOKE_CANVAS_FRAME_BUDGET_UI_SESSION
if (-not $session) {
  $session = "canvas-frame-budget-ui-smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function Invoke-PlaywrightCli {
  param(
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string[]]$Arguments
  )

  $stdout = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-canvas-frame-budget-ui-" + $Step + "-out.log")
  $stderr = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-canvas-frame-budget-ui-" + $Step + "-err.log")
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

$runnerScript = Join-Path $PSScriptRoot "smoke-canvas-frame-budget-ui-runner.js"

Write-Host "Running canvas frame budget UI smoke checks with Playwright session: $session"
$openArgs = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "open", $openUrl)
Start-Process -FilePath "npx.cmd" -ArgumentList $openArgs -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 5
Invoke-PlaywrightCli -Step "run-code" -Arguments @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "run-code", "--filename", $runnerScript)
Write-Host "Canvas frame budget UI smoke checks passed for $baseUrl"
