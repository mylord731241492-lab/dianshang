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
$providerMode = ""
if ($health.providers -and $health.providers.ai -and $health.providers.ai.mode) {
  $providerMode = [string]$health.providers.ai.mode
}
$allowRealProviderSmoke = $env:ALLOW_REAL_PROVIDER_SMOKE -eq "true"

$templateSettings = Invoke-SmokeJson -Method "GET" -Path "/api/template/settings"
if (-not $templateSettings.templates -or $templateSettings.templates.Count -lt 1) {
  throw "Template settings missing templates"
}

$textRoutes = Invoke-SmokeJson -Method "GET" -Path "/api/model-routes?group=text"
if (-not $textRoutes.items -or $textRoutes.items.Count -lt 1) {
  throw "Text model routes missing"
}

$imageRoutes = Invoke-SmokeJson -Method "GET" -Path "/api/model-routes?group=image"
if (-not $imageRoutes.items -or $imageRoutes.items.Count -lt 1) {
  throw "Image model routes missing"
}
$imageRoute = @($imageRoutes.items)[0]
$imageModel = $imageRoute.defaultModel
if (-not $imageModel -and $imageRoute.models) {
  $imageModel = @($imageRoute.models)[0]
}
if (-not $imageModel) {
  throw "Image route default model missing"
}
$expectedImageClarities = @("1k", "2k", "4k")
$imageModelQualities = @($imageModel.qualities | ForEach-Object { ([string]$_).ToLowerInvariant() })
$imageModelVariantClarities = @($imageModel.variants | ForEach-Object { ([string]$_.clarity).ToLowerInvariant() })
foreach ($clarity in $expectedImageClarities) {
  if ($imageModelQualities -notcontains $clarity) {
    throw "Image model qualities missing clarity $clarity"
  }
  if ($imageModelVariantClarities -notcontains $clarity) {
    throw "Image model variants missing clarity $clarity"
  }
}
$publicImageModels = Invoke-SmokeJson -Method "GET" -Path "/api/public/models?routeId=$($imageRoute.id)"
$publicImageModel = @($publicImageModels.items)[0]
if (-not $publicImageModel) {
  throw "Public image models missing"
}
$publicVariantClarities = @($publicImageModel.variants | ForEach-Object { ([string]$_.clarity).ToLowerInvariant() })
foreach ($clarity in $expectedImageClarities) {
  if ($publicVariantClarities -notcontains $clarity) {
    throw "Public image model variants missing clarity $clarity"
  }
}

$registerEmail = "smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@local.test"
$registerUser = "smoke" + (Get-Date -Format "MMddHHmmss")
$registerCode = Invoke-SmokeJson -Method "POST" -Path "/api/auth/send-email-code" -Body @{
  email = $registerEmail
  type = "register"
}
if (-not $registerCode.code) {
  throw "Register email code missing"
}

$registered = Invoke-SmokeJson -Method "POST" -Path "/api/auth/register" -Body @{
  username = $registerUser
  email = $registerEmail
  password = "test123456"
  code = $registerCode.code
}
if (-not $registered.token) {
  throw "Register did not return token"
}
$userHeaders = @{ Authorization = "Bearer $($registered.token)" }

$profile = Invoke-SmokeJson -Method "GET" -Path "/api/user/profile" -Headers $userHeaders
if (-not $profile.user) {
  throw "User profile missing"
}
$balanceBeforeGeneration = [double]$profile.user.balance

$projectName = "Smoke Canvas " + (Get-Date -Format "HHmmss")
$createdProject = Invoke-SmokeJson -Method "POST" -Path "/api/user/projects" -Headers $userHeaders -Body @{
  name = $projectName
}
if (-not $createdProject.success -or -not $createdProject.id) {
  throw "Canvas project create failed"
}
$projectId = $createdProject.id

$workflowData = @{
  nodes = @(
    @{
      id = "node-smoke-product"
      type = "imageNode"
      position = @{ x = 120; y = 160 }
      data = @{
        title = "Smoke product image"
        prompt = "white thermos bottle"
      }
    },
    @{
      id = "node-smoke-output"
      type = "resultNode"
      position = @{ x = 520; y = 160 }
      data = @{
        title = "Smoke output"
      }
    }
  )
  edges = @(
    @{
      id = "edge-smoke"
      source = "node-smoke-product"
      target = "node-smoke-output"
    }
  )
  viewport = @{ x = 10; y = 20; zoom = 0.85 }
  storage = @{ mode = "cloud-smoke"; checkedAt = (Get-Date).ToUniversalTime().ToString("o") }
  thumbnail = "/templates/covers/main-image.svg"
}

$savedWorkflow = Invoke-SmokeJson -Method "POST" -Path "/api/workflows/$projectId/save-json" -Headers $userHeaders -Body @{
  name = $projectName
  data = $workflowData
}
if (-not $savedWorkflow.success -or $savedWorkflow.workflowId -ne $projectId) {
  throw "Canvas workflow cloud save failed"
}

$loadedProject = Invoke-SmokeJson -Method "GET" -Path "/api/user/projects/$projectId" -Headers $userHeaders
if (-not $loadedProject.success -or $loadedProject.data.nodes.Count -ne 2 -or $loadedProject.data.edges.Count -ne 1) {
  throw "Canvas project restore failed"
}
if ($loadedProject.data.viewport.zoom -ne 0.85 -or $loadedProject.data.storage.mode -ne "cloud-smoke") {
  throw "Canvas workflow viewport/storage restore failed"
}

$projectList = Invoke-SmokeJson -Method "GET" -Path "/api/user/projects" -Headers $userHeaders
$listedProject = @($projectList.items) | Where-Object { $_.id -eq $projectId } | Select-Object -First 1
if (-not $projectList.success -or -not $listedProject -or -not $listedProject.thumbnail) {
  throw "Canvas project list restore failed"
}

$updatedWorkflowData = @{
  nodes = @(
    @{
      id = "node-smoke-updated"
      type = "textNode"
      position = @{ x = 240; y = 260 }
      data = @{ title = "Updated smoke node" }
    }
  )
  edges = @()
  viewport = @{ x = 0; y = 0; zoom = 1 }
  storage = @{ mode = "project-put-smoke" }
}
$updatedProject = Invoke-SmokeJson -Method "PUT" -Path "/api/user/projects/$projectId" -Headers $userHeaders -Body @{
  name = "$projectName Updated"
  data = $updatedWorkflowData
}
if (-not $updatedProject.success) {
  throw "Canvas project update failed"
}

$reloadedProject = Invoke-SmokeJson -Method "GET" -Path "/api/user/projects/$projectId" -Headers $userHeaders
if ($reloadedProject.name -ne "$projectName Updated" -or $reloadedProject.data.nodes.Count -ne 1 -or $reloadedProject.data.storage.mode -ne "project-put-smoke") {
  throw "Canvas project update restore failed"
}

$reversePrompt = Invoke-SmokeJson -Method "POST" -Path "/api/template/reverse-prompt" -Headers $userHeaders -Body @{
  templateType = "main-image"
  fields = @{
    userPrompt = "smoke ecommerce hero image, white thermos bottle, clean premium studio lighting"
  }
  platform = "JD"
  ratio = "1:1"
}
if (-not $reversePrompt.success -or -not $reversePrompt.suggestions -or $reversePrompt.suggestions.Count -lt 1) {
  throw "Template reverse prompt failed"
}
if (-not $reversePrompt.rawText -or -not $reversePrompt.prompts -or $reversePrompt.prompts.Count -lt 1) {
  throw "Template reverse prompt compatibility fields missing"
}
$firstReversePrompt = @($reversePrompt.prompts)[0]
if (-not $firstReversePrompt.text -or -not $firstReversePrompt.prompt -or -not $firstReversePrompt.label) {
  throw "Template reverse prompt item shape incompatible"
}

$publicEstimate = Invoke-SmokeJson -Method "POST" -Path "/api/generation/estimate-cost" -Body @{
  model = "gpt-image-2"
  imageCount = 2
}
if (-not $publicEstimate.success -or $publicEstimate.totalCost -le 0 -or -not $publicEstimate.mock) {
  throw "Public generation estimate cost failed"
}

$publicApiStatus = Invoke-SmokeJson -Method "GET" -Path "/api/user/api-status"
if (-not $publicApiStatus.success -or -not $publicApiStatus.provider -or -not $publicApiStatus.mock) {
  throw "Public API status fallback failed"
}

if ($providerMode -eq "real-provider-ready" -and -not $allowRealProviderSmoke) {
  Write-Host "SKIP POST /api/template/generate-image because provider is real-provider-ready. Set ALLOW_REAL_PROVIDER_SMOKE=true to allow paid upstream calls."
} else {
  $templateGenerate = Invoke-SmokeJson -Method "POST" -Path "/api/template/generate-image" -Headers $userHeaders -Body @{
    templateType = "main-image"
    selectedPrompt = "smoke ecommerce hero image, white thermos bottle, clean premium studio lighting"
    imageModel = "gpt-image-2"
    imageCount = 1
    platform = "JD"
    ratio = "1:1"
    quality = "2K"
  }
  if (-not $templateGenerate.success -or -not $templateGenerate.images -or $templateGenerate.images.Count -lt 1) {
    throw "Template image generation failed"
  }
  if (-not $templateGenerate.images[0].url -and -not $templateGenerate.images[0].imageUrl) {
    throw "Template image generation did not return an image URL"
  }
  if ($providerMode -ne "real-provider-ready" -and -not $templateGenerate.mock) {
    throw "Template image generation should be mock when provider is not real-ready"
  }
  if ($templateGenerate.totalCost -le 0) {
    throw "Template image generation did not return totalCost"
  }
  $expectedBalance = $balanceBeforeGeneration - [double]$templateGenerate.totalCost
  if ([math]::Abs(([double]$templateGenerate.remainingBalance) - $expectedBalance) -gt 0.001) {
    throw "Template image generation balance mismatch"
  }

  $profileAfterGeneration = Invoke-SmokeJson -Method "GET" -Path "/api/user/profile" -Headers $userHeaders
  if ([math]::Abs(([double]$profileAfterGeneration.user.balance) - $expectedBalance) -gt 0.001) {
    throw "User profile balance was not deducted after template generation"
  }

  $generations = Invoke-SmokeJson -Method "GET" -Path "/api/user/generations" -Headers $userHeaders
  if (-not $generations.items -or $generations.items.Count -lt 1) {
    throw "User generations missing after template generation"
  }
  if (-not $generations.items[0].imageUrl -or [double]$generations.items[0].cost -le 0) {
    throw "User generation record missing image URL or cost"
  }

  $generatedId = $generations.items[0].id
  $deletedGeneration = Invoke-SmokeJson -Method "DELETE" -Path "/api/user/generations/$generatedId" -Headers $userHeaders
  if (-not $deletedGeneration.success -or -not $deletedGeneration.deleted) {
    throw "User generation delete failed"
  }
}

$adminLogin = Invoke-SmokeJson -Method "POST" -Path "/api/admin/login" -Body @{
  username = "admin"
  password = "admin123"
}
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.token)" }

Invoke-SmokeJson -Method "GET" -Path "/api/admin/dashboard" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/dashboard/user-credit-ranking" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/users" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/orders" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/usage-logs" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/redeem-codes" -Headers $adminHeaders | Out-Null

$smokeCode = "SMOKE" + (Get-Date -Format "MMddHHmmss")
$createdCode = Invoke-SmokeJson -Method "POST" -Path "/api/admin/redeem-codes" -Headers $adminHeaders -Body @{
  code = $smokeCode
  amount = 1
  maxUses = 1
  enabled = $true
}
if (-not $createdCode.success) {
  throw "Redeem code create failed"
}

Invoke-SmokeJson -Method "GET" -Path "/api/admin/api-providers" -Headers $adminHeaders | Out-Null
$providerTest = Invoke-SmokeJson -Method "POST" -Path "/api/admin/api-providers/pub_route_64f93e01e8f3/test" -Headers $adminHeaders
if (-not $providerTest.success) {
  throw "Provider test failed"
}
Invoke-SmokeJson -Method "GET" -Path "/api/admin/model-prices" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/generate-tasks" -Headers $adminHeaders | Out-Null
Invoke-SmokeJson -Method "GET" -Path "/api/admin/template-workflows" -Headers $adminHeaders | Out-Null

$currentWorkflows = Invoke-SmokeJson -Method "GET" -Path "/api/admin/template-workflows" -Headers $adminHeaders
$workflowPatch = Invoke-SmokeJson -Method "PUT" -Path "/api/admin/template-workflows" -Headers $adminHeaders -Body @{
  templates = @($currentWorkflows.items)
  platforms = @($currentWorkflows.platforms)
  qualities = @($currentWorkflows.qualities)
  ratios = @($currentWorkflows.ratios)
  smokeCheckedAt = (Get-Date).ToUniversalTime().ToString("o")
}
if (-not $workflowPatch.success) {
  throw "Template workflows update failed"
}

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

$deletedProject = Invoke-SmokeJson -Method "DELETE" -Path "/api/user/projects/$projectId" -Headers $userHeaders
if (-not $deletedProject.success) {
  throw "Canvas project delete failed"
}

Write-Host "Smoke API checks passed for $baseUrl"
