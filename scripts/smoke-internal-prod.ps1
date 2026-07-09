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
Assert-True -Condition ($homeResponse.Content -match "index-DglIsp_g\.js\?v=20260709agenticon1") -Message "Production frontend entry asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-performance-mode\.js\?v=20260704canvasleave1") -Message "Canvas performance route teardown asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-image-node-polish\.js\?v=20260708loadguard1") -Message "Canvas image polish loading guard asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-chat-prompt-flow\.js\?v=20260704canvasleave1") -Message "Canvas chat prompt route teardown asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-performance-mode\.css\?v=20260704usercenter1") -Message "Canvas user center performance CSS missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-image-node-polish\.css\?v=20260707loadui1") -Message "Canvas image polish loading UI CSS missing from home page"
Assert-True -Condition ($homeResponse.Content -match "template-workbench-gallery-polish\.css\?v=20260709gallery1") -Message "Template workbench gallery polish CSS missing from home page"
$productionEntry = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/index-DglIsp_g.js?v=20260709agenticon1").Content
Assert-True -Condition ($productionEntry -match "HomeIndex-DAjDt0aj\.js\?v=20260709agenticon1") -Message "Production home chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -match "Canvas-B8bY9_QL\.js\?v=20260709agenticon1") -Message "Production canvas chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -notmatch "HomeIndex-DAjDt0aj\.js\?v=20260702modelsync1") -Message "Old home chunk query still exists in production entry asset"
Assert-True -Condition ($productionEntry -notmatch "index-ZrBcanD1") -Message "Legacy root entry is still referenced by production entry asset"
$productionFixedModels = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/fixedImageModels-Rg0McL4V.js?v=20260709agenticon1").Content
Assert-True -Condition ($productionFixedModels -match "backend-model-source-only") -Message "Fixed image model asset should be backend-source-only"
Assert-True -Condition ($productionFixedModels -notmatch "PackyAPI GPT Image 2|lignsuan-guanzhuan|pub_route_mr5yltmuc7edcb2b|Nano Banana|Comfly|route_6789|route_rk|Flatfee|VIP|Gemini") -Message "Real image models should not be hardcoded in production fixed model asset"
$productionCanvas = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/Canvas-B8bY9_QL.js?v=20260709agenticon1").Content
Assert-True -Condition ($productionCanvas.Contains('icon:gd}],a=l0')) -Message "Canvas agent tab should use color wand icon"
Assert-True -Condition (-not $productionCanvas.Contains('icon:oo}],a=l0')) -Message "Canvas agent tab should not use video camera icon"
Assert-True -Condition ($productionCanvas -match "refreshCanvasAfterProjectLoad") -Message "Canvas project load refresh hook missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "window\.dispatchEvent\(new Event\(""resize""\)\)") -Message "Canvas project load resize refresh missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "codexSetUserCenterOpen") -Message "Canvas user center open state helper missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "canvas-user-center-open") -Message "Canvas user center performance class missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match '\\/api\\/mock-image\\/') -Message "Canvas mock image URL allowlist missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "ImageHistoryPanel-Dy2o3dPV\.js\?v=20260707redeem1") -Message "Canvas user center drawer chunk version missing from production canvas chunk"
$productionUserDrawer = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/ImageHistoryPanel-Dy2o3dPV.js?v=20260707redeem1").Content
Assert-True -Condition ($productionUserDrawer -match "await ea\(\)\.catch\(\(\)=>null\)") -Message "User center route public fallback missing from production drawer chunk"
Assert-True -Condition ($productionUserDrawer -match "await ta\(y\)\.catch\(\(\)=>null\)") -Message "User center model public fallback missing from production drawer chunk"
$productionPerfJs = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-performance-mode.js?v=20260704canvasleave1").Content
Assert-True -Condition ($productionPerfJs -match "draggingPointerActive") -Message "Canvas drag pointer throttle missing from performance asset"
Assert-True -Condition ($productionPerfJs -match "extendActive") -Message "Canvas drag active extension missing from performance asset"
Assert-True -Condition ($productionPerfJs -match "watchCanvasRoute") -Message "Canvas performance asset should be isolated to canvas route"
Assert-True -Condition ($productionPerfJs -match "teardownPerformanceMode") -Message "Canvas performance route-leave teardown missing"
$productionImagePolishJs = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-image-node-polish.js?v=20260708loadguard1").Content
Assert-True -Condition ($productionImagePolishJs -match "pendingDragRoot") -Message "Canvas drag deferred image polish scan missing"
Assert-True -Condition ($productionImagePolishJs -match "canvas-performance-dragging") -Message "Canvas drag polish pause detection missing"
Assert-True -Condition ($productionImagePolishJs -match "image-node-loading") -Message "Canvas image loading guard missing"
Assert-True -Condition ($productionImagePolishJs -match "watchCanvasRoute") -Message "Canvas image polish asset should be isolated to canvas route"
Assert-True -Condition ($productionImagePolishJs -match "teardownImageNodePolish") -Message "Canvas image polish route-leave teardown missing"
$productionChatPromptJs = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-chat-prompt-flow.js?v=20260704canvasleave1").Content
Assert-True -Condition ($productionChatPromptJs -match "20260704canvasleave1") -Message "Canvas chat prompt route teardown version missing"
Assert-True -Condition ($productionChatPromptJs -match "watchCanvasRoute") -Message "Canvas chat prompt asset should be isolated to canvas route"
Assert-True -Condition ($productionChatPromptJs -match "teardownChatPromptFlow") -Message "Canvas chat prompt route-leave teardown missing"
$productionPerfCss = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-performance-mode.css?v=20260704usercenter1").Content
Assert-True -Condition ($productionPerfCss -match "html\.canvas-performance-dragging \.vue-flow__node-image \.image-node-toolbar") -Message "Canvas drag toolbar suppression missing from performance CSS"
Assert-True -Condition ($productionPerfCss -match "html\.canvas-user-center-open") -Message "Canvas user center open performance state missing from performance CSS"
Assert-True -Condition ($productionPerfCss -match "backdrop-filter: none") -Message "Canvas user center overlay backdrop reduction missing from performance CSS"
$productionTemplateGalleryCss = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/template-workbench-gallery-polish.css?v=20260709gallery1").Content
Assert-True -Condition ($productionTemplateGalleryCss -match "\.template-workbench \.template-gallery-grid") -Message "Template gallery grid polish missing from production CSS"
Assert-True -Condition ($productionTemplateGalleryCss -match "repeat\(4, minmax\(240px, 1fr\)\)") -Message "Template gallery desktop density rule missing from production CSS"
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
