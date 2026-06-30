$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = $env:SMOKE_BOUNDARY_PORT
if (-not $port) {
  $port = "4597"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-backend-canvas-boundary-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$dataDir = Join-Path $tempRoot "data"
$uploadDir = Join-Path $tempRoot "uploads"
$logDir = Join-Path $tempRoot "logs"
$outLog = Join-Path $tempRoot "server-out.log"
$errLog = Join-Path $tempRoot "server-err.log"

New-Item -ItemType Directory -Force -Path $dataDir, $uploadDir, $logDir | Out-Null

$oldPort = $env:PORT
$oldDataDir = $env:DATA_DIR
$oldDbPath = $env:DB_PATH
$oldUploadDir = $env:UPLOAD_DIR
$oldLogDir = $env:LOG_DIR
$oldEnableRealAi = $env:ENABLE_REAL_AI
$oldEnableRealEmail = $env:ENABLE_REAL_EMAIL
$oldEnableRealPayment = $env:ENABLE_REAL_PAYMENT
$oldEnableRealStorage = $env:ENABLE_REAL_STORAGE
$proc = $null

function Invoke-BoundaryRequest {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$ExpectedStatus = 200,
    [hashtable]$Headers = @{},
    $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = "http://127.0.0.1:$port$Path"
    Headers = $Headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    $response = Invoke-WebRequest @params
    $statusCode = [int]$response.StatusCode
    $content = [string]$response.Content
  } catch {
    $httpResponse = $_.Exception.Response
    if (-not $httpResponse) {
      throw
    }
    $statusCode = [int]$httpResponse.StatusCode
    $stream = $httpResponse.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $content = $reader.ReadToEnd()
  }

  if ($statusCode -ne $ExpectedStatus) {
    throw "$Method $Path expected HTTP $ExpectedStatus but got $statusCode. Body: $content"
  }

  Write-Host "OK $Method $Path -> $statusCode"
  return $content
}

function Assert-Includes {
  param(
    [Parameter(Mandatory=$true)][string]$Label,
    [Parameter(Mandatory=$true)][string]$Text,
    [Parameter(Mandatory=$true)][string]$Needle
  )

  if (-not $Text.Contains($Needle)) {
    throw "$Label missing required text: $Needle"
  }
}

try {
  node (Join-Path $repoRoot "scripts\check-packy-gpt-image-size.js") | Write-Host
  node (Join-Path $repoRoot "scripts\check-packy-gpt-image-adapter-coverage.js") | Write-Host
  node (Join-Path $repoRoot "scripts\check-provider-text-extraction.js") | Write-Host

  $env:PORT = "$port"
  $env:DATA_DIR = $dataDir
  $env:DB_PATH = Join-Path $dataDir "data.db"
  $env:UPLOAD_DIR = $uploadDir
  $env:LOG_DIR = $logDir
  $env:ENABLE_REAL_AI = "false"
  $env:ENABLE_REAL_EMAIL = "false"
  $env:ENABLE_REAL_PAYMENT = "false"
  $env:ENABLE_REAL_STORAGE = "false"

  $proc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health"
      if ($health.success -and $health.database -eq "ok") {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    $errText = ""
    if (Test-Path $errLog) {
      $errText = Get-Content -Encoding UTF8 $errLog -Raw
    }
    throw "Backend/canvas boundary smoke server did not become ready on port $port. $errText"
  }

  if ($health.providers.ai.mode -eq "real-provider-ready") {
    throw "Boundary smoke must not run with real-provider-ready"
  }

  $canvasHtml = Invoke-BoundaryRequest -Method "GET" -Path "/canvas?backend-canvas-boundary-smoke=1"
  Assert-Includes -Label "canvas html" -Text $canvasHtml -Needle "canvas-performance-mode.js?v=20260629perf5"
  Assert-Includes -Label "canvas html" -Text $canvasHtml -Needle "canvas-image-node-polish.js?v=20260629image7"
  Assert-Includes -Label "canvas html" -Text $canvasHtml -Needle "canvas-chat-prompt-flow.js?v=20260630dialogagent8"
  Assert-Includes -Label "canvas html" -Text $canvasHtml -Needle "admin-api-source-route-bridge.js?v=20260629sourceapi1"
  Assert-Includes -Label "canvas html" -Text $canvasHtml -Needle "index-DglIsp_g.js?v=20260630dialogagent8"

  $assetPaths = @(
    "/assets/canvas-performance-mode.js?v=20260629perf5",
    "/assets/canvas-performance-mode.css?v=20260629perf5",
    "/assets/canvas-image-node-polish.js?v=20260629image7",
    "/assets/canvas-image-node-polish.css?v=20260629image7",
    "/assets/canvas-chat-prompt-flow.js?v=20260630dialogagent8",
    "/assets/canvas-chat-prompt-flow.css?v=20260630dialogagent8",
    "/assets/admin-api-source-route-bridge.js?v=20260629sourceapi1",
    "/assets/index-DglIsp_g.js?v=20260630dialogagent8",
    "/assets/Canvas-B8bY9_QL.js?v=20260630dialogagent6",
    "/assets/Canvas-yGc8b2gf.js?v=20260630dialogagent6"
  )

  foreach ($assetPath in $assetPaths) {
    Invoke-BoundaryRequest -Method "GET" -Path $assetPath | Out-Null
  }

  $canvasStorage = Invoke-RestMethod "http://127.0.0.1:$port/api/settings/canvas-storage"
  if (-not $canvasStorage.enabled -or $canvasStorage.maxSize -le 0) {
    throw "Canvas storage settings shape is invalid"
  }
  Write-Host "OK GET /api/settings/canvas-storage"

  Invoke-BoundaryRequest -Method "GET" -Path "/api/image-tools/settings" -ExpectedStatus 401 | Out-Null
  Invoke-BoundaryRequest -Method "GET" -Path "/api/image-tools/tasks/boundary-smoke" -ExpectedStatus 401 | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/image-tools/outpaint" -ExpectedStatus 401 -Body @{ prompt = "boundary smoke" } | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/image-tools/reverse-prompt" -ExpectedStatus 401 -Body @{ imageUrl = "/mock.png" } | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/image-tools/inpaint" -ExpectedStatus 401 -Body @{ prompt = "boundary smoke" } | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/image-tools/erase" -ExpectedStatus 401 -Body @{ prompt = "boundary smoke" } | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/canvas/generate-prompt" -ExpectedStatus 401 -Body @{ requirement = "boundary smoke"; imageCount = 2 } | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/canvas/dialog-agent-generate" -ExpectedStatus 401 -Body @{ requirement = "boundary smoke"; imageCount = 1 } | Out-Null
  Invoke-BoundaryRequest -Method "POST" -Path "/api/upload/image" -ExpectedStatus 401 | Out-Null

  $adminLoginContent = Invoke-BoundaryRequest -Method "POST" -Path "/api/admin/login" -Body @{
    username = "admin"
    password = "admin123"
  }
  $adminLogin = $adminLoginContent | ConvertFrom-Json
  if (-not $adminLogin.token) {
    throw "Admin login did not return token"
  }
  $headers = @{ Authorization = "Bearer $($adminLogin.token)" }

  $settingsContent = Invoke-BoundaryRequest -Method "GET" -Path "/api/image-tools/settings" -Headers $headers
  $settings = $settingsContent | ConvertFrom-Json
  if (-not $settings.success -or -not $settings.tools.outpaint.enabled -or -not $settings.tools.reversePrompt.enabled) {
    throw "Image tools settings did not expose enabled outpaint and reversePrompt"
  }
  if ($settings.tools.upscale.enabled -or $settings.tools.removeBg.enabled) {
    throw "Upscale and removeBg should remain disabled until provider capability is confirmed"
  }

  $promptBody = @{ requirement = "use image 1 product with image 2 style"; imageCount = 2 }
  $promptContent = Invoke-BoundaryRequest -Method "POST" -Path "/api/canvas/generate-prompt" -Headers $headers -Body $promptBody
  $promptResult = $promptContent | ConvertFrom-Json
  if (-not $promptResult.success -or -not $promptResult.prompt -or $promptResult.imageCount -ne 2) {
    throw "Canvas prompt flow did not return an editable prompt draft"
  }

  $agentBody = @{
    requirement = "analyze the product and create a clean ecommerce render"
    imageCount = 1
    source = "canvas-chat-dialog-agent"
  }
  $agentContent = Invoke-BoundaryRequest -Method "POST" -Path "/api/canvas/dialog-agent-generate" -Headers $headers -Body $agentBody
  $agentResult = $agentContent | ConvertFrom-Json
  if (-not $agentResult.success -or -not $agentResult.analysisSummary -or -not $agentResult.finalPrompt -or -not $agentResult.resultImages -or $agentResult.resultImages.Count -lt 1) {
    throw "Canvas dialog agent did not return analysisSummary/finalPrompt/resultImages"
  }
  if ($agentResult.analysisCost -ne 5 -or $agentResult.imageCost -ne 10 -or $agentResult.totalCost -ne 15) {
    throw "Canvas dialog agent cost fields are invalid"
  }
  Write-Host "OK POST /api/canvas/dialog-agent-generate mock response"

  Invoke-BoundaryRequest -Method "POST" -Path "/api/upload/image" -Headers $headers -ExpectedStatus 400 | Out-Null

  Write-Host "Backend/canvas boundary smoke passed with temp data dir: $tempRoot"
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    try {
      Wait-Process -Id $proc.Id -Timeout 5 -ErrorAction SilentlyContinue
    } catch {}
  }

  if ($null -eq $oldPort) { Remove-Item Env:\PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
  if ($null -eq $oldDataDir) { Remove-Item Env:\DATA_DIR -ErrorAction SilentlyContinue } else { $env:DATA_DIR = $oldDataDir }
  if ($null -eq $oldDbPath) { Remove-Item Env:\DB_PATH -ErrorAction SilentlyContinue } else { $env:DB_PATH = $oldDbPath }
  if ($null -eq $oldUploadDir) { Remove-Item Env:\UPLOAD_DIR -ErrorAction SilentlyContinue } else { $env:UPLOAD_DIR = $oldUploadDir }
  if ($null -eq $oldLogDir) { Remove-Item Env:\LOG_DIR -ErrorAction SilentlyContinue } else { $env:LOG_DIR = $oldLogDir }
  if ($null -eq $oldEnableRealAi) { Remove-Item Env:\ENABLE_REAL_AI -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_AI = $oldEnableRealAi }
  if ($null -eq $oldEnableRealEmail) { Remove-Item Env:\ENABLE_REAL_EMAIL -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_EMAIL = $oldEnableRealEmail }
  if ($null -eq $oldEnableRealPayment) { Remove-Item Env:\ENABLE_REAL_PAYMENT -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_PAYMENT = $oldEnableRealPayment }
  if ($null -eq $oldEnableRealStorage) { Remove-Item Env:\ENABLE_REAL_STORAGE -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_STORAGE = $oldEnableRealStorage }

  if ($env:SMOKE_KEEP_TEMP -ne "true") {
    $resolvedTempRoot = Resolve-Path $tempRoot -ErrorAction SilentlyContinue
    $systemTemp = [System.IO.Path]::GetTempPath()
    if ($resolvedTempRoot -and $resolvedTempRoot.Path.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
      for ($i = 0; $i -lt 8; $i++) {
        try {
          Remove-Item -LiteralPath $resolvedTempRoot.Path -Recurse -Force
          break
        } catch {
          if ($i -eq 7) {
            Write-Warning "Could not remove temp smoke directory: $($resolvedTempRoot.Path). You can delete it later."
          } else {
            Start-Sleep -Milliseconds 500
          }
        }
      }
    }
  }
}
