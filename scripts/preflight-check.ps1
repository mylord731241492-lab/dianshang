$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][scriptblock]$Script
  )

  Write-Host "== $Name =="
  & $Script
}

Invoke-Step -Name "node --check server.js" -Script {
  node --check "server.js"
}

if (Test-Path "assets\home-carousel-inertia.js") {
  Invoke-Step -Name "node --check assets/home-carousel-inertia.js" -Script {
    node --check "assets\home-carousel-inertia.js"
  }
}

Invoke-Step -Name "API smoke" -Script {
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\smoke-api.ps1"
}

Invoke-Step -Name "frontend route smoke" -Script {
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\smoke-frontend-routes.ps1"
}

Invoke-Step -Name "health check" -Script {
  $baseUrl = $env:SMOKE_BASE_URL
  if (-not $baseUrl) {
    $baseUrl = "http://127.0.0.1:3456"
  }
  $health = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/health"
  if (-not $health.success) {
    throw "Health check returned success=false"
  }
  $health | ConvertTo-Json -Depth 8
}

Invoke-Step -Name "git status" -Script {
  git status --short --branch
}

Write-Host "Preflight checks passed."
