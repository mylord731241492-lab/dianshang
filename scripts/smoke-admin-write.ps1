$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

if ($env:SMOKE_ALLOW_WRITES -ne "true") {
  throw "Admin write smoke is disabled. Set SMOKE_ALLOW_WRITES=true and use a disposable database."
}

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

$adminLogin = Invoke-SmokeJson -Method "POST" -Path "/api/admin/login" -Body @{
  username = "admin"
  password = "admin123"
}
if (-not $adminLogin.token) {
  throw "Admin login failed"
}
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.token)" }

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$userEmail = "admin-write-$stamp@local.test"
$username = "aw$stamp"
$registerCode = Invoke-SmokeJson -Method "POST" -Path "/api/auth/send-email-code" -Body @{
  email = $userEmail
  type = "register"
}
$registered = Invoke-SmokeJson -Method "POST" -Path "/api/auth/register" -Body @{
  username = $username
  email = $userEmail
  password = "test123456"
  code = $registerCode.code
}
$userId = $registered.user.id
if (-not $userId) {
  throw "Registered user missing id"
}

$disabledUser = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/users/$userId/status" -Headers $adminHeaders -Body @{
  status = "disabled"
}
if (-not $disabledUser.success -or $disabledUser.user.status -ne "disabled") {
  throw "User disable failed"
}

$adjustedUser = Invoke-SmokeJson -Method "POST" -Path "/api/admin/users/$userId/balance" -Headers $adminHeaders -Body @{
  amount = 7
  remark = "admin write smoke balance adjust"
}
if (-not $adjustedUser.success -or $adjustedUser.user.balance -lt 57) {
  throw "User balance adjust failed"
}

$securityCheck = Invoke-SmokeJson -Method "POST" -Path "/api/admin/users/$userId/security-check" -Headers $adminHeaders -Body @{}
if (-not $securityCheck.success) {
  throw "User security check failed"
}

$resetPassword = Invoke-SmokeJson -Method "POST" -Path "/api/admin/users/$userId/reset-password" -Headers $adminHeaders -Body @{
  password = "reset123456"
}
if (-not $resetPassword.success) {
  throw "User reset password failed"
}

$deletedUser = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/users/$userId" -Headers $adminHeaders -Body @{
  reason = "admin write smoke"
}
if (-not $deletedUser.success) {
  throw "User soft delete failed"
}

$recycleBin = Invoke-SmokeJson -Method "GET" -Path "/api/admin/recycle-bin/users" -Headers $adminHeaders
if (-not ($recycleBin.users | Where-Object { $_.id -eq $userId })) {
  throw "Deleted user missing from recycle bin"
}

$restoredUser = Invoke-SmokeJson -Method "POST" -Path "/api/admin/recycle-bin/users/$userId/restore" -Headers $adminHeaders
if (-not $restoredUser.success) {
  throw "User restore failed"
}

$purgeDelete = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/users/$userId" -Headers $adminHeaders -Body @{
  reason = "admin write smoke purge"
}
if (-not $purgeDelete.success) {
  throw "User soft delete before purge failed"
}

$purgedUser = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/recycle-bin/users/$userId/permanent" -Headers $adminHeaders -Body @{
  reason = "admin write smoke permanent"
}
if (-not $purgedUser.success) {
  throw "User permanent purge failed"
}

$orders = Invoke-SmokeJson -Method "GET" -Path "/api/admin/orders" -Headers $adminHeaders
$orderId = $orders.items[0].id
$closedOrder = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/orders/$orderId/status" -Headers $adminHeaders -Body @{
  status = "closed"
}
if (-not $closedOrder.success -or $closedOrder.status -ne "closed") {
  throw "Order status patch failed"
}

$code = "AW" + (Get-Date -Format "MMddHHmmss")
$createdCode = Invoke-SmokeJson -Method "POST" -Path "/api/admin/redeem-codes" -Headers $adminHeaders -Body @{
  code = $code
  amount = 9
  maxUses = 2
  enabled = $true
}
if (-not $createdCode.success) {
  throw "Redeem code create failed"
}
$deletedCode = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/redeem-codes/$code" -Headers $adminHeaders
if (-not $deletedCode.success) {
  throw "Redeem code delete failed"
}

$routeKey = "smoke-route-$stamp"
$createdRoute = Invoke-SmokeJson -Method "POST" -Path "/api/admin/api-providers" -Headers $adminHeaders -Body @{
  routeKey = $routeKey
  name = "Smoke Route"
  displayName = "Smoke Route"
  type = "image"
  priority = 3
  baseUrl = "https://new-api.local/v1"
  apiKey = "sk-smoke"
}
$routeId = $createdRoute.route.id
if (-not $routeId) {
  throw "API provider create missing id"
}

$updatedRoute = Invoke-SmokeJson -Method "PUT" -Path "/api/admin/api-providers/$routeId" -Headers $adminHeaders -Body @{
  routeKey = $routeKey
  name = "Smoke Route Updated"
  displayName = "Smoke Route Updated"
  type = "image"
  priority = 5
  enabled = $true
}
if (-not $updatedRoute.success) {
  throw "API provider update failed"
}

$routeTest = Invoke-SmokeJson -Method "POST" -Path "/api/admin/api-providers/$routeId/test" -Headers $adminHeaders
if (-not $routeTest.success) {
  throw "API provider test failed"
}

$models = Invoke-SmokeJson -Method "POST" -Path "/api/admin/api-providers/$routeId/fetch-models" -Headers $adminHeaders
if (-not $models.success -or -not $models.items) {
  throw "API provider fetch models failed"
}

$defaultRoute = Invoke-SmokeJson -Method "POST" -Path "/api/admin/api-providers/$routeId/set-default" -Headers $adminHeaders
if (-not $defaultRoute.success) {
  throw "API provider set default failed"
}

$createdModel = Invoke-SmokeJson -Method "POST" -Path "/api/admin/routes/$routeId/models" -Headers $adminHeaders -Body @{
  modelKey = "smoke-image-model"
  displayName = "Smoke Image Model"
  pricePoints = 11
}
if (-not $createdModel.success) {
  throw "Route model create failed"
}
$modelId = "$($routeId):smoke-image-model"

$patchedModel = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/route-models/$modelId" -Headers $adminHeaders -Body @{
  displayName = "Smoke Image Model Updated"
  pricePoints = 12
}
if (-not $patchedModel.success) {
  throw "Route model patch failed"
}

$disabledModel = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/route-models/$modelId/enabled" -Headers $adminHeaders -Body @{
  enabled = $false
}
if (-not $disabledModel.success -or $disabledModel.enabled -ne $false) {
  throw "Route model enabled patch failed"
}

$deletedModel = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/route-models/$modelId" -Headers $adminHeaders
if (-not $deletedModel.success) {
  throw "Route model delete failed"
}

$deletedRoute = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/api-providers/$routeId" -Headers $adminHeaders
if (-not $deletedRoute.success) {
  throw "API provider delete failed"
}

$workflows = Invoke-SmokeJson -Method "GET" -Path "/api/admin/template-workflows" -Headers $adminHeaders
$patchedWorkflows = Invoke-SmokeJson -Method "PUT" -Path "/api/admin/template-workflows" -Headers $adminHeaders -Body @{
  templates = @($workflows.items)
  platforms = @($workflows.platforms)
  qualities = @($workflows.qualities)
  ratios = @($workflows.ratios)
  adminWriteSmokeAt = (Get-Date).ToUniversalTime().ToString("o")
}
if (-not $patchedWorkflows.success) {
  throw "Template workflows write failed"
}

$patchedSettings = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/settings" -Headers $adminHeaders -Body @{
  adminWriteSmokeAt = (Get-Date).ToUniversalTime().ToString("o")
  registerBonus = 50
}
if (-not $patchedSettings.success) {
  throw "Settings write failed"
}

Write-Host "Admin write smoke checks passed for $baseUrl"
