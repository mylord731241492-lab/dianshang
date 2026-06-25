$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$session = $env:SMOKE_TEMPLATE_UI_SESSION
if (-not $session) {
  $session = "template-ui-smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function Invoke-PlaywrightCli {
  param(
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string[]]$Arguments
  )

  $stdout = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-template-ui-" + $Step + "-out.log")
  $stderr = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-template-ui-" + $Step + "-err.log")
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

$runnerScript = Join-Path $PSScriptRoot "smoke-template-ui-runner.js"

Write-Host "Running template UI smoke checks with Playwright session: $session"
$openArgs = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "open", "http://127.0.0.1:3456/template-image?template-ui-smoke=open")
Start-Process -FilePath "npx.cmd" -ArgumentList $openArgs -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 3
Invoke-PlaywrightCli -Step "run-code" -Arguments @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "run-code", "--filename", $runnerScript)
Write-Host "Template UI smoke checks passed"
