$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$composeFile = "docker-compose.internal.yml"
$hostPort = $env:HOST_PORT
if (-not $hostPort) {
  $hostPort = $env:PORT
}
if (-not $hostPort) {
  $hostPort = "3456"
}
$baseUrl = "http://127.0.0.1:$hostPort"

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
  Invoke-NativeCommand -FilePath "docker" -Arguments @("--version")
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "version")
  Invoke-NativeCommand -FilePath "docker" -Arguments @("info")
}

Invoke-Step -Name "env file" -Script {
  if (-not (Test-Path ".env")) {
    if ($env:REQUIRE_ENV_FILE -eq "true") {
      throw ".env missing. Copy .env.example to .env and set production secrets before deploying."
    }
    Write-Host "WARN .env missing. Internal mock test can continue with docker-compose.internal.yml defaults."
    return
  }
  $envText = Get-Content -Encoding UTF8 ".env"
  if ($envText -match "sk-replace-with|replace-with-a-long-random-secret") {
    if ($env:REQUIRE_PRODUCTION_SECRETS -eq "true") {
      throw ".env still contains placeholder values while REQUIRE_PRODUCTION_SECRETS=true."
    }
    Write-Host "WARN .env still contains placeholder values. Mock/internal test can run, but production secrets are not configured."
  }
}

Invoke-Step -Name "compose config" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "config")
}

Invoke-Step -Name "compose up" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "up", "--build", "-d")
}

Invoke-Step -Name "health" -Script {
  $health = Wait-Health -Url $baseUrl
  $health | ConvertTo-Json -Depth 8
}

Invoke-Step -Name "API smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-api.ps1")
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

Invoke-Step -Name "frontend route smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-frontend-routes.ps1")
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

Invoke-Step -Name "provider guard smoke" -Script {
  $env:SMOKE_BASE_URL = $baseUrl
  try {
    Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-provider-guard.ps1")
  } finally {
    Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
  }
}

if ($env:SMOKE_ALLOW_WRITES -eq "true") {
  Invoke-Step -Name "admin write smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-write.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }
} else {
  Write-Host "== admin write smoke =="
  Write-Host "Skipped. Set SMOKE_ALLOW_WRITES=true only on a disposable test database."
}

if ($env:SMOKE_UI -eq "true") {
  Invoke-Step -Name "home/canvas UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-home-canvas-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "mobile UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-mobile-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "admin pages UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-pages-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "admin save echo UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-admin-save-echo-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "template UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-template-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "gallery UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-gallery-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "canvas JSON UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-canvas-json-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }

  Invoke-Step -Name "user center layout UI smoke" -Script {
    $env:SMOKE_BASE_URL = $baseUrl
    try {
      Invoke-NativeCommand -FilePath "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts\smoke-user-center-layout-ui.ps1")
    } finally {
      Remove-Item Env:\SMOKE_BASE_URL -ErrorAction SilentlyContinue
    }
  }
} else {
  Write-Host "== UI smoke =="
  Write-Host "Skipped. Set SMOKE_UI=true to run Playwright home/canvas, mobile, admin, admin save echo, template, gallery, canvas, and user center checks."
}

Invoke-Step -Name "restart persistence smoke" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "restart", "app")
  $health = Wait-Health -Url $baseUrl
  if ($health.database -ne "ok") {
    throw "Database unhealthy after restart"
  }
  $health | ConvertTo-Json -Depth 8
}

Invoke-Step -Name "compose ps" -Script {
  Invoke-NativeCommand -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "ps")
}

Write-Host "Internal deployment verification passed for $baseUrl"
