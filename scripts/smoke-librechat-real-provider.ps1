param(
  [string]$BaseUrl = "http://127.0.0.1:3464",
  [string]$AdminUsername = $(if ($env:CHAT_SMOKE_ADMIN_USERNAME) { $env:CHAT_SMOKE_ADMIN_USERNAME } else { "chat-test-admin" }),
  [string]$AdminPassword = $(if ($env:CHAT_SMOKE_ADMIN_PASSWORD) { $env:CHAT_SMOKE_ADMIN_PASSWORD } else { "ChatTestAdminPass2026!" }),
  [string]$Model = "gpt-5.6-terra",
  [string]$Prompt = "Reply with OK only",
  [switch]$ConfirmPaidCall
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

if (-not $ConfirmPaidCall) {
  throw "A real provider test may consume quota. Pass -ConfirmPaidCall explicitly."
}

$BaseUrl = $BaseUrl.TrimEnd('/')

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [hashtable]$Headers = @{},
    $Body = $null
  )

  $params = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    Headers = $Headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json; charset=utf-8'
    $params.Body = $Body | ConvertTo-Json -Depth 10
  }
  try {
    $response = Invoke-WebRequest @params
    return $response.Content | ConvertFrom-Json
  } catch {
    if (-not $_.Exception.Response) { throw }
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
    throw "HTTP $([int]$_.Exception.Response.StatusCode): $content"
  }
}

$login = Invoke-JsonRequest -Method 'POST' -Path '/api/admin/login' -Body @{
  username = $AdminUsername
  password = $AdminPassword
}
if (-not $login.token) { throw 'Admin login did not return a token.' }

$headers = @{ Authorization = "Bearer $($login.token)" }
$settings = Invoke-JsonRequest -Method 'GET' -Path '/api/admin/chat/settings' -Headers $headers
if (-not $settings.deployment.realAiEnabled) {
  throw 'Port 3464 is not ready for real provider calls.'
}
if (-not ($settings.settings.allowedModels -contains $Model)) {
  throw "Model $Model is not in the allowed Chat model list."
}

$response = Invoke-JsonRequest -Method 'POST' -Path '/api/admin/chat/test-provider' -Headers $headers -Body @{
  confirmRealCall = $true
  model = $Model
  prompt = $Prompt
}

if (-not $response.success -or -not $response.result.content) {
  throw 'The real provider test did not return text content.'
}

Write-Host "Real provider test passed."
Write-Host "model=$($response.result.model) latencyMs=$($response.result.latencyMs) totalTokens=$($response.result.usage.totalTokens)"
Write-Host "response=$($response.result.content)"
