$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$dockerDir = $PSScriptRoot
$root = Split-Path -Parent $dockerDir
$composeFile = Join-Path $dockerDir "docker-compose.yml"

function Invoke-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][scriptblock]$Script
  )

  Write-Host "== $Name =="
  & $Script
}

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory = $dockerDir
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Read-DockerEnvValue {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [string]$Fallback = ""
  )

  $envFile = Join-Path $dockerDir ".env"
  if (-not (Test-Path $envFile)) {
    return $Fallback
  }

  $line = Get-Content -Encoding UTF8 $envFile |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -First 1
  if (-not $line) {
    return $Fallback
  }

  return (($line -replace "^\s*$([regex]::Escape($Name))\s*=", "").Trim() -replace '^["'']|["'']$', "")
}

function Wait-Health {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$Retries = 60
  )

  for ($i = 0; $i -lt $Retries; $i++) {
    try {
      $health = Invoke-RestMethod -Method Get -Uri "$Url/api/health" -TimeoutSec 3
      if ($health.success) {
        return $health
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw "Service did not become healthy: $Url/api/health"
}

$hostPort = $env:HOST_PORT
if (-not $hostPort) {
  $hostPort = Read-DockerEnvValue -Name "HOST_PORT" -Fallback "3456"
}
$baseUrl = "http://127.0.0.1:$hostPort"

Invoke-Step -Name "docker available" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("--version")
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "version")
  Invoke-NativeCommand -FilePath "docker" -Arguments @("info")
}

Invoke-Step -Name "env file" -Script {
  $envFile = Join-Path $dockerDir ".env"
  if (-not (Test-Path $envFile)) {
    throw "docker\.env missing. Copy docker\.env.example to docker\.env before internal testing."
  }

  $envText = Get-Content -Encoding UTF8 $envFile -Raw
  if ($envText -match "replace-with-a-long-random-secret") {
    Write-Host "WARN docker\.env still uses placeholder JWT_SECRET. This is acceptable only for isolated internal smoke."
  }
  if ($envText -match "ENABLE_REAL_PAYMENT\s*=\s*true") {
    throw "ENABLE_REAL_PAYMENT=true is not allowed for the current internal test phase."
  }
}

Invoke-Step -Name "compose config" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "config")
}

if ($env:SKIP_COMPOSE_UP -eq "true") {
  Write-Host "== compose up =="
  Write-Host "Skipped because SKIP_COMPOSE_UP=true"
} else {
  Invoke-Step -Name "compose up" -Script {
    Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "up", "--build", "-d")
  }
}

Invoke-Step -Name "health" -Script {
  $health = Wait-Health -Url $baseUrl
  $health | ConvertTo-Json -Depth 8
}

Invoke-Step -Name "API smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\smoke-api.ps1")) -WorkingDirectory $root
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

Invoke-Step -Name "frontend route smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\smoke-frontend-routes.ps1")) -WorkingDirectory $root
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

Invoke-Step -Name "provider guard smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\smoke-provider-guard.ps1")) -WorkingDirectory $root
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

if ($env:SMOKE_UI -eq "true") {
  foreach ($scriptName in @(
    "smoke-home-canvas-ui.ps1",
    "smoke-mobile-ui.ps1",
    "smoke-admin-pages-ui.ps1",
    "smoke-admin-save-echo-ui.ps1",
    "smoke-template-ui.ps1",
    "smoke-gallery-ui.ps1",
    "smoke-canvas-json-ui.ps1",
    "smoke-user-center-layout-ui.ps1"
  )) {
    Invoke-Step -Name $scriptName -Script {
      $env:SMOKE_BASE_URL = $baseUrl
      try {
        Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\$scriptName")) -WorkingDirectory $root
      } finally {
        Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
      }
    }
  }
} else {
  Write-Host "== UI smoke =="
  Write-Host "Skipped. Set SMOKE_UI=true to run Playwright UI checks."
}

Invoke-Step -Name "compose ps" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "ps")
}

Write-Host "Internal Docker verification passed for $baseUrl"
