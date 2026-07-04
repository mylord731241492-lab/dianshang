$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$dockerEnvPath = Join-Path $repoRoot "docker\.env"

function Read-DotEnv {
  param([Parameter(Mandatory=$true)][string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) {
    return $map
  }
  Get-Content -Encoding UTF8 $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $index = $line.IndexOf("=")
    $key = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1).Trim().Trim('"').Trim("'")
    $map[$key] = $value
  }
  return $map
}

$envMap = Read-DotEnv -Path $dockerEnvPath
$hostPort = $envMap["HOST_PORT"]
if (-not $hostPort) {
  $hostPort = $envMap["PORT"]
}
if (-not $hostPort) {
  $hostPort = "3456"
}

$baseUrl = $env:INTERNAL_PROD_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://192.168.0.39:$hostPort"
}

$adminUsername = $env:INTERNAL_PROD_ADMIN_USERNAME
if (-not $adminUsername) {
  $adminUsername = $envMap["ADMIN_BOOTSTRAP_USERNAME"]
}
if (-not $adminUsername) {
  $adminUsername = "admin"
}

$adminPassword = $env:INTERNAL_PROD_ADMIN_PASSWORD
if (-not $adminPassword) {
  $adminPassword = $envMap["ADMIN_BOOTSTRAP_PASSWORD"]
}
if (-not $adminPassword) {
  throw "Missing admin password. Set INTERNAL_PROD_ADMIN_PASSWORD or ADMIN_BOOTSTRAP_PASSWORD in docker\.env."
}

function Invoke-Json {
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

function Assert-True {
  param(
    [Parameter(Mandatory=$true)][bool]$Condition,
    [Parameter(Mandatory=$true)][string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

function Assert-HttpStatus {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][int]$ExpectedStatus
  )
  $status = 0
  try {
    $response = Invoke-WebRequest -UseBasicParsing "$baseUrl$Path"
    $status = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }
  Assert-True -Condition ($status -eq $ExpectedStatus) -Message "Expected $Path to return $ExpectedStatus, got $status"
  Write-Host "OK $ExpectedStatus $Path"
}

$health = Invoke-Json -Method "GET" -Path "/api/health"
Assert-True -Condition ($health.success -and $health.status -eq "ok" -and $health.database -eq "ok") -Message "Health check failed"
Assert-True -Condition ($health.providers.ai.mode -eq "real-provider-ready") -Message "AI provider is not ready"
Assert-True -Condition (-not [bool]$health.providers.email.enabled) -Message "Email should remain disabled for internal test production"
Assert-True -Condition (-not [bool]$health.providers.payment.enabled) -Message "Payment should remain disabled for internal test production"
Assert-True -Condition (-not [bool]$health.providers.storage.enabled) -Message "Storage should remain disabled for internal test production"

$login = Invoke-Json -Method "POST" -Path "/api/admin/login" -Body @{
  username = $adminUsername
  password = $adminPassword
}
Assert-True -Condition ([bool]$login.token -and $login.user.role -eq "admin") -Message "Admin login failed"
$headers = @{ Authorization = "Bearer $($login.token)" }

$settings = Invoke-Json -Method "GET" -Path "/api/admin/settings" -Headers $headers
Assert-True -Condition ([bool]$settings.success) -Message "Admin settings read failed"

$code = "SMOKE" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$created = Invoke-Json -Method "POST" -Path "/api/admin/redeem-codes" -Headers $headers -Body @{
  code = $code
  amount = 11
  maxUses = 2
  enabled = $true
}
Assert-True -Condition ($created.success -and $created.code -eq $code) -Message "Redeem code create failed"

$codes = Invoke-Json -Method "GET" -Path "/api/admin/redeem-codes?page=1&pageSize=500" -Headers $headers
$createdCode = @($codes.codes | Where-Object { $_.code -eq $code })
Assert-True -Condition ($createdCode.Count -eq 1) -Message "Created redeem code was not found"

$deleted = Invoke-Json -Method "DELETE" -Path "/api/admin/redeem-codes/$code" -Headers $headers
Assert-True -Condition ([bool]$deleted.success) -Message "Redeem code delete failed"

$codesAfterDelete = Invoke-Json -Method "GET" -Path "/api/admin/redeem-codes?page=1&pageSize=500" -Headers $headers
$deletedCode = @($codesAfterDelete.codes | Where-Object { $_.code -eq $code })
Assert-True -Condition ($deletedCode.Count -eq 0) -Message "Smoke redeem code still exists after delete"

$homeResponse = Invoke-WebRequest -UseBasicParsing "$baseUrl/"
Assert-True -Condition ($homeResponse.Content -match "index-DglIsp_g\.js\?v=20260704canvasrefresh1") -Message "Production frontend entry asset missing from home page"
$productionEntry = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/index-DglIsp_g.js?v=20260704canvasrefresh1").Content
Assert-True -Condition ($productionEntry -match "HomeIndex-DAjDt0aj\.js\?v=20260704homesave1") -Message "Production home chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -match "Canvas-B8bY9_QL\.js\?v=20260704canvasrefresh1") -Message "Production canvas chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -notmatch "HomeIndex-DAjDt0aj\.js\?v=20260702modelsync1") -Message "Old home chunk query still exists in production entry asset"
Assert-True -Condition ($productionEntry -notmatch "index-ZrBcanD1") -Message "Legacy root entry is still referenced by production entry asset"
$productionCanvas = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/Canvas-B8bY9_QL.js?v=20260704canvasrefresh1").Content
Assert-True -Condition ($productionCanvas -match "refreshCanvasAfterProjectLoad") -Message "Canvas project load refresh hook missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "window\.dispatchEvent\(new Event\(""resize""\)\)") -Message "Canvas project load resize refresh missing from production canvas chunk"
Assert-HttpStatus -Path "/assets/index-ZrBcanD1.js" -ExpectedStatus 410
Assert-HttpStatus -Path "/assets/HomeIndex-BtiJ9toc.js" -ExpectedStatus 410
Assert-HttpStatus -Path "/assets/AdminLayout-BHNDJhhH.js" -ExpectedStatus 410
Assert-HttpStatus -Path "/assets/not-a-production-asset.js" -ExpectedStatus 404
$serverFallback = Invoke-WebRequest -UseBasicParsing "$baseUrl/server.js"
Assert-True -Condition ($serverFallback.Content -notmatch "const express = require") -Message "server.js should not be exposed as a static file"

$adminRoot = Invoke-WebRequest -UseBasicParsing "$baseUrl/admin"
Assert-True -Condition ($adminRoot.Content -match "/assets/index-[^""]+\.js") -Message "Source admin root asset missing"

$adminLogin = Invoke-WebRequest -UseBasicParsing "$baseUrl/admin/login"
Assert-True -Condition ($adminLogin.Content -match "/assets/index-[^""]+\.js") -Message "Source admin index asset missing"

$mainAsset = [regex]::Match($adminLogin.Content, 'src="(/assets/index-[^"]+\.js)"').Groups[1].Value
$mainAssetContent = (Invoke-WebRequest -UseBasicParsing "$baseUrl$mainAsset").Content
Assert-True -Condition ($mainAssetContent -match "AdminLoginSource") -Message "Source admin bundle does not reference AdminLoginSource"

Write-Host "Internal production smoke checks passed at $baseUrl"
