$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$baseUrl = $env:SMOKE_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3456"
}

function Invoke-ProviderGuardJson {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    $Headers = $null,
    $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = "$baseUrl$Path"
  }
  if ($Headers) {
    $params.Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }
  return Invoke-RestMethod @params
}

$health = Invoke-ProviderGuardJson -Method "GET" -Path "/api/health"
if (-not $health.success -or $health.database -ne "ok") {
  throw "Health check failed for provider guard"
}

$provider = $health.providers.ai
if (-not $provider) {
  throw "Health response missing providers.ai"
}
if ($provider.gateway -ne "new-api") {
  throw "Provider gateway must stay new-api for this platform plan. Got: $($provider.gateway)"
}
if (-not $provider.routesThroughNewApi -or -not $provider.cpaExpectedBehindNewApi) {
  throw "Provider health must state New-API routing and CPA-behind-New-API boundary"
}

$adminLogin = Invoke-ProviderGuardJson -Method "POST" -Path "/api/admin/login" -Body @{
  username = "admin"
  password = "admin123"
}
if (-not $adminLogin.token) {
  throw "Admin login failed for provider guard"
}
$headers = @{ Authorization = "Bearer $($adminLogin.token)" }

$routes = Invoke-ProviderGuardJson -Method "GET" -Path "/api/admin/api-providers" -Headers $headers
$route = $routes.items | Select-Object -First 1
if (-not $route.id) {
  throw "No API provider route available for provider guard"
}

if (-not $provider.enabled) {
  if ($provider.mode -ne "mock") {
    throw "Provider must report mock mode when real AI is disabled or not configured"
  }

  $routeTest = Invoke-ProviderGuardJson -Method "POST" -Path "/api/admin/api-providers/$($route.id)/test" -Headers $headers
  if (-not $routeTest.success -or -not $routeTest.mock) {
    throw "API provider test must mock when real AI is disabled or missing key"
  }

  $chat = Invoke-ProviderGuardJson -Method "POST" -Path "/api/chat/completions" -Headers $headers -Body @{
    model = $provider.textModel
    messages = @(@{ role = "user"; content = "provider guard ping" })
  }
  if (-not $chat.success -or -not $chat.mock) {
    throw "Chat completions must return mock response when provider is disabled"
  }

  Write-Host "Provider guard passed in mock mode: gateway=$($provider.gateway), route=$($route.id)"
} else {
  if ($provider.mode -ne "real-provider-ready") {
    throw "Provider enabled=true must report real-provider-ready"
  }
  Write-Host "Provider guard detected real-provider-ready; skipped mock route/chat calls to avoid external traffic."
}
