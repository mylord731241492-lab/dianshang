[CmdletBinding()]
param(
  [int]$Port = 3466,
  [switch]$SkipBuild,
  [switch]$SkipUi,
  [switch]$UiOnly
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = Join-Path $repoRoot "docker\docker-compose.canvas-candidate.yml"
$baseUrl = "http://127.0.0.1:$Port"
$candidateContainer = "dianshang-canvas-candidate"
$formalContainer = "dianshang-internal-app"
$adminUsername = "admin"
$adminPassword = "CanvasCandidate!2026!Strong"
$pngBytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
$maskPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
$sourcePngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

function Assert-True {
  param(
    [Parameter(Mandatory=$true)][bool]$Condition,
    [Parameter(Mandatory=$true)][string]$Message
  )
  if (-not $Condition) {
    throw $Message
  }
}

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$Arguments = @()
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

function Get-FormalContainerFingerprint {
  $exists = & docker inspect $formalContainer --format "{{.Id}}|{{.Image}}|{{.State.StartedAt}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $exists) {
    throw "Formal container $formalContainer is missing; cannot prove that port 3456 stayed unchanged"
  }
  return [string]$exists
}

function Invoke-CandidateRequest {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$ExpectedStatus = 200,
    [string]$Token = "",
    $JsonBody = $null,
    [byte[]]$RawBody = $null,
    [string]$ContentType = ""
  )

  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }
  $params = @{
    Method = $Method
    Uri = "$baseUrl$Path"
    Headers = $headers
    UseBasicParsing = $true
  }
  if ($null -ne $JsonBody) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = $JsonBody | ConvertTo-Json -Depth 30 -Compress
  } elseif ($null -ne $RawBody) {
    $params.ContentType = $ContentType
    $params.Body = $RawBody
  }

  $status = 0
  $content = ""
  $responseHeaders = $null
  try {
    $response = Invoke-WebRequest @params
    $status = [int]$response.StatusCode
    $content = [string]$response.Content
    $responseHeaders = $response.Headers
  } catch {
    $httpResponse = $_.Exception.Response
    if (-not $httpResponse) {
      throw
    }
    $status = [int]$httpResponse.StatusCode
    $responseHeaders = $httpResponse.Headers
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = [string]$_.ErrorDetails.Message
    } else {
      $stream = $httpResponse.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
      try {
        $content = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }
    }
  }

  $json = $null
  if ($content) {
    try {
      $json = $content | ConvertFrom-Json
    } catch {}
  }
  if ($status -ne $ExpectedStatus) {
    $code = if ($json -and $json.code) { [string]$json.code } else { "" }
    throw "$Method $Path expected HTTP $ExpectedStatus but got $status (code=$code)"
  }
  Write-Host "OK $Method $Path -> $status"
  return [pscustomobject]@{
    Status = $status
    Content = $content
    Json = $json
    Headers = $responseHeaders
  }
}

function New-MultipartFileBody {
  param(
    [Parameter(Mandatory=$true)][string]$FileName,
    [Parameter(Mandatory=$true)][string]$MimeType,
    [Parameter(Mandatory=$true)][byte[]]$Bytes
  )
  $boundary = "----hjmCandidate$([Guid]::NewGuid().ToString('N'))"
  $header = [System.Text.Encoding]::UTF8.GetBytes(
    "--$boundary`r`nContent-Disposition: form-data; name=`"file`"; filename=`"$FileName`"`r`nContent-Type: $MimeType`r`n`r`n"
  )
  $footer = [System.Text.Encoding]::UTF8.GetBytes("`r`n--$boundary--`r`n")
  $stream = New-Object System.IO.MemoryStream
  try {
    $stream.Write($header, 0, $header.Length)
    $stream.Write($Bytes, 0, $Bytes.Length)
    $stream.Write($footer, 0, $footer.Length)
    return [pscustomobject]@{
      Body = $stream.ToArray()
      ContentType = "multipart/form-data; boundary=$boundary"
    }
  } finally {
    $stream.Dispose()
  }
}

function Register-CandidateUser {
  param([Parameter(Mandatory=$true)][string]$Label)
  $suffix = "$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$([Guid]::NewGuid().ToString('N').Substring(0, 6))"
  $username = "candidate-$Label-$suffix"
  $password = "Candidate-$Label!2026-$suffix"
  $response = Invoke-CandidateRequest -Method "POST" -Path "/api/auth/register" -JsonBody @{
    username = $username
    email = "$username@test.internal"
    password = $password
  }
  Assert-True -Condition ([bool]$response.Json.token) -Message "Registered user $Label did not receive a token"
  return [pscustomobject]@{
    Token = [string]$response.Json.token
    User = $response.Json.user
    Username = $username
    Password = $password
  }
}

function Upload-CandidateAsset {
  param(
    [Parameter(Mandatory=$true)][string]$Token,
    [Parameter(Mandatory=$true)][string]$FileName
  )
  $multipart = New-MultipartFileBody -FileName $FileName -MimeType "image/png" -Bytes $pngBytes
  return Invoke-CandidateRequest -Method "POST" -Path "/api/user/assets/upload" -Token $Token -RawBody $multipart.Body -ContentType $multipart.ContentType
}

function Wait-GenerationTask {
  param(
    [Parameter(Mandatory=$true)][string]$Token,
    [Parameter(Mandatory=$true)][string]$TaskId,
    [int]$MaxAttempts = 120
  )
  for ($attempt = 0; $attempt -lt $MaxAttempts; $attempt++) {
    $poll = Invoke-CandidateRequest -Method "GET" -Path "/api/generate/tasks/$TaskId" -Token $Token
    if (@("success", "failed", "cancelled") -contains [string]$poll.Json.status) {
      return $poll.Json
    }
    Start-Sleep -Milliseconds 250
  }
  throw "Generation task $TaskId did not reach a terminal state in time"
}

function Invoke-PlaywrightRunner {
  param(
    [Parameter(Mandatory=$true)][string]$RunnerPath,
    [Parameter(Mandatory=$true)][string]$Session
  )

  $stdout = Join-Path ([System.IO.Path]::GetTempPath()) "dianshang-infinite-canvas-candidate-ui-out.log"
  $stderr = Join-Path ([System.IO.Path]::GetTempPath()) "dianshang-infinite-canvas-candidate-ui-err.log"
  if (Test-Path -LiteralPath $stdout) { Remove-Item -LiteralPath $stdout -Force }
  if (Test-Path -LiteralPath $stderr) { Remove-Item -LiteralPath $stderr -Force }

  $openArgs = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $Session, "open", "$baseUrl/canvas?candidate-smoke=bootstrap")
  $open = Start-Process -FilePath "npx.cmd" -ArgumentList $openArgs -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
  try {
    Start-Sleep -Seconds 6
    if ($open.HasExited -and $open.ExitCode -ne 0) {
      throw "Playwright candidate session failed to open (exit $($open.ExitCode))"
    }
    $runArgs = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $Session, "run-code", "--filename", $RunnerPath)
    $run = Start-Process -FilePath "npx.cmd" -ArgumentList $runArgs -WorkingDirectory $repoRoot -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $outText = if (Test-Path -LiteralPath $stdout) { Get-Content -LiteralPath $stdout -Encoding UTF8 -Raw } else { "" }
    $errText = if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Encoding UTF8 -Raw } else { "" }
    if ($outText -and $outText.Trim()) { Write-Host $outText.Trim() }
    if ($errText -and $errText.Trim()) { Write-Host $errText.Trim() }
    $runnerReportedError = $outText -match "### Error" -or $errText -match "### Error"
    if ($run.ExitCode -ne 0 -or $runnerReportedError) {
      $reason = if ($runnerReportedError) { "runner output reported an error" } else { "exit $($run.ExitCode)" }
      throw "Infinite Canvas candidate Playwright smoke failed ($reason)"
    }
  } finally {
    $closeArgs = @("--yes", "--package", "@playwright/cli", "playwright-cli", "--session", $Session, "close")
    Start-Process -FilePath "npx.cmd" -ArgumentList $closeArgs -WorkingDirectory $repoRoot -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue | Out-Null
  }
}

if ($Port -ne 3466) {
  throw "The isolated candidate is fixed to 127.0.0.1:3466"
}
if (-not (Test-Path -LiteralPath $composeFile)) {
  throw "Candidate compose file is missing: $composeFile"
}

$formalBefore = Get-FormalContainerFingerprint
Write-Host "Captured the formal 3456 container fingerprint"

$composeText = Get-Content -LiteralPath $composeFile -Encoding UTF8 -Raw
Assert-True -Condition ($composeText.Contains('127.0.0.1:3466:3466')) -Message "Candidate compose is not bound to 127.0.0.1:3466"
Assert-True -Condition ($composeText.Contains('CANVAS_RUNTIME: infinite')) -Message "Candidate compose does not set CANVAS_RUNTIME=infinite"
Assert-True -Condition ($composeText.Contains('ENABLE_REAL_AI: "false"')) -Message "Candidate compose does not disable real AI"
Assert-True -Condition ($composeText.Contains('ENABLE_REAL_STORAGE: "false"')) -Message "Candidate compose does not disable real storage"
Assert-True -Condition ($composeText.Contains('ENABLE_REAL_EMAIL: "false"')) -Message "Candidate compose does not disable real email"
Assert-True -Condition ($composeText.Contains('ENABLE_REAL_PAYMENT: "false"')) -Message "Candidate compose does not disable real payment"
Assert-True -Condition (-not $composeText.Contains('./data:/app/data')) -Message "Candidate compose appears to mount formal docker/data"
Assert-True -Condition (-not $composeText.Contains('./uploads:/app/uploads')) -Message "Candidate compose appears to mount formal docker/uploads"

$scratchRoot = Join-Path $repoRoot ".scratch\infinite-canvas-candidate"
@("data", "uploads", "workflows", "logs", "object-storage") | ForEach-Object {
  $path = Join-Path $scratchRoot $_
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
  }
}

if ($SkipBuild) {
  Invoke-NativeChecked -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "up", "-d", "app")
} else {
  Invoke-NativeChecked -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "up", "-d", "--build", "--force-recreate", "app")
}

$healthy = $false
for ($attempt = 0; $attempt -lt 80; $attempt++) {
  $health = & docker inspect $candidateContainer --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" 2>$null
  if ($LASTEXITCODE -eq 0 -and [string]$health -eq "healthy") {
    $healthy = $true
    break
  }
  Start-Sleep -Milliseconds 500
}
if (-not $healthy) {
  & docker logs --tail 120 $candidateContainer
  throw "Candidate container $candidateContainer did not become healthy"
}

$healthResponse = Invoke-CandidateRequest -Method "GET" -Path "/api/health"
Assert-True -Condition ($healthResponse.Json.success -eq $true) -Message "Candidate health response does not report success=true"
Assert-True -Condition ([string]$healthResponse.Json.canvasRuntime -eq "infinite") -Message "Candidate health response does not report infinite runtime"
Assert-True -Condition ([string]$healthResponse.Json.providers.ai.mode -ne "real-provider-ready") -Message "Candidate unexpectedly enabled real AI"
Assert-True -Condition ([string]$healthResponse.Json.providers.storage.mode -ne "real-storage-ready") -Message "Candidate unexpectedly enabled real storage"

$canvas = Invoke-CandidateRequest -Method "GET" -Path "/canvas?candidate-api-smoke=1"
Assert-True -Condition ($canvas.Content.Contains("/canvas-app/")) -Message "Candidate /canvas did not load the Infinite Canvas entry"
Invoke-CandidateRequest -Method "GET" -Path "/api/user/profile" -ExpectedStatus 401 | Out-Null

if (-not $UiOnly) {
$adminLogin = Invoke-CandidateRequest -Method "POST" -Path "/api/admin/login" -JsonBody @{
  username = $adminUsername
  password = $adminPassword
}
Assert-True -Condition ([bool]$adminLogin.Json.token) -Message "Candidate admin login failed"
$adminToken = [string]$adminLogin.Json.token

$userA = Register-CandidateUser -Label "a"
$userB = Register-CandidateUser -Label "b"
Invoke-CandidateRequest -Method "POST" -Path "/api/admin/users/$($userA.User.id)/balance" -Token $adminToken -JsonBody @{
  amount = 200
  remark = "Task 13 isolated candidate smoke credit"
} | Out-Null
$profileBefore = Invoke-CandidateRequest -Method "GET" -Path "/api/user/profile" -Token $userA.Token
$initialBalance = [double]$profileBefore.Json.user.balance

$projectEnvelope = @{
  schema = "hjm.infinite-canvas.project"
  schemaVersion = 1
  engine = "infinite-canvas"
  upstreamVersion = "0.10.0"
  project = @{
    nodes = @(
      @{
        id = "candidate-node-text"
        type = "text"
        title = "Candidate text"
        position = @{ x = 100; y = 120 }
        width = 320
        height = 220
        metadata = @{ content = "Task 13 candidate project" }
      },
      @{
        id = "candidate-node-config"
        type = "config"
        title = "Candidate config"
        position = @{ x = 560; y = 120 }
        width = 340
        height = 260
        metadata = @{ prompt = "Task 13 candidate config prompt" }
      }
    )
    connections = @(
      @{
        id = "candidate-connection-1"
        fromNodeId = "candidate-node-text"
        toNodeId = "candidate-node-config"
      }
    )
    chatSessions = @()
    activeChatId = $null
    backgroundMode = "lines"
    showImageInfo = $false
    viewport = @{ x = 0; y = 0; k = 1 }
  }
}

$projectCreate = Invoke-CandidateRequest -Method "POST" -Path "/api/user/projects" -Token $userA.Token -JsonBody @{
  name = "Task 13 API candidate project"
  data = $projectEnvelope
}
$projectId = [string]$projectCreate.Json.id
Assert-True -Condition ($projectId.StartsWith("proj_")) -Message "Project create did not return a server proj_* ID"

Invoke-CandidateRequest -Method "PUT" -Path "/api/user/projects/$projectId" -Token $userA.Token -JsonBody @{
  name = "Task 13 API candidate project saved"
  data = $projectEnvelope
} | Out-Null
$projectRead = Invoke-CandidateRequest -Method "GET" -Path "/api/user/projects/$projectId" -Token $userA.Token
Assert-True -Condition ($projectRead.Json.data.schema -eq "hjm.infinite-canvas.project") -Message "Project envelope schema mismatch"
Assert-True -Condition ($projectRead.Json.data.project.nodes.Count -eq 2) -Message "Project did not restore two nodes"
Assert-True -Condition ($projectRead.Json.data.project.connections.Count -eq 1) -Message "Project did not restore one connection"
$projectListB = Invoke-CandidateRequest -Method "GET" -Path "/api/user/projects" -Token $userB.Token
Assert-True -Condition (-not ($projectListB.Json.items | Where-Object { $_.id -eq $projectId })) -Message "User B can see user A's project"
Invoke-CandidateRequest -Method "GET" -Path "/api/user/projects/$projectId" -Token $userB.Token -ExpectedStatus 404 | Out-Null

$agentBrowserSessionId = "candidate-browser-$([Guid]::NewGuid().ToString('N'))"
$agentSessionCreate = Invoke-CandidateRequest -Method "POST" -Path "/api/canvas/agent/sessions" -Token $userA.Token -ExpectedStatus 201 -JsonBody @{
  projectId = $projectId
  browserSessionId = $agentBrowserSessionId
  title = "Task 13A Agent smoke"
}
$agentSessionId = [string]$agentSessionCreate.Json.session.id
Assert-True -Condition ($agentSessionId.StartsWith("agent_session_")) -Message "Canvas Agent did not create a persistent session"
$agentTurn = Invoke-CandidateRequest -Method "POST" -Path "/api/canvas/agent/sessions/$agentSessionId/messages" -Token $userA.Token -JsonBody @{
  projectId = $projectId
  browserSessionId = $agentBrowserSessionId
  text = "create two text nodes and connect"
  snapshot = @{
    projectId = $projectId
    title = "Task 13A Agent smoke"
    nodes = @()
    connections = @()
    selectedNodeIds = @()
    viewport = @{ x = 0; y = 0; k = 1 }
  }
  attachments = @()
}
Assert-True -Condition ([string]$agentTurn.Json.session.status -eq "waiting_confirmation") -Message "Canvas Agent write did not wait for confirmation"
Assert-True -Condition ($agentTurn.Json.toolCalls.Count -eq 1) -Message "Canvas Agent did not return one deterministic Fake Provider proposal"
$agentToolCallId = [string]$agentTurn.Json.toolCalls[0].id
Assert-True -Condition ([string]$agentTurn.Json.toolCalls[0].execution.kind -eq "canvas_ops") -Message "Canvas Agent proposal is not a canvas_ops execution"
Assert-True -Condition ($agentTurn.Json.toolCalls[0].execution.ops.Count -eq 3) -Message "Canvas Agent proposal does not contain two nodes and one connection"
$agentConfirm = Invoke-CandidateRequest -Method "POST" -Path "/api/canvas/agent/sessions/$agentSessionId/tool-calls/$agentToolCallId/confirm" -Token $userA.Token -JsonBody @{
  projectId = $projectId
  browserSessionId = $agentBrowserSessionId
}
Assert-True -Condition ($agentConfirm.Json.execute -eq $true) -Message "First Canvas Agent confirmation did not grant one browser execution"
$agentConfirmReplay = Invoke-CandidateRequest -Method "POST" -Path "/api/canvas/agent/sessions/$agentSessionId/tool-calls/$agentToolCallId/confirm" -Token $userA.Token -JsonBody @{
  projectId = $projectId
  browserSessionId = $agentBrowserSessionId
}
Assert-True -Condition ($agentConfirmReplay.Json.execute -eq $false -and $agentConfirmReplay.Json.replayed -eq $true) -Message "Repeated Canvas Agent confirmation was not idempotent"
$agentResult = Invoke-CandidateRequest -Method "POST" -Path "/api/canvas/agent/sessions/$agentSessionId/tool-calls/$agentToolCallId/result" -Token $userA.Token -JsonBody @{
  projectId = $projectId
  browserSessionId = $agentBrowserSessionId
  result = @{ ok = $true; nodeCount = 2; connectionCount = 1 }
}
Assert-True -Condition ([string]$agentResult.Json.toolCall.status -eq "executed") -Message "Canvas Agent execution result was not persisted"
$agentRestore = Invoke-CandidateRequest -Method "GET" -Path "/api/canvas/agent/sessions/${agentSessionId}?projectId=$projectId&browserSessionId=$agentBrowserSessionId" -Token $userA.Token
Assert-True -Condition ([bool]($agentRestore.Json.events | Where-Object { $_.type -eq "tool_executed" })) -Message "Canvas Agent history did not restore tool execution"
Invoke-CandidateRequest -Method "GET" -Path "/api/canvas/agent/sessions/${agentSessionId}?projectId=$projectId&browserSessionId=$agentBrowserSessionId" -Token $userB.Token -ExpectedStatus 404 | Out-Null

$assetUploadA = Upload-CandidateAsset -Token $userA.Token -FileName "candidate-a-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).png"
$assetUploadA2 = Upload-CandidateAsset -Token $userA.Token -FileName "candidate-page-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()).png"
$assetA = $assetUploadA.Json.asset
$assetA2 = $assetUploadA2.Json.asset
Assert-True -Condition ([string]$assetA.id -like "asset_*") -Message "Asset upload did not return an asset_* ID"
$assetPage1 = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets?limit=1" -Token $userA.Token
Assert-True -Condition ($assetPage1.Json.items.Count -eq 1) -Message "Asset page one has an unexpected item count"
Assert-True -Condition ([bool]$assetPage1.Json.nextCursor) -Message "Asset page one did not return nextCursor"
$assetPage2 = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets?limit=1&cursor=$([Uri]::EscapeDataString([string]$assetPage1.Json.nextCursor))" -Token $userA.Token
Assert-True -Condition ($assetPage2.Json.items.Count -eq 1) -Message "Asset page two has an unexpected item count"
$assetSearch = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets?q=$([Uri]::EscapeDataString([string]$assetA.name))" -Token $userA.Token
Assert-True -Condition ([bool]($assetSearch.Json.items | Where-Object { $_.id -eq $assetA.id })) -Message "Asset search did not return the uploaded item"
$assetRename = Invoke-CandidateRequest -Method "PUT" -Path "/api/user/assets/$($assetA.id)" -Token $userA.Token -JsonBody @{
  name = "candidate-renamed.png"
  tags = @("task13", "candidate")
}
Assert-True -Condition ($assetRename.Json.asset.name -eq "candidate-renamed.png") -Message "Asset rename did not persist"
Assert-True -Condition ($assetRename.Json.asset.tags -contains "task13") -Message "Asset tags did not persist"
$assetAccess = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets/$($assetA.id)/access-url" -Token $userA.Token
Assert-True -Condition ([string]$assetAccess.Json.url -like "/api/asset-content/*") -Message "Asset access URL is not a same-origin path"
Assert-True -Condition ([int]$assetAccess.Json.expiresInSeconds -eq 900) -Message "Asset access URL TTL is not 900 seconds"
Invoke-CandidateRequest -Method "GET" -Path ([string]$assetAccess.Json.url) | Out-Null
$assetListB = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets" -Token $userB.Token
Assert-True -Condition (-not ($assetListB.Json.items | Where-Object { $_.id -eq $assetA.id })) -Message "User B can see user A's asset"
Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets/$($assetA.id)/access-url" -Token $userB.Token -ExpectedStatus 404 | Out-Null
Invoke-CandidateRequest -Method "DELETE" -Path "/api/user/assets/$($assetA2.id)" -Token $userA.Token | Out-Null
$assetAfterDelete = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets?q=$([Uri]::EscapeDataString([string]$assetA2.name))" -Token $userA.Token
Assert-True -Condition (-not ($assetAfterDelete.Json.items | Where-Object { $_.id -eq $assetA2.id })) -Message "Soft-deleted asset is still listed"

$systemDraft = Invoke-CandidateRequest -Method "POST" -Path "/api/admin/system-prompts" -Token $adminToken -JsonBody @{
  title = "Task 13 system prompt"
  content = "Task 13 published system prompt body"
  category = "candidate acceptance"
  tags = @("task13", "system")
  status = "draft"
  sortOrder = 13
}
$systemPromptId = [string]$systemDraft.Json.item.id
Invoke-CandidateRequest -Method "PUT" -Path "/api/admin/system-prompts/$systemPromptId" -Token $adminToken -JsonBody @{ status = "published" } | Out-Null
$systemForA = Invoke-CandidateRequest -Method "GET" -Path "/api/prompts/system?q=Task%2013" -Token $userA.Token
$systemForB = Invoke-CandidateRequest -Method "GET" -Path "/api/prompts/system?q=Task%2013" -Token $userB.Token
Assert-True -Condition ([bool]($systemForA.Json.items | Where-Object { $_.id -eq $systemPromptId })) -Message "User A cannot see the published system prompt"
Assert-True -Condition ([bool]($systemForB.Json.items | Where-Object { $_.id -eq $systemPromptId })) -Message "User B cannot see the published system prompt"
Invoke-CandidateRequest -Method "PUT" -Path "/api/admin/system-prompts/$systemPromptId" -Token $userA.Token -JsonBody @{ title = "forbidden update" } -ExpectedStatus 403 | Out-Null
Invoke-CandidateRequest -Method "PUT" -Path "/api/admin/system-prompts/$systemPromptId" -Token $adminToken -JsonBody @{ status = "disabled" } | Out-Null
$systemDisabled = Invoke-CandidateRequest -Method "GET" -Path "/api/prompts/system?q=Task%2013" -Token $userA.Token
Assert-True -Condition (-not ($systemDisabled.Json.items | Where-Object { $_.id -eq $systemPromptId })) -Message "Disabled system prompt is still visible to normal users"

$privatePrompt = Invoke-CandidateRequest -Method "POST" -Path "/api/user/prompts" -Token $userA.Token -JsonBody @{
  title = "Task 13 private prompt"
  content = "Task 13 private prompt body"
  category = "candidate acceptance"
  tags = @("task13")
}
$privatePromptId = [string]$privatePrompt.Json.item.id
$privateUpdated = Invoke-CandidateRequest -Method "PUT" -Path "/api/user/prompts/$privatePromptId" -Token $userA.Token -JsonBody @{
  title = "Task 13 private prompt edited"
  content = "Task 13 private prompt body edited"
  isFavorite = $true
  tags = @("task13", "favorite")
}
Assert-True -Condition ($privateUpdated.Json.item.isFavorite -eq $true) -Message "Private prompt favorite state did not persist"
$privateSearch = Invoke-CandidateRequest -Method "GET" -Path "/api/user/prompts?q=edited&favorite=1" -Token $userA.Token
Assert-True -Condition ([bool]($privateSearch.Json.items | Where-Object { $_.id -eq $privatePromptId })) -Message "Private prompt search/favorite filter did not return the item"
$privateListB = Invoke-CandidateRequest -Method "GET" -Path "/api/user/prompts" -Token $userB.Token
Assert-True -Condition (-not ($privateListB.Json.items | Where-Object { $_.id -eq $privatePromptId })) -Message "User B can see user A's private prompt"
Invoke-CandidateRequest -Method "GET" -Path "/api/user/prompts/$privatePromptId" -Token $userB.Token -ExpectedStatus 404 | Out-Null

$generatedBefore = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets" -Token $userA.Token
$generatedBeforeCount = @($generatedBefore.Json.items | Where-Object { $_.source -eq "generated" }).Count
$blobBoundary = Invoke-CandidateRequest -Method "POST" -Path "/api/generate/tasks" -Token $userA.Token -ExpectedStatus 400 -JsonBody @{
  prompt = "Candidate blob boundary"
  modelKey = "gpt-image-2"
  imageCount = 1
  clientRequestId = "candidate-blob-boundary-$([Guid]::NewGuid().ToString('N'))"
  referenceImages = @(@{
    name = "reference.png"
    type = "image/png"
    url = "blob:http://127.0.0.1:3466/candidate-boundary"
  })
}
Assert-True -Condition ($blobBoundary.Json.code -eq "GENERATION_REFERENCE_BLOB_URL_UNSUPPORTED") -Message "Blob URL was not rejected at the generation boundary"
$clientRequestId = "candidate-generate-$([Guid]::NewGuid().ToString('N'))"
$generationSubmit = Invoke-CandidateRequest -Method "POST" -Path "/api/generate/tasks" -Token $userA.Token -ExpectedStatus 202 -JsonBody @{
  prompt = "Task 13 Fake Provider single generation"
  modelKey = "gpt-image-2"
  imageCount = 1
  ratio = "1:1"
  clientRequestId = $clientRequestId
}
$generationReplay = Invoke-CandidateRequest -Method "POST" -Path "/api/generate/tasks" -Token $userA.Token -ExpectedStatus 202 -JsonBody @{
  prompt = "Task 13 Fake Provider single generation"
  modelKey = "gpt-image-2"
  imageCount = 1
  ratio = "1:1"
  clientRequestId = $clientRequestId
}
Assert-True -Condition ($generationReplay.Json.replayed -eq $true) -Message "The same clientRequestId did not replay"
Assert-True -Condition ($generationReplay.Json.taskId -eq $generationSubmit.Json.taskId) -Message "Idempotent replay created a second taskId"
$generationTask = Wait-GenerationTask -Token $userA.Token -TaskId ([string]$generationSubmit.Json.taskId)
Assert-True -Condition ($generationTask.status -eq "success") -Message "Fake Provider generation task did not succeed"
Assert-True -Condition ($generationTask.request.mock -eq $true) -Message "Candidate generation task is not marked mock"
$generatedAfter = Invoke-CandidateRequest -Method "GET" -Path "/api/user/assets" -Token $userA.Token
$generatedAfterCount = @($generatedAfter.Json.items | Where-Object { $_.source -eq "generated" }).Count
Assert-True -Condition ($generatedAfterCount -eq ($generatedBeforeCount + 1)) -Message "Idempotent request did not create exactly one generated asset"

foreach ($tool in @(
  @{ Path = "/api/image-tools/inpaint"; Body = @{ imageUrl = $sourcePngDataUrl; mask = $maskPngDataUrl; prompt = "Task 13 inpaint" } },
  @{ Path = "/api/image-tools/erase"; Body = @{ imageUrl = $sourcePngDataUrl; mask = $maskPngDataUrl; prompt = "Task 13 erase" } },
  @{ Path = "/api/image-tools/outpaint"; Body = @{ imageUrl = $sourcePngDataUrl; prompt = "Task 13 outpaint"; ratio = "16:9"; layout = @{ anchor = "center" } } }
)) {
  $toolResponse = Invoke-CandidateRequest -Method "POST" -Path $tool.Path -Token $userA.Token -JsonBody $tool.Body
  Assert-True -Condition ($toolResponse.Json.success -eq $true) -Message "$($tool.Path) did not return success=true"
  Assert-True -Condition ($toolResponse.Json.mock -eq $true) -Message "$($tool.Path) did not run in Fake Provider mode"
}

$cancelRequestId = "candidate-cancel-$([Guid]::NewGuid().ToString('N'))"
$cancelSubmit = Invoke-CandidateRequest -Method "POST" -Path "/api/generate/tasks" -Token $userA.Token -ExpectedStatus 202 -JsonBody @{
  prompt = "Task 13 cancel and retry"
  modelKey = "gpt-image-2"
  imageCount = 3
  ratio = "1:1"
  clientRequestId = $cancelRequestId
}
$cancelTask = Invoke-CandidateRequest -Method "POST" -Path "/api/generate/tasks/$($cancelSubmit.Json.taskId)/cancel" -Token $userA.Token -JsonBody @{ reason = "Task 13 active cancel" }
Assert-True -Condition ($cancelTask.Json.status -eq "cancelled") -Message "Cancelled task status is not cancelled"
$retrySubmit = Invoke-CandidateRequest -Method "POST" -Path "/api/generate/tasks/$($cancelSubmit.Json.taskId)/retry" -Token $userA.Token -ExpectedStatus 202 -JsonBody @{}
Assert-True -Condition ($retrySubmit.Json.retryOfTaskId -eq $cancelSubmit.Json.taskId) -Message "Manual retry does not reference the original task"
$retryTask = Wait-GenerationTask -Token $userA.Token -TaskId ([string]$retrySubmit.Json.taskId)
Assert-True -Condition ($retryTask.status -eq "success") -Message "Manual retry task did not succeed"

$profileAfter = Invoke-CandidateRequest -Method "GET" -Path "/api/user/profile" -Token $userA.Token
$expectedBalance = $initialBalance - [double]$generationTask.settledCost - [double]$retryTask.settledCost
Assert-True -Condition ([Math]::Abs([double]$profileAfter.Json.user.balance - $expectedBalance) -lt 0.0001) -Message "Final balance does not match successful settlements plus cancellation refund"

Invoke-CandidateRequest -Method "DELETE" -Path "/api/user/projects/$projectId" -Token $userA.Token | Out-Null
Invoke-CandidateRequest -Method "GET" -Path "/api/user/projects/$projectId" -Token $userA.Token -ExpectedStatus 404 | Out-Null
Invoke-CandidateRequest -Method "DELETE" -Path "/api/user/prompts/$privatePromptId" -Token $userA.Token | Out-Null
Invoke-CandidateRequest -Method "GET" -Path "/api/user/prompts/$privatePromptId" -Token $userA.Token -ExpectedStatus 404 | Out-Null
}

if (-not $SkipUi) {
  $outputDirectory = Join-Path $repoRoot "output\playwright"
  if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  }
  $session = "infinite-canvas-candidate-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  Invoke-PlaywrightRunner -RunnerPath (Join-Path $PSScriptRoot "smoke-infinite-canvas-candidate-ui-runner.js") -Session $session
}

$formalAfter = Get-FormalContainerFingerprint
Assert-True -Condition ($formalAfter -eq $formalBefore) -Message "Formal 3456 image, start time, or health changed during Task 13"

$candidateIdentity = & docker inspect $candidateContainer --format "{{.Image}}|{{.State.StartedAt}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}"
Write-Host "Candidate container fingerprint: $candidateIdentity"
Write-Host "Formal 3456 fingerprint unchanged: $formalAfter"
Write-Host "Infinite Canvas candidate API/UI smoke passed on $baseUrl"
