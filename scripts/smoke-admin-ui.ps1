$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$baseUrl = $env:SMOKE_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3456"
}

$session = $env:SMOKE_ADMIN_UI_SESSION
if (-not $session) {
  $session = "admin-ui-smoke"
}

function Invoke-AdminUiJson {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = "$baseUrl$Path"
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }
  return Invoke-RestMethod @params
}

$adminLogin = Invoke-AdminUiJson -Method "POST" -Path "/api/admin/login" -Body @{
  username = "admin"
  password = "admin123"
}
if (-not $adminLogin.token -or -not $adminLogin.user) {
  throw "Admin UI smoke login failed"
}

function Invoke-PlaywrightCli {
  param(
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string[]]$Arguments
  )

  $stdout = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-admin-ui-" + $Step + "-out.log")
  $stderr = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-admin-ui-" + $Step + "-err.log")
  if (Test-Path $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path $stderr) { Remove-Item -LiteralPath $stderr -Force }

  $process = Start-Process -FilePath "npx.cmd" -ArgumentList $Arguments -WorkingDirectory $root -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $outText = ""
  $errText = ""
  if (Test-Path $stdout) { $outText = Get-Content -Encoding UTF8 -Raw $stdout }
  if (Test-Path $stderr) { $errText = Get-Content -Encoding UTF8 -Raw $stderr }
  if ($outText -and $outText.Trim()) { Write-Host $outText.Trim() }
  if ($errText -and $errText.Trim()) { Write-Host $errText.Trim() }
  if ($process.ExitCode -ne 0) {
    throw "playwright-cli $Step failed with exit code $($process.ExitCode)"
  }
}

$runnerScript = Join-Path $PSScriptRoot "smoke-admin-ui-runner.js"

Write-Host "Running admin UI smoke checks with Playwright session: $session"
Invoke-PlaywrightCli -Step "run-code" -Arguments @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $session, "run-code", "--filename", $runnerScript)
Write-Host "Admin UI smoke checks passed for $baseUrl"
