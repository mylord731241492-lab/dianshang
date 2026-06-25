$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = $env:SMOKE_ADMIN_PERSISTENCE_TEMP_PORT
if (-not $port) {
  $port = "4597"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-admin-persistence-smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$dataDir = Join-Path $tempRoot "data"
$uploadDir = Join-Path $tempRoot "uploads"
$logDir = Join-Path $tempRoot "logs"

New-Item -ItemType Directory -Force -Path $dataDir, $uploadDir, $logDir | Out-Null

$oldPort = $env:PORT
$oldDataDir = $env:DATA_DIR
$oldDbPath = $env:DB_PATH
$oldUploadDir = $env:UPLOAD_DIR
$oldLogDir = $env:LOG_DIR
$proc = $null
$baseUrl = "http://127.0.0.1:$port"

function Start-SmokeServer {
  param([Parameter(Mandatory=$true)][string]$Phase)

  $outLog = Join-Path $tempRoot "server-$Phase-out.log"
  $errLog = Join-Path $tempRoot "server-$Phase-err.log"
  $script:proc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

  for ($i = 0; $i -lt 50; $i++) {
    try {
      $health = Invoke-RestMethod "$baseUrl/api/health"
      if ($health.success -and $health.database -eq "ok") {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  $errText = ""
  if (Test-Path $errLog) {
    $errText = Get-Content -Encoding UTF8 $errLog -Raw
  }
  throw "Admin persistence smoke server did not become ready during $Phase. $errText"
}

function Stop-SmokeServer {
  if ($script:proc -and -not $script:proc.HasExited) {
    Stop-Process -Id $script:proc.Id -Force
    try {
      Wait-Process -Id $script:proc.Id -Timeout 5 -ErrorAction SilentlyContinue
    } catch {}
  }
  $script:proc = $null
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
    $params.Body = ($Body | ConvertTo-Json -Depth 12)
  }

  $result = Invoke-RestMethod @params
  Write-Host "OK $Method $Path"
  return $result
}

function Get-AdminHeaders {
  $login = Invoke-SmokeJson -Method "POST" -Path "/api/admin/login" -Body @{
    username = "admin"
    password = "admin123"
  }
  if (-not $login.token) {
    throw "Admin login failed"
  }
  return @{ Authorization = "Bearer $($login.token)" }
}

try {
  $env:PORT = "$port"
  $env:DATA_DIR = $dataDir
  $env:DB_PATH = Join-Path $dataDir "data.db"
  $env:UPLOAD_DIR = $uploadDir
  $env:LOG_DIR = $logDir

  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $routeKey = "persist-route-$stamp"
  $modelKey = "persist-model-$stamp"
  $providerName = "Persistence Route $stamp"
  $baseUrlValue = "https://new-api-persist-$stamp.local/v1"

  Start-SmokeServer -Phase "initial"
  $adminHeaders = Get-AdminHeaders

  $patchedSettings = Invoke-SmokeJson -Method "PATCH" -Path "/api/admin/settings" -Headers $adminHeaders -Body @{
    defaultCredits = 73
    persistenceSmokeAt = "$stamp"
  }
  if (-not $patchedSettings.success -or $patchedSettings.settings.persistenceSmokeAt -ne "$stamp") {
    throw "Settings persistence write failed"
  }

  $createdRoute = Invoke-SmokeJson -Method "POST" -Path "/api/admin/api-providers" -Headers $adminHeaders -Body @{
    routeKey = $routeKey
    name = $providerName
    displayName = $providerName
    type = "image"
    priority = 19
    baseUrl = $baseUrlValue
    apiKey = "sk-persistence-smoke"
  }
  $routeId = $createdRoute.route.id
  if (-not $routeId) {
    throw "API provider persistence route id missing"
  }

  $createdModel = Invoke-SmokeJson -Method "POST" -Path "/api/admin/routes/$routeId/models" -Headers $adminHeaders -Body @{
    modelKey = $modelKey
    displayName = "Persistence Model $stamp"
    pricePoints = 17
    qualities = @("1k", "2k")
  }
  if (-not $createdModel.success) {
    throw "Model price persistence write failed"
  }

  $workflows = Invoke-SmokeJson -Method "GET" -Path "/api/admin/template-workflows" -Headers $adminHeaders
  $patchedWorkflows = Invoke-SmokeJson -Method "PUT" -Path "/api/admin/template-workflows" -Headers $adminHeaders -Body @{
    templates = @($workflows.items)
    platforms = @($workflows.platforms)
    qualities = @($workflows.qualities)
    ratios = @($workflows.ratios)
    persistenceSmokeAt = "$stamp"
  }
  if (-not $patchedWorkflows.success -or $patchedWorkflows.persistenceSmokeAt -ne "$stamp") {
    throw "Template workflow persistence write failed"
  }

  Stop-SmokeServer
  Start-SmokeServer -Phase "restart"
  $adminHeaders = Get-AdminHeaders

  $settingsAfterRestart = Invoke-SmokeJson -Method "GET" -Path "/api/admin/settings" -Headers $adminHeaders
  if ($settingsAfterRestart.settings.persistenceSmokeAt -ne "$stamp" -or $settingsAfterRestart.settings.defaultCredits -ne 73) {
    throw "Settings did not persist after restart"
  }

  $providersAfterRestart = Invoke-SmokeJson -Method "GET" -Path "/api/admin/api-providers" -Headers $adminHeaders
  $routeAfterRestart = @($providersAfterRestart.items) | Where-Object { $_.id -eq $routeId -or $_.routeKey -eq $routeKey -or $_.displayName -eq $providerName } | Select-Object -First 1
  if (-not $routeAfterRestart -or $routeAfterRestart.baseUrl -ne $baseUrlValue) {
    throw "API provider did not persist after restart"
  }

  $modelPricesAfterRestart = Invoke-SmokeJson -Method "GET" -Path "/api/admin/model-prices" -Headers $adminHeaders
  $modelAfterRestart = @($modelPricesAfterRestart.rows) | Where-Object { $_.routeId -eq $routeId -and $_.modelKey -eq $modelKey } | Select-Object -First 1
  if (-not $modelAfterRestart -or $modelAfterRestart.pricePoints -ne 17) {
    throw "Model price did not persist after restart"
  }

  $workflowsAfterRestart = Invoke-SmokeJson -Method "GET" -Path "/api/admin/template-workflows" -Headers $adminHeaders
  if ($workflowsAfterRestart.persistenceSmokeAt -ne "$stamp") {
    throw "Template workflows did not persist after restart"
  }

  Write-Host "Admin persistence smoke checks passed with temp data dir: $dataDir"
} finally {
  Stop-SmokeServer

  if ($null -eq $oldPort) { Remove-Item Env:\PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
  if ($null -eq $oldDataDir) { Remove-Item Env:\DATA_DIR -ErrorAction SilentlyContinue } else { $env:DATA_DIR = $oldDataDir }
  if ($null -eq $oldDbPath) { Remove-Item Env:\DB_PATH -ErrorAction SilentlyContinue } else { $env:DB_PATH = $oldDbPath }
  if ($null -eq $oldUploadDir) { Remove-Item Env:\UPLOAD_DIR -ErrorAction SilentlyContinue } else { $env:UPLOAD_DIR = $oldUploadDir }
  if ($null -eq $oldLogDir) { Remove-Item Env:\LOG_DIR -ErrorAction SilentlyContinue } else { $env:LOG_DIR = $oldLogDir }

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
            Write-Warning "Could not remove temp admin persistence smoke directory: $($resolvedTempRoot.Path). You can delete it later."
          } else {
            Start-Sleep -Milliseconds 500
          }
        }
      }
    }
  }
}
