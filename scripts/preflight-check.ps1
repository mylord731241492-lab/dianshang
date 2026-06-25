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

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

Invoke-Step -Name "node --check server.js" -Script {
  Invoke-NativeCommand -FilePath "node" -Arguments @("--check", "server.js")
}

if (Test-Path "assets\home-carousel-inertia.js") {
  Invoke-Step -Name "node --check assets/home-carousel-inertia.js" -Script {
    Invoke-NativeCommand -FilePath "node" -Arguments @("--check", "assets\home-carousel-inertia.js")
  }
}

if ($env:VERIFY_CANVAS_LOCAL_GUARD -eq "true" -and (Test-Path "scripts\verify-canvas-restore-guard.js")) {
  Invoke-Step -Name "canvas restore guard" -Script {
    Invoke-NativeCommand -FilePath "node" -Arguments @("scripts\verify-canvas-restore-guard.js")
  }
} else {
  Write-Host "== canvas restore guard =="
  Write-Host "Skipped. Canvas remains local-first; set VERIFY_CANVAS_LOCAL_GUARD=true only when changing local JSON restore behavior."
}

if ($env:SMOKE_USE_CURRENT_API -eq "true") {
  Invoke-Step -Name "API smoke current service" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-api.ps1")
  }
} else {
  Invoke-Step -Name "API smoke disposable service" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-api-disposable.ps1")
  }
}

Invoke-Step -Name "frontend route smoke" -Script {
  Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-frontend-routes.ps1")
}

if ($env:SMOKE_ALLOW_WRITES -eq "true") {
  Invoke-Step -Name "admin write smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-write.ps1")
  }
} else {
  Write-Host "== admin write smoke =="
  Write-Host "Skipped. Set SMOKE_ALLOW_WRITES=true with a disposable database to run it."
}

if ($env:SMOKE_PERSISTENCE -eq "true") {
  Invoke-Step -Name "admin persistence smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-persistence-disposable.ps1")
  }
} else {
  Write-Host "== admin persistence smoke =="
  Write-Host "Skipped. Set SMOKE_PERSISTENCE=true to verify settings/providers/model prices/template workflows after restart."
}

if ($env:SMOKE_UI -eq "true") {
  Invoke-Step -Name "home/canvas UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-home-canvas-ui.ps1")
  }

  Invoke-Step -Name "admin pages UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-pages-ui.ps1")
  }

  Invoke-Step -Name "admin save echo UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-save-echo-ui.ps1")
  }

  Invoke-Step -Name "template UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-template-ui.ps1")
  }

  Invoke-Step -Name "gallery UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-gallery-ui.ps1")
  }

  Invoke-Step -Name "canvas JSON UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-canvas-json-ui.ps1")
  }

  Invoke-Step -Name "user center layout UI smoke" -Script {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-user-center-layout-ui.ps1")
  }
} else {
  Write-Host "== UI smoke =="
  Write-Host "Skipped. Set SMOKE_UI=true to run Playwright home/canvas, admin, admin save echo, template, gallery, canvas, and user center checks."
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
  Invoke-NativeCommand -FilePath "git" -Arguments @("status", "--short", "--branch")
}

Write-Host "Preflight checks passed."
