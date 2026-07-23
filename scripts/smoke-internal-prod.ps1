param(
  [switch]$ReadOnly
)

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
    [Parameter(Mandatory=$true)][int]$ExpectedStatus,
    [string]$Method = "GET",
    $Body = $null
  )
  $status = 0
  try {
    $params = @{
      Method = $Method
      Uri = "$baseUrl$Path"
      UseBasicParsing = $true
    }
    if ($null -ne $Body) {
      $params.ContentType = "application/json; charset=utf-8"
      $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    $response = Invoke-WebRequest @params
    $status = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }
  Assert-True -Condition ($status -eq $ExpectedStatus) -Message "Expected $Path to return $ExpectedStatus, got $status"
  Write-Host "OK $Method $ExpectedStatus $Path"
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

$codes = Invoke-Json -Method "GET" -Path "/api/admin/redeem-codes?page=1&pageSize=500" -Headers $headers
Assert-True -Condition ([bool]$codes.success) -Message "Redeem code read failed"

if (-not $ReadOnly) {
  $code = "SMOKE" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $created = Invoke-Json -Method "POST" -Path "/api/admin/redeem-codes" -Headers $headers -Body @{
    code = $code
    amount = 11
    maxUses = 2
    enabled = $true
  }
  Assert-True -Condition ($created.success -and $created.code -eq $code) -Message "Redeem code create failed"

  $codesAfterCreate = Invoke-Json -Method "GET" -Path "/api/admin/redeem-codes?page=1&pageSize=500" -Headers $headers
  $createdCode = @($codesAfterCreate.codes | Where-Object { $_.code -eq $code })
  Assert-True -Condition ($createdCode.Count -eq 1) -Message "Created redeem code was not found"

  $deleted = Invoke-Json -Method "DELETE" -Path "/api/admin/redeem-codes/$code" -Headers $headers
  Assert-True -Condition ([bool]$deleted.success) -Message "Redeem code delete failed"

  $codesAfterDelete = Invoke-Json -Method "GET" -Path "/api/admin/redeem-codes?page=1&pageSize=500" -Headers $headers
  $deletedCode = @($codesAfterDelete.codes | Where-Object { $_.code -eq $code })
  Assert-True -Condition ($deletedCode.Count -eq 0) -Message "Smoke redeem code still exists after delete"
} else {
  Write-Host "SKIP mutable redeem-code checks (ReadOnly)"
}

$homeResponse = Invoke-WebRequest -UseBasicParsing "$baseUrl/"
Assert-True -Condition ($homeResponse.Content -match "index-DglIsp_g\.js\?v=20260717reversecopy1") -Message "Production frontend entry asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-performance-mode\.js\?v=20260704canvasleave1") -Message "Canvas performance route teardown asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-image-node-polish\.js\?v=20260708loadguard1") -Message "Canvas image polish loading guard asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-prompt-enhancer\.js\?v=20260721enhance1") -Message "Canvas prompt enhancer route-gated asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-chat-prompt-flow\.js\?v=20260704canvasleave1") -Message "Canvas chat prompt route teardown asset missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-performance-mode\.css\?v=20260704usercenter1") -Message "Canvas user center performance CSS missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-image-node-polish\.css\?v=20260721promptread1") -Message "Canvas image polish prompt readability CSS missing from home page"
Assert-True -Condition ($homeResponse.Content -match "canvas-prompt-enhancer\.css\?v=20260721enhance1") -Message "Canvas prompt enhancer CSS missing from home page"
Assert-True -Condition ($homeResponse.Content -match "template-workbench-gallery-polish\.css\?v=20260710gallery2") -Message "Template workbench gallery polish CSS missing from home page"
Assert-True -Condition ($homeResponse.Content -match "chat-entry-link\.js\?v=20260715availability1") -Message "AI chat entry script missing from home page"
Assert-True -Condition ($homeResponse.Content -match "auth-direct-register-bridge\.js\?v=20260715directreset1") -Message "Direct password reset bridge missing from home page"
$productionAuthBridge = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/auth-direct-register-bridge.js?v=20260715directreset1").Content
Assert-True -Condition ($productionAuthBridge -match "fetch\('/api/auth/reset-password'" -and $productionAuthBridge -match "username: account, newPassword: newPassword") -Message "Direct password reset bridge request contract is invalid"
Assert-True -Condition ($productionAuthBridge -match "hideDirectResetField\(email\)" -and $productionAuthBridge -match "hideDirectResetField\(code\)") -Message "Direct password reset bridge must hide email and reset code fields"
$productionImagePolishCss = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-image-node-polish.css?v=20260721promptread1").Content
Assert-True -Condition ($productionImagePolishCss.Contains('width: min(480px, calc(100vw - 64px)) !important;')) -Message "Canvas image generation node default width is stale"
Assert-True -Condition ($productionImagePolishCss.Contains('min-height: 168px !important;') -and $productionImagePolishCss.Contains('font-size: 15px !important;') -and $productionImagePolishCss.Contains('font-weight: 600 !important;')) -Message "Canvas image generation prompt readability rules are stale"
$productionPromptEnhancerCss = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-prompt-enhancer.css?v=20260721enhance1").Content
Assert-True -Condition ($productionPromptEnhancerCss.Contains('.vue-flow .image-prompt-generate-node .prompt-shell.hjm-prompt-enhance-host')) -Message "Canvas prompt enhancer CSS is not scoped to the current canvas node"
Assert-True -Condition ($productionPromptEnhancerCss.Contains('padding-bottom: 60px !important;') -and $productionPromptEnhancerCss.Contains('bottom: 12px !important;')) -Message "Canvas prompt enhancer button layout is stale"
$productionChatEntry = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/chat-entry-link.js?v=20260715availability1").Content
Assert-True -Condition ($productionChatEntry -match "function isHomeRoute\(\)" -and $productionChatEntry -match "return window\.location\.pathname === '/'") -Message "AI chat entry script must be gated to the home route"
Assert-True -Condition ($productionChatEntry -match "fetch\('/api/chat/status'" -and $productionChatEntry -match "if \(!availability\.accessReady\)") -Message "AI chat entry script must hide itself when Chat deployment is unavailable"
Assert-True -Condition ($productionChatEntry -match "window\.location\.assign\('/chat/'\)") -Message "AI chat entry script must navigate to /chat/"
Assert-True -Condition ($productionChatEntry -match "teardown: function\(\)") -Message "AI chat entry script route-leave teardown missing"
$productionChatStatus = Invoke-Json -Method "GET" -Path "/api/chat/status"
Assert-True -Condition ([bool]$productionChatStatus.success) -Message "Public Chat deployment status endpoint failed"
Assert-True -Condition ($null -ne $productionChatStatus.accessReady -and $productionChatStatus.chatPath -eq "/chat/") -Message "Public Chat deployment status contract is invalid"
$productionEntry = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/index-DglIsp_g.js?v=20260717reversecopy1").Content
Assert-True -Condition ($productionEntry.Contains('Yr.value?yr.value=X_(localStorage.getItem(qn)):(yr.value=null,localStorage.removeItem(qn))')) -Message "Frontend auth bootstrap should clear auth_user when token is missing"
Assert-True -Condition ($productionEntry -match "HomeIndex-DAjDt0aj\.js\?v=20260709restorehide1") -Message "Production home chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -match "Canvas-B8bY9_QL\.js\?v=20260717reversecopy1") -Message "Production canvas chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -match "ImageHistoryPanel-Dy2o3dPV\.js\?v=20260709historycopy1") -Message "Production image history chunk version missing from entry asset"
Assert-True -Condition ($productionEntry -notmatch "HomeIndex-DAjDt0aj\.js\?v=20260702modelsync1") -Message "Old home chunk query still exists in production entry asset"
Assert-True -Condition ($productionEntry -notmatch "index-ZrBcanD1") -Message "Legacy root entry is still referenced by production entry asset"
$productionFixedModels = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/fixedImageModels-Rg0McL4V.js?v=20260709restorehide1").Content
Assert-True -Condition ($productionFixedModels -match "backend-model-source-only") -Message "Fixed image model asset should be backend-source-only"
Assert-True -Condition ($productionFixedModels -notmatch "PackyAPI GPT Image 2|lignsuan-guanzhuan|pub_route_mr5yltmuc7edcb2b|Nano Banana|Comfly|route_6789|route_rk|Flatfee|VIP|Gemini") -Message "Real image models should not be hardcoded in production fixed model asset"
$productionCanvas = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/Canvas-B8bY9_QL.js?v=20260717reversecopy1").Content
Assert-True -Condition ($productionCanvas.Contains('a.width=r.width,a.height=r.height') -and $productionCanvas.Contains('a.toDataURL(t,.9)')) -Message "Canvas reference image handling does not match the 2026-07-21 noon rollback point"
Assert-True -Condition (-not $productionCanvas.Contains('HJM_CANVAS_REFERENCE_MAX_SIDE') -and -not $productionCanvas.Contains('Outbound reference compression failed')) -Message "Post-noon Canvas reference compression is still present"
Assert-True -Condition ($productionCanvas.Contains('ratio:String(P.size||"1:1").replace(/[') -and $productionCanvas.Contains('/g,":")')) -Message "Canvas quick generation must send canonical ratio"
Assert-True -Condition (-not $productionCanvas.Contains('size:P.size||"1:1",ratio:P.size||"1:1"')) -Message "Canvas quick generation still mixes ratio into size"
Assert-True -Condition (-not $productionCanvas.Contains('generationSubmitLocked')) -Message "Canvas image generation submit lock should not block intentional multi-submit"
Assert-True -Condition ($productionCanvas.Contains('disabled:!Ce.value,onClick:fe')) -Message "Canvas image generation button should remain available for intentional multi-submit"
Assert-True -Condition ($productionCanvas.Contains('taskStatus==="pending"?Math.max(6,Math.min(20') -and $productionCanvas.Contains('M.status==="pending"?Math.max(6,Math.min(20')) -Message "Canvas pending task state is not queue-aware"
Assert-True -Condition ($productionCanvas.Contains('typeof navigator!="undefined"&&navigator.clipboard&&window.isSecureContext')) -Message "Canvas reverse prompt copy secure/fallback branch missing"
Assert-True -Condition ($productionCanvas.Contains('d.setSelectionRange(0,d.value.length)') -and $productionCanvas.Contains('try{u=document.execCommand("copy")}finally{document.body.removeChild(d)}') -and $productionCanvas.Contains('if(!u)throw new Error("')) -Message "Canvas reverse prompt copy HTTP fallback or failure handling missing"
Assert-True -Condition (-not $productionCanvas.Contains('await((i=navigator.clipboard)==null?void 0:i.writeText(t.value))')) -Message "Canvas reverse prompt copy still reports false success"
Assert-True -Condition ($productionCanvas.Contains('icon:gd}],a=l0')) -Message "Canvas agent tab should use color wand icon"
Assert-True -Condition (-not $productionCanvas.Contains('icon:oo}],a=l0')) -Message "Canvas agent tab should not use video camera icon"
Assert-True -Condition (-not $productionCanvas.Contains('onClick:i,class:"h-9 flex items-center gap-1.5 rounded-xl bg-orange-50 px-3 text-xs font-bold text-orange-600')) -Message "Canvas restore image button should be removed"
Assert-True -Condition ($productionCanvas -match "refreshCanvasAfterProjectLoad") -Message "Canvas project load refresh hook missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "window\.dispatchEvent\(new Event\(""resize""\)\)") -Message "Canvas project load resize refresh missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "codexSetUserCenterOpen") -Message "Canvas user center open state helper missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "canvas-user-center-open") -Message "Canvas user center performance class missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match '\\/api\\/mock-image\\/') -Message "Canvas mock image URL allowlist missing from production canvas chunk"
Assert-True -Condition ($productionCanvas -match "ImageHistoryPanel-Dy2o3dPV\.js\?v=20260709historycopy1") -Message "Canvas user center drawer chunk version missing from production canvas chunk"
$productionProjects = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/projects-BtxGnToV.js?v=20260715serverstore1").Content
$productionImagePreviewRuntime = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-image-preview-runtime.js?v=20260714opperf4").Content
Assert-True -Condition ($productionCanvas.Contains('projects-BtxGnToV.js?v=20260715serverstore1')) -Message "Canvas project storage chunk version missing from production canvas chunk"
Assert-True -Condition ($productionCanvas.Contains('canvas-image-preview-runtime.js?v=20260714opperf4')) -Message "Canvas image preview runtime version missing from production canvas chunk"
Assert-True -Condition ($productionCanvas.Contains('acquireCanvasImagePreview') -and $productionCanvas.Contains('releaseCanvasImagePreview')) -Message "Canvas image nodes are not wired to the runtime preview pool"
Assert-True -Condition ($productionCanvas.Contains('clearCanvasImagePreviewPool(),delete window.__hjmCanvasImagePreviewDebug')) -Message "Canvas preview pool route-leave teardown missing"
Assert-True -Condition ($productionProjects.Contains('Nt=Object.freeze({w1024:1024,w500:500,w200:200,w100:100})')) -Message "Canvas local asset w1024 preview generation missing"
Assert-True -Condition ($productionProjects.Contains('resolveLocalAssetPreviewObjectUrl=') -and $productionProjects.Contains('resolveLocalAssetPreviewObjectUrl as I')) -Message "Canvas local asset preview resolver missing"
Assert-True -Condition ($productionProjects.Contains('mode:"server",serverUrl:e.url,clientAutoDownloadDisabled:!0')) -Message "Generated images must stay on server without automatic browser download"
Assert-True -Condition (-not $productionProjects.Contains('):(pe(b,N),{fileName:N,mode:"download"});if(e.url.startsWith("data:"))')) -Message "Generated image browser-download fallback is still active"
Assert-True -Condition ($productionCanvas.Contains('it.mode!=="download"&&it.mode!=="server"')) -Message "Canvas should accept server-persisted generation results without local-folder warning"
Assert-True -Condition (-not $productionProjects.Contains('canvasDisplayPreviewUrl')) -Message "Runtime preview URL leaked into persistent project data"
Assert-True -Condition ($productionImagePreviewRuntime.Contains('const MAX_EDGE = 1024;') -and $productionImagePreviewRuntime.Contains('const MAX_CONCURRENCY = 2;')) -Message "Canvas runtime preview bounds are invalid"
Assert-True -Condition ($productionImagePreviewRuntime.Contains('const MAX_IDLE_ENTRIES = 24;') -and $productionImagePreviewRuntime.Contains('const IDLE_TTL_MS = 30_000;')) -Message "Canvas runtime preview eviction bounds are invalid"
Assert-True -Condition ($productionImagePreviewRuntime.Contains('URL.revokeObjectURL') -and $productionImagePreviewRuntime.Contains('image/gif') -and $productionImagePreviewRuntime.Contains('image/svg+xml')) -Message "Canvas runtime preview cleanup or fallback rules missing"
Assert-True -Condition (-not $productionCanvas.Contains('JSON.parse(JSON.stringify(Ge.value))')) -Message "Canvas node snapshots should not serialize the whole graph"
Assert-True -Condition (-not $productionCanvas.Contains('JSON.parse(JSON.stringify($t.value))')) -Message "Canvas edge snapshots should not serialize the whole graph"
Assert-True -Condition ($productionCanvas.Contains('if(!h){Zo(!0),ln();return}')) -Message "Canvas drag stop should use the lightweight layout save"
Assert-True -Condition ($productionCanvas.Contains('So(),Zo(!0),ln(),setTimeout')) -Message "Canvas Alt-drag stop should use the lightweight layout save"
Assert-True -Condition ($productionCanvas.Contains('Sa(e,o,{layoutOnly:t})')) -Message "Canvas drag save is missing layout-only persistence"
Assert-True -Condition ($productionCanvas.Contains('Sa(e,n,{layoutOnly:!0})')) -Message "Canvas viewport save is missing layout-only persistence"
Assert-True -Condition ($productionProjects.Contains('At=(e=[])=>e.map(mt)')) -Message "Canvas project storage still contains a redundant JSON deep clone"
Assert-True -Condition (-not $productionProjects.Contains('At=(e=[])=>JSON.parse(JSON.stringify(e.map(mt)))')) -Message "Old canvas project storage clone still exists"
Assert-True -Condition ($productionProjects.Contains('layoutPatchStorageKey="ai-canvas-layout-patches"')) -Message "Canvas layout patch storage is missing"
Assert-True -Condition ($productionProjects.Contains('i.layoutOnly===!0?(saveLayoutPatch(e,a.canvasData),Promise.resolve(!0))')) -Message "Canvas layout-only update still writes the full IndexedDB project"
Assert-True -Condition ($productionProjects.Contains('Ea=e=>typeof e==="string"&&(e.startsWith("data:")||e.startsWith("blob:"))')) -Message "Canvas inline-image filter still scans full large strings"
Assert-True -Condition ($productionProjects.Contains('internProjectImagePayloads=')) -Message "Canvas project image payload interning is missing"
Assert-True -Condition ($productionProjects.Contains('ke=e=>e.map(t=>internProjectImagePayloads({')) -Message "Canvas project restore does not intern image payload aliases"
$productionUserDrawer = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/ImageHistoryPanel-Dy2o3dPV.js?v=20260709historycopy1").Content
Assert-True -Condition ($productionUserDrawer -match "await ea\(\)\.catch\(\(\)=>null\)") -Message "User center route public fallback missing from production drawer chunk"
Assert-True -Condition ($productionUserDrawer -match "await ta\(y\)\.catch\(\(\)=>null\)") -Message "User center model public fallback missing from production drawer chunk"
Assert-True -Condition ($productionUserDrawer.Contains("navigator.clipboard.writeText") -and $productionUserDrawer.Contains('document.execCommand("copy")') -and $productionUserDrawer.Contains("flex flex-wrap items-center gap-2 pt-1")) -Message "Image history prompt copy UI missing from production drawer chunk"
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
$productionPromptEnhancerJs = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-prompt-enhancer.js?v=20260721enhance1").Content
Assert-True -Condition ($productionPromptEnhancerJs -match "function isCanvasPage\(\)" -and $productionPromptEnhancerJs -match "\^\\/canvas") -Message "Canvas prompt enhancer must be gated to /canvas"
Assert-True -Condition ($productionPromptEnhancerJs -match "function teardown\(\)" -and $productionPromptEnhancerJs -match "controller\.abort\(\)") -Message "Canvas prompt enhancer route-leave teardown missing"
Assert-True -Condition ($productionPromptEnhancerJs -match "/api/canvas/enhance-prompt" -and $productionPromptEnhancerJs -notmatch "/api/generate/tasks") -Message "Canvas prompt enhancer request boundary is invalid"
$productionChatPromptJs = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-chat-prompt-flow.js?v=20260704canvasleave1").Content
Assert-True -Condition ($productionChatPromptJs -match "20260704canvasleave1") -Message "Canvas chat prompt route teardown version missing"
Assert-True -Condition ($productionChatPromptJs -match "watchCanvasRoute") -Message "Canvas chat prompt asset should be isolated to canvas route"
Assert-True -Condition ($productionChatPromptJs -match "teardownChatPromptFlow") -Message "Canvas chat prompt route-leave teardown missing"
$productionPerfCss = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/canvas-performance-mode.css?v=20260704usercenter1").Content
Assert-True -Condition ($productionPerfCss -match "html\.canvas-performance-dragging \.vue-flow__node-image \.image-node-toolbar") -Message "Canvas drag toolbar suppression missing from performance CSS"
Assert-True -Condition ($productionPerfCss -match "html\.canvas-user-center-open") -Message "Canvas user center open performance state missing from performance CSS"
Assert-True -Condition ($productionPerfCss -match "backdrop-filter: none") -Message "Canvas user center overlay backdrop reduction missing from performance CSS"
$productionTemplateGalleryCss = (Invoke-WebRequest -UseBasicParsing "$baseUrl/assets/template-workbench-gallery-polish.css?v=20260710gallery2").Content
Assert-True -Condition ($productionTemplateGalleryCss -match "\.template-workbench \.template-gallery-grid") -Message "Template gallery grid polish missing from production CSS"
Assert-True -Condition ($productionTemplateGalleryCss -match "repeat\(4, minmax\(220px, 1fr\)\)") -Message "Template gallery desktop density rule missing from production CSS"
Assert-True -Condition ($productionTemplateGalleryCss -match "workbench-body\.gallery-mode > \.template-category-sidebar") -Message "Duplicate template sidebar suppression missing from production CSS"
Assert-True -Condition ($productionTemplateGalleryCss -match "height: 230px !important") -Message "Template gallery compact card rule missing from production CSS"
Assert-HttpStatus -Path "/assets/index-ZrBcanD1.js" -ExpectedStatus 410
Assert-HttpStatus -Path "/assets/HomeIndex-BtiJ9toc.js" -ExpectedStatus 410
Assert-HttpStatus -Path "/assets/AdminLayout-BHNDJhhH.js" -ExpectedStatus 410
Assert-HttpStatus -Path "/assets/not-a-production-asset.js" -ExpectedStatus 404
Assert-HttpStatus -Method "POST" -Path "/api/canvas/enhance-prompt" -ExpectedStatus 401 -Body @{ currentPrompt = "production auth boundary smoke" }
$serverFallback = Invoke-WebRequest -UseBasicParsing "$baseUrl/server.js"
Assert-True -Condition ($serverFallback.Content -notmatch "const express = require") -Message "server.js should not be exposed as a static file"

$adminRoot = Invoke-WebRequest -UseBasicParsing "$baseUrl/admin"
Assert-True -Condition ($adminRoot.Content -match "/assets/index-[^""]+\.js") -Message "Source admin root asset missing"

$adminLogin = Invoke-WebRequest -UseBasicParsing "$baseUrl/admin/login"
Assert-True -Condition ($adminLogin.Content -match "/assets/index-[^""]+\.js") -Message "Source admin index asset missing"

$mainAsset = [regex]::Match($adminLogin.Content, 'src="(/assets/index-[^"]+\.js)"').Groups[1].Value
$mainAssetContent = (Invoke-WebRequest -UseBasicParsing "$baseUrl$mainAsset").Content
Assert-True -Condition ($mainAssetContent -match "AdminLoginSource") -Message "Source admin bundle does not reference AdminLoginSource"

$gallery = Invoke-WebRequest -UseBasicParsing "$baseUrl/gallery"
$galleryAsset = [regex]::Match($gallery.Content, 'src="(/assets/index-[^"]+\.js)"').Groups[1].Value
Assert-True -Condition ([bool]$galleryAsset) -Message "Source gallery entry asset missing"
$galleryAssetContent = (Invoke-WebRequest -UseBasicParsing "$baseUrl$galleryAsset").Content
Assert-True -Condition ($galleryAssetContent -match "GallerySource") -Message "Source gallery bundle does not reference GallerySource"

Write-Host "Internal production smoke checks passed at $baseUrl"
