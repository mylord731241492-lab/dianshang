$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
$baseUrl = $env:SMOKE_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3456"
}
$session = "canvas-reference-compression-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$runner = Join-Path $PSScriptRoot "smoke-canvas-reference-compression-ui-runner.js"

function Invoke-PlaywrightCli {
  param(
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string[]]$Arguments
  )

  $stdout = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-canvas-reference-compression-" + $Step + "-out.log")
  $stderr = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-canvas-reference-compression-" + $Step + "-err.log")
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }

  $process = Start-Process -FilePath "npx.cmd" -ArgumentList $Arguments -WorkingDirectory $root -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $outText = if (Test-Path $stdout) { Get-Content -Raw -Encoding UTF8 $stdout } else { "" }
  $errText = if (Test-Path $stderr) { Get-Content -Raw -Encoding UTF8 $stderr } else { "" }
  if ($outText -and $outText.Trim()) { Write-Host $outText.Trim() }
  if ($errText -and $errText.Trim()) { Write-Host $errText.Trim() }
  if ($process.ExitCode -ne 0 -or $outText -match "### Error" -or $errText -match "### Error") {
    throw "playwright-cli $Step failed with exit code $($process.ExitCode)"
  }
}

$openArguments = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "open", "$baseUrl/?canvas-reference-compression-smoke=open")
Start-Process -FilePath "npx.cmd" -ArgumentList $openArguments -WorkingDirectory $root -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 5

try {
  Invoke-PlaywrightCli -Step "run-code" -Arguments @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "run-code", "--filename", $runner)
  Write-Host "Canvas reference compression UI smoke passed at $baseUrl"
} finally {
  & npx.cmd --yes --package "@playwright/cli" playwright-cli --session $session close 2>&1 | Out-Null
}
