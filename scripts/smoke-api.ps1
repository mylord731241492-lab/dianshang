$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$baseUrl = $env:SMOKE_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3456"
}

function Invoke-SmokeJson {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [hashtable]$Headers = @{},
    $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = "$baseUrl$Path"
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  $result = Invoke-RestMethod @params
  Write-Host "OK $Method $Path"
  return $result
}

$health = Invoke-SmokeJson -Method "GET" -Path "/api/health"
if (-not $health.success) {
  throw "Health check failed"
}

$adminLogin = Invoke-SmokeJson -Method "POST" -Path "/api/admin/login" -Body @{
  username = "admin"
  password = "admin123"
}
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.token)" }

Invoke-SmokeJson -Method "GET" -Path "/api/admin/dashboard" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/api-providers" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/model-prices" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/template-workflows" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/settings" -Headers $adminHeaders | Out-Null

$patchedSettings = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/settings" -Headers $adminHeaders -Body @{
  smokeCheckedAt = (Get-Date).ToUniversalTime().ToString("o")
}
if (-not $patchedSettings.success) {
  throw "Settings patch failed"
}

$publicRoutes = Invoke-SmokeJson -Method "GET" -Path "/api/public/routes"
if (-not $publicRoutes.items -or $publicRoutes.items.Count -lt 1) {
  throw "Public routes missing"
}

Write-Host "Smoke API checks passed for $baseUrl"
