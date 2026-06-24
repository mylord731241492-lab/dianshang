$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$composeFile = "docker-compose.internal.yml"
$port = $env:PORT
if (-not $port) {
  $port = "3456"
}
$baseUrl = "http://127.0.0.1:$port"

function Invoke-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][scriptblock]$Script
  )

  Write-Host "== $Name =="
  & $Script
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

Invoke-Step -Name "docker available" -Script {
  docker --version
  docker compose version
}

Invoke-Step -Name "env file" -Script {
  if (-not (Test-Path ".env")) {
    throw ".env missing. Copy .env.example to .env and set production secrets before deploying."
  }
  $envText = Get-Content -Encoding UTF8 ".env"
  if ($envText -match "sk-replace-with|replace-with-a-long-random-secret") {
    Write-Host "WARN .env still contains placeholder values. Mock mode can run, but production secrets are not configured."
  }
}

Invoke-Step -Name "compose config" -Script {
  docker compose -f $composeFile config
}

Invoke-Step -Name "compose up" -Script {
  docker compose -f $composeFile up --build -d
}

Invoke-Step -Name "health" -Script {
  $health = Wait-Health -Url $baseUrl
  $health | ConvertTo-Json -Depth 8
}

Invoke-Step -Name "API smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\smoke-api.ps1"
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

Invoke-Step -Name "frontend route smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\smoke-frontend-routes.ps1"
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

if ($env:SMOKE_ALLOW_WRITES -eq "true") {
  Invoke-Step -Name "admin write smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\smoke-admin-write.ps1"
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }
} else {
  Write-Host "== admin write smoke =="
  Write-Host "Skipped. Set SMOKE_ALLOW_WRITES=true only on a disposable test database."
}

Invoke-Step -Name "restart persistence smoke" -Script {
  docker compose -f $composeFile restart app
  $health = Wait-Health -Url $baseUrl
  if ($health.database -ne "ok") {
    throw "Database unhealthy after restart"
  }
  $health | ConvertTo-Json -Depth 8
}

Invoke-Step -Name "compose ps" -Script {
  docker compose -f $composeFile ps
}

Write-Host "Internal deployment verification passed for $baseUrl"
