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
$userHeaders = @{ Authorization = "Bearer $($registered.token)" }
$balanceBeforeAdjust = 0
if ($null -ne $registered.user.balance) {
  $balanceBeforeAdjust = [double]$registered.user.balance
} elseif ($null -ne $registered.user.credits) {
  $balanceBeforeAdjust = [double]$registered.user.credits
}

$disabledUser = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/users/$userId/status" -Headers $adminHeaders -Body @{
  status = "disabled"
}
if (-not $disabledUser.success -or $disabledUser.user.status -ne "disabled") {
  throw "User disable failed"
}

$adjustedUser = Invoke-SmokeJson -Method "POST" -Path "/api/admin/users/$userId/balance" -Headers $adminHeaders -Body @{
  amount = 27
  remark = "admin write smoke balance adjust"
}
if (-not $adjustedUser.success -or [math]::Abs(([double]$adjustedUser.user.balance) - ($balanceBeforeAdjust + 27)) -gt 0.001) {
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

$generated = Invoke-SmokeJson -Method "POST" -Path "/api/template/generate-image" -Headers $userHeaders -Body @{
  templateType = "main-image"
  selectedPrompt = "admin core actions smoke image"
  imageModel = "gpt-image-2"
  imageCount = 1
  ratio = "1:1"
  quality = "1K"
}
if (-not $generated.success -or -not $generated.taskId) {
  throw "Generation history setup failed"
}

$tasksBeforeDelete = Invoke-SmokeJson -Method "GET" -Path "/api/admin/generate-tasks" -Headers $adminHeaders
$historyTask = $tasksBeforeDelete.items | Where-Object { $_.id -like "gen_*" -and $_.userId -eq $userId } | Select-Object -First 1
if (-not $historyTask) {
  throw "Generation history row missing before admin delete"
}
$deletedTask = Invoke-SmokeJson -Method "DELETE" -Path "/api/admin/generate-tasks/$($historyTask.id)" -Headers $adminHeaders
if (-not $deletedTask.success -or $deletedTask.source -ne "history") {
  throw "Generation history delete failed"
}
$tasksAfterDelete = Invoke-SmokeJson -Method "GET" -Path "/api/admin/generate-tasks" -Headers $adminHeaders
if ($tasksAfterDelete.items | Where-Object { $_.id -eq $historyTask.id }) {
  throw "Deleted generation history row is still visible"
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
if ($orders.available -ne $false -or $orders.items.Count -ne 0) {
  throw "Orders should remain unavailable while payment storage is disabled"
}

$code = "AW" + (Get-Date -Format "MMddHHmmss")
$createdCode = Invoke-SmokeJson -Method "POST" -Path "/api/admin/redeem-codes" -Headers $adminHeaders -Body @{
  code = $code
  points = 9
  totalCount = 2
  perUserLimit = 1
  status = "active"
}
if (-not $createdCode.success) {
  throw "Redeem code create failed"
}
if ($createdCode.points -ne 9 -or $createdCode.totalCount -ne 2) {
  throw "Redeem code frontend-compatible fields failed"
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
if ($createdRoute.route.displayName -ne "Smoke Route" -or $createdRoute.route.baseUrl -ne "https://new-api.local/v1") {
  throw "API provider create compatibility fields failed"
}

$updatedRoute = Invoke-SmokeJson -Method "PUT" -Path "/api/admin/api-providers/$routeId" -Headers $adminHeaders -Body @{
  routeKey = $routeKey
  name = "Smoke Route Updated"
  displayName = "Smoke Route Updated"
  type = "image"
  priority = 5
  baseUrl = "https://new-api-updated.local/v1"
  enabled = $true
}
if (-not $updatedRoute.success) {
  throw "API provider update failed"
}
if ($updatedRoute.route.displayName -ne "Smoke Route Updated" -or $updatedRoute.route.baseUrl -ne "https://new-api-updated.local/v1") {
  throw "API provider update compatibility fields failed"
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
$pricesAfterDelete = Invoke-SmokeJson -Method "GET" -Path "/api/admin/model-prices" -Headers $adminHeaders
if ($pricesAfterDelete.models | Where-Object { $_.id -eq $modelId }) {
  throw "Deleted route model is still visible"
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
