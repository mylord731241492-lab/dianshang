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

$generations = Invoke-SmokeJson -Method "GET" -Path "/api/user/generations" -Headers $userHeaders
if (-not $generations.items -or $generations.items.Count -lt 1) {
  throw "User generations missing after template generation"
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

Write-Host "Smoke API checks passed for $baseUrl"
