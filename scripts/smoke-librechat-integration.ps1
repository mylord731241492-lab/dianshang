param(
  [string]$BaseUrl = $(if ($env:CHAT_SMOKE_BASE_URL) { $env:CHAT_SMOKE_BASE_URL } else { "http://127.0.0.1:3457" }),
  [string]$BridgeSecret = $(if ($env:CHAT_SMOKE_BRIDGE_SECRET) { $env:CHAT_SMOKE_BRIDGE_SECRET } else { "chat-test-bridge-secret-20260710-strong" }),
  [string]$AdminUsername = $(if ($env:CHAT_SMOKE_ADMIN_USERNAME) { $env:CHAT_SMOKE_ADMIN_USERNAME } else { "chat-test-admin" }),
  [string]$AdminPassword = $(if ($env:CHAT_SMOKE_ADMIN_PASSWORD) { $env:CHAT_SMOKE_ADMIN_PASSWORD } else { "ChatTestAdminPass2026!" }),
  [string]$ExistingChatUserToken = $(if ($env:CHAT_SMOKE_USER_TOKEN) { $env:CHAT_SMOKE_USER_TOKEN } else { "" }),
  [switch]$UseAdminAsChatUser,
  [switch]$SkipSettingsWrite,
  [switch]$StaticOnly
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$BaseUrl = $BaseUrl.TrimEnd("/")

$serverSourcePath = Join-Path $PSScriptRoot "..\server.js"
$serverSource = Get-Content -Raw -Encoding UTF8 $serverSourcePath
$providerRetryPatterns = @(
  'function isProviderPreTlsReset\(error\)',
  "error\?\.code === 'ECONNRESET'",
  'before secure tls connection was established',
  'const retryDelays = \[250, 750\]',
  'await fetchProvider\(requestUrl',
  'await fetchProvider\(joinProviderUrl\(status\.baseUrl, routeTextEndpoint\(route\)\)',
  'await fetchProvider\(joinProviderUrl\(status\.baseUrl, routeTextChatEndpoint\(route\)\)'
)
foreach ($pattern in $providerRetryPatterns) {
  if ($serverSource -notmatch $pattern) {
    throw "Provider TLS retry guard is missing pattern: $pattern"
  }
}
Write-Host "OK Provider retry is limited to pre-TLS ECONNRESET failures"

$chatSafetyPatterns = @(
  'CHAT_REFUNDED_PROVIDER_MESSAGE',
  'sendChatRefundedMessage\(req, res, model\.k\)',
  "'CHAT_REQUEST_COMPLETED'",
  "'CHAT_REQUEST_IN_PROGRESS'",
  'CREATE TABLE IF NOT EXISTS chat_text_steps',
  'function isChatToolContinuation\(body = \{\}\)',
  'function localWebsiteImageWorkflowCompletion\(body = \{\}, model = ''''\)',
  'quoteId: z\.string\(\)\.min\(1\)\.optional\(\)',
  'confirmation_hash=\?',
  'completeChatStep\(requestId, stepHash, message\.tool_calls\?\.length > 0\)',
  '\[CHAT_PROVIDER_BAD_RESPONSE\]',
  'CHAT_REFUNDED_EMPTY_OUTPUT_MESSAGE'
)
foreach ($pattern in $chatSafetyPatterns) {
  if ($serverSource -notmatch $pattern) {
    throw "Chat idempotency or response-shape diagnostic is missing pattern: $pattern"
  }
}
Write-Host "OK Chat duplicate requests preserve idempotency and report refunded state"

$toolContinuationTestPath = Join-Path $PSScriptRoot "test-librechat-tool-continuation.js"
& node $toolContinuationTestPath
if ($LASTEXITCODE -ne 0) {
  throw "LibreChat tool continuation regression failed"
}
$imageToolsTestPath = Join-Path $PSScriptRoot "test-chat-image-generation-tools.js"
& node $imageToolsTestPath
if ($LASTEXITCODE -ne 0) {
  throw "Chat text-to-image or image-to-image regression failed"
}

$libreChatConfigPath = Join-Path $PSScriptRoot "..\integrations\librechat\librechat.yaml"
$libreChatPatchPath = Join-Path $PSScriptRoot "..\integrations\librechat\patches\apply-patches.js"
$libreChatHomeCatalogPath = Join-Path $PSScriptRoot "..\integrations\librechat\patches\HjmHomeCatalog.tsx"
$libreChatSsoControllerPath = Join-Path $PSScriptRoot "..\integrations\librechat\patches\HjmSsoController.js"
$reviewedSkillSyncPath = Join-Path $PSScriptRoot "sync-librechat-reviewed-skills.js"
$libreChatImageRouteSelectPath = Join-Path $PSScriptRoot "..\integrations\librechat\patches\HjmImageRouteSelect.tsx"
$libreChatDockerfilePath = Join-Path $PSScriptRoot "..\integrations\librechat\Dockerfile"
$libreChatArchivePath = Join-Path $PSScriptRoot "..\integrations\librechat\upstream\LibreChat-0.8.6-rc1.tar.gz"
$chatTestComposePath = Join-Path $PSScriptRoot "..\docker\docker-compose.chat-test.yml"
$chatComposePath = Join-Path $PSScriptRoot "..\docker\docker-compose.yml"
$libreChatConfigSource = Get-Content -Raw -Encoding UTF8 $libreChatConfigPath
$libreChatPatchSource = Get-Content -Raw -Encoding UTF8 $libreChatPatchPath
$libreChatHomeCatalogSource = Get-Content -Raw -Encoding UTF8 $libreChatHomeCatalogPath
$libreChatSsoControllerSource = Get-Content -Raw -Encoding UTF8 $libreChatSsoControllerPath
$reviewedSkillSyncSource = Get-Content -Raw -Encoding UTF8 $reviewedSkillSyncPath
$libreChatImageRouteSelectSource = Get-Content -Raw -Encoding UTF8 $libreChatImageRouteSelectPath
$libreChatDockerfileSource = Get-Content -Raw -Encoding UTF8 $libreChatDockerfilePath
$chatTestComposeSource = Get-Content -Raw -Encoding UTF8 $chatTestComposePath
$chatComposeSource = Get-Content -Raw -Encoding UTF8 $chatComposePath
& node $reviewedSkillSyncPath --dry-run
if ($LASTEXITCODE -ne 0) {
  throw "Reviewed LibreChat Skill package validation failed"
}
if (-not (Test-Path -LiteralPath $libreChatArchivePath)) {
  throw "Pinned LibreChat archive is missing from the project source."
}
$libreChatArchiveSha256 = (Get-FileHash -LiteralPath $libreChatArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($libreChatArchiveSha256 -ne "ccc1adcbe0e7ab62839c2ab952bb2b3d6d7371eab8aaa13d84fbce4c629fb5ad") {
  throw "Pinned LibreChat archive SHA-256 does not match the reviewed upstream artifact."
}
if ($libreChatDockerfileSource -notmatch 'COPY integrations/librechat/upstream/\$\{LIBRECHAT_ARCHIVE\} /tmp/librechat\.tar\.gz') {
  throw "LibreChat Dockerfile must build from the pinned in-project archive."
}
if ($chatTestComposeSource -match 'additional_contexts:' -or $chatComposeSource -match 'additional_contexts:') {
  throw "LibreChat Compose files must not depend on machine-specific additional build contexts."
}
Write-Host "OK LibreChat build uses the pinned in-project upstream archive"
if ($chatTestComposeSource -notmatch 'chat_test_images:/app/client/public/images') {
  throw "Test LibreChat image storage must persist /app/client/public/images"
}
if ($chatComposeSource -notmatch 'chat_images:/app/client/public/images') {
  throw "Production LibreChat image storage must persist /app/client/public/images"
}
Write-Host "OK LibreChat uploaded images use dedicated persistent volumes"
if ($libreChatPatchSource -match '(?ms)const currentEphemeralAgent.*?req\.body\s*=\s*\{') {
  throw "Built-in MCP patch must preserve req.body so buildEndpointOption can attach endpointOption"
}
if ($libreChatConfigSource -notmatch '(?ms)mcpSettings:\s*allowedAddresses:\s*-\s*["'']?app:3456["'']?') {
  throw "LibreChat MCP must allow only the Docker-internal app:3456 address"
}
if ($libreChatConfigSource -notmatch '(?ms)hajimi-website:.*?chatMenu:\s*false') {
  throw "Built-in hajimi MCP must be hidden from the user-selectable Chat menu"
}
if ($libreChatConfigSource -notmatch "X-Chat-Reference-Images:\s*'\{\{LIBRECHAT_BODY_REFERENCEIMAGES\}\}'") {
  throw "LibreChat MCP must forward current message image references"
}
if ($libreChatConfigSource -notmatch "X-Chat-Conversation-ID:\s*'\{\{LIBRECHAT_BODY_CONVERSATIONID\}\}'") {
  throw "LibreChat MCP must forward the current conversation ID for image-plan continuity"
}
if ($libreChatConfigSource -notmatch "X-Chat-Agent-ID:\s*'\{\{LIBRECHAT_BODY_HJMMANAGEDAGENTID\}\}'") {
  throw "LibreChat text and MCP requests must forward the explicit managed agent ID"
}
if ($libreChatHomeCatalogSource -notmatch 'hjm_managed_agent_id:\s*agent\.id') {
  throw "LibreChat managed-agent catalog must place the explicit agent ID in the ephemeral agent"
}
if ($libreChatConfigSource -notmatch 'defaultActiveOnShare:\s*true') {
  throw "Reviewed shared Skills must be active and visible by default"
}
$reviewedSkillPatterns = @(
  '\u8bd5\u7528\u5f15\u5bfc',
  'image-reverse-describe',
  'image-deep-read',
  'style-grammar-distill',
  '\u628a\u8fd9\u5f20\u56fe\u53cd\u63a8\u5230\u4ec5\u51ed\u6587\u5b57\u5c31\u80fd\u91cd\u5efa',
  '\u6df1\u8bfb\u8fd9\u5f20\u56fe',
  '\u628a\u8fd9\u4e9b\u62a5\u544a\u805a\u5408\u6210\u98ce\u683c\u8bed\u6cd5'
)
foreach ($pattern in $reviewedSkillPatterns) {
  if ($libreChatHomeCatalogSource -notmatch $pattern) {
    throw "LibreChat Skill trial guide is missing pattern: $pattern"
  }
}
if ($reviewedSkillSyncSource -notmatch "'User-Agent'" -or
    $reviewedSkillSyncSource -notmatch 'publicGrant' -or
    $reviewedSkillSyncSource -notmatch "publicAccessRoleId:\s*'skill_viewer'") {
  throw "Reviewed Skill sync must use a browser User-Agent and verify the public viewer grant"
}
Write-Host "OK reviewed image Skills and trial guide are wired into Chat"
if ($libreChatSsoControllerSource -notmatch 'function normalizeSsoEmail\(claims = \{\}\)' -or
    $libreChatSsoControllerSource -notmatch '@internal\.local') {
  throw "LibreChat SSO must provide a valid internal-only fallback email for the main-site admin"
}
if ($libreChatPatchSource -notmatch "referenceImages:\s*'b64url:'\s*\+\s*Buffer\.from") {
  throw "LibreChat MCP must encode Unicode attachment paths before placing them in a request header"
}
if ($serverSource -notmatch "raw\.startsWith\('b64url:'\)") {
  throw "Main app must decode the ASCII-safe LibreChat reference image header"
}
$builtInMcpPatterns = @(
  "const BUILT_IN_MCP_SERVERS = \['hajimi-website'\]",
  'currentEphemeralAgent = req\.body\?\.ephemeralAgent',
  'currentEphemeralAgent\.hjm_image_tools === false',
  'req\.body\.ephemeralAgent = \{',
  'mcp: Array\.from\(new Set\(\[\.\.\.selectedMcpServers, \.\.\.builtInMcpServers\]\)\)',
  'hjm_image_tools\?: boolean;',
  'hjm_managed_agent_id\?: string;',
  'HjmHomeCatalog',
  'const hideBuiltInMcpManagement = true',
  "'referenceImages', 'hjmManagedAgentId'\] as const",
  'referenceImages\?: string;',
  "referenceImages: 'b64url:' \+ Buffer\.from\(",
  "value\.startsWith\('/images/'\)",
  'const isHajimiImageToolCall = useMemo',
  'function isHajimiImageToolName',
  'const allHajimiImageTools = useMemo',
  'HjmImageRouteSelect',
  'const imageConfirmationMessage = useMemo',
  'HJM_IMAGE_PLAN_FORM:',
  '\u5b8c\u6574\u8bbe\u8ba1\u65b9\u6848 / \u751f\u56fe\u63d0\u793a\u8bcd',
  '\u6dfb\u52a0\u4e0a\u56fe\u6587\u6848',
  '\u6765\u6e90\uff1a',
  '\u786e\u8ba4\u65b9\u6848',
  '\u4fee\u6539\u8fd9\u5f20',
  '\u518d\u51fa\u4e00\u7248',
  'submitMessage\(\{ text: imageConfirmationMessage \}\)',
  'aria-label="\u786e\u8ba4\u5e76\u751f\u6210\u56fe\u7247"',
  "import Markdown from './Markdown';",
  'Markdown content=\{visibleImageOutput',
  'renders completed generated-image Markdown as an image',
  '\u6b63\u5728\u6574\u7406\u751f\u56fe\u62a5\u4ef7\u2026',
  '<OutputRenderer text=\{visibleImageOutput',
  '!hideBuiltInMcpManagement &&'
)
foreach ($pattern in $builtInMcpPatterns) {
  if ($libreChatPatchSource -notmatch $pattern) {
    throw "Built-in hajimi MCP patch is missing pattern: $pattern"
  }
}
Write-Host "OK hajimi MCP is built in and removed from the user selection menu"
Write-Host "OK Chat image quote includes one-click confirmation through the standard submit flow"
if ($libreChatImageRouteSelectSource -notmatch '/api/model-routes\?group=image' -or
    $libreChatImageRouteSelectSource -notmatch '/api/user/preferences/api-route' -or
    $libreChatImageRouteSelectSource -notmatch '\u9009\u62e9\u751f\u56fe\u7ebf\u8def') {
  throw "Chat image route selector must load, save, and label the ordinary-user route choice"
}
Write-Host "OK Chat includes an ordinary-user image route selector"

if ($StaticOnly) {
  Write-Host "LibreChat static integration checks passed"
  exit 0
}

function Invoke-ChatSmokeRequest {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [hashtable]$Headers = @{},
    $Body = $null,
    [switch]$NoRedirect
  )

  $params = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    Headers = $Headers
    UseBasicParsing = $true
  }
  if ($NoRedirect) {
    $params.MaximumRedirection = 0
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = $Body | ConvertTo-Json -Depth 12
  }

  try {
    $response = Invoke-WebRequest @params
    return [pscustomobject]@{
      Status = [int]$response.StatusCode
      Headers = $response.Headers
      Content = [string]$response.Content
    }
  } catch {
    $errorRecord = $_
    if (-not $errorRecord.Exception.Response) {
      throw
    }
    $response = $errorRecord.Exception.Response
    $content = [string]$errorRecord.ErrorDetails.Message
    if ([string]::IsNullOrWhiteSpace($content)) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      try {
        $content = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }
    }
    return [pscustomobject]@{
      Status = [int]$response.StatusCode
      Headers = $response.Headers
      Content = $content
    }
  }
}

function Assert-Status {
  param($Response, [int]$Expected, [string]$Label)
  if ($Response.Status -ne $Expected) {
    throw "$Label expected HTTP $Expected, got $($Response.Status). Response: $($Response.Content)"
  }
  Write-Host "OK $Label -> $Expected"
}

function Convert-JsonContent {
  param($Response, [string]$Label)
  try {
    return $Response.Content | ConvertFrom-Json
  } catch {
    throw "$Label did not return valid JSON. Response: $($Response.Content)"
  }
}

function Resolve-ChatAssetPath {
  param([Parameter(Mandatory=$true)][string]$Path)
  if ($Path.StartsWith('/chat/')) { return $Path }
  if ($Path.StartsWith('./')) { return "/chat/$($Path.Substring(2))" }
  return "/chat/$Path"
}

function Convert-CodePointsToText {
  param([Parameter(Mandatory=$true)][int[]]$CodePoints)
  return -join ($CodePoints | ForEach-Object { [char]$_ })
}

$homeResponse = Invoke-ChatSmokeRequest -Method "GET" -Path "/"
Assert-Status $homeResponse 200 "main home"
if ($homeResponse.Content -notmatch "chat-entry-link\.js") {
  throw "Main home does not load chat-entry-link.js"
}

$mainHealth = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/health"
Assert-Status $mainHealth 200 "main health"

foreach ($redirectPath in @("/chat", "/CHAT", "/CHAT/")) {
  $redirect = Invoke-ChatSmokeRequest -Method "GET" -Path $redirectPath -NoRedirect
  Assert-Status $redirect 308 "$redirectPath canonical redirect"
  $location = [string]$redirect.Headers["Location"]
  if ($location -notmatch "/chat/$") {
    throw "$redirectPath did not redirect to /chat/. Location=$location"
  }
}

$chatHome = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat/"
Assert-Status $chatHome 200 "chat home"
$oldChatEntry = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat/assets/index.7-3Zm5Bb.js"
Assert-Status $oldChatEntry 410 "old Chat entry isolation"
$previousChatEntry = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat/assets/index.7YakS8m_.js"
Assert-Status $previousChatEntry 410 "previous Chat entry isolation"
if ($chatHome.Content -notmatch '<base\s+href="/chat/"\s*/?>') {
  throw "Chat home does not use the /chat/ base path"
}
if ($chatHome.Content -match [regex]::Escape($BridgeSecret) -or $chatHome.Content -match "mongodb://") {
  throw "Chat HTML exposes an internal secret or MongoDB address"
}

$chatRoute = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat/c/new"
Assert-Status $chatRoute 200 "chat child route refresh"
if ($chatRoute.Content -notmatch '<base\s+href="/chat/"\s*/?>') {
  throw "Chat child route did not return the LibreChat shell"
}

$assetMatch = [regex]::Match($chatHome.Content, '(?:src|href)="(?<path>(?:/chat/|\./)?assets/[^"?]+)')
if (-not $assetMatch.Success) {
  throw "Chat home does not reference a /chat/assets/* resource"
}
$rawChatAssetPath = $assetMatch.Groups["path"].Value
$chatAssetPath = Resolve-ChatAssetPath $rawChatAssetPath
$chatAsset = Invoke-ChatSmokeRequest -Method "GET" -Path $chatAssetPath
Assert-Status $chatAsset 200 "chat asset isolation"

$localeAssetMatch = [regex]::Match($chatHome.Content, '(?:src|href)="(?<path>(?:/chat/|\./)?assets/locales\.[^"?]+\.js)')
if (-not $localeAssetMatch.Success) {
  throw "Chat home does not reference the locale bundle"
}
$localeAssetPath = Resolve-ChatAssetPath $localeAssetMatch.Groups["path"].Value
$localeAsset = Invoke-ChatSmokeRequest -Method "GET" -Path $localeAssetPath
Assert-Status $localeAsset 200 "chat Simplified Chinese locale"
$expectedLocaleLabels = @(
  (Convert-CodePointsToText @(0x6280, 0x80FD)),
  (Convert-CodePointsToText @(0x521B, 0x5EFA, 0x6280, 0x80FD)),
  (Convert-CodePointsToText @(0x6211, 0x7684, 0x6280, 0x80FD)),
  (Convert-CodePointsToText @(0x6682, 0x65E0, 0x6280, 0x80FD)),
  (Convert-CodePointsToText @(0x63A7, 0x5236, 0x9762, 0x677F))
)
foreach ($label in $expectedLocaleLabels) {
  if ($localeAsset.Content -notmatch [regex]::Escape($label)) {
    throw "Chat locale bundle is missing the Simplified Chinese label: $label"
  }
}

$entryAsset = Invoke-ChatSmokeRequest -Method "GET" -Path "/assets/chat-entry-link.js"
Assert-Status $entryAsset 200 "main asset isolation"
if ($entryAsset.Content -notmatch "'/chat/'") {
  throw "Main chat entry does not target /chat/"
}
foreach ($redirectMarker in @("hjm-chat-login-redirect", "sessionStorage", "normalizeChatRedirect")) {
  if ($entryAsset.Content -notmatch [regex]::Escape($redirectMarker)) {
    throw "Main chat entry is missing the safe login redirect marker: $redirectMarker"
  }
}

$adminChatPage = Invoke-ChatSmokeRequest -Method "GET" -Path "/admin/chat-settings"
Assert-Status $adminChatPage 200 "admin Chat settings page"
$adminCssMatch = [regex]::Match($adminChatPage.Content, 'href="(?<path>/assets/index-[^"?]+\.css)"')
if (-not $adminCssMatch.Success) {
  throw "Admin Chat settings page does not reference the source frontend CSS bundle"
}
$adminCss = Invoke-ChatSmokeRequest -Method "GET" -Path $adminCssMatch.Groups["path"].Value
Assert-Status $adminCss 200 "admin Chat contrast CSS"
$adminContrastPatterns = @(
  '--n-border:\s*1px solid #b8c7d1\s*!important',
  '--n-text-color:\s*#0f172a\s*!important',
  '--n-content-text-color:\s*#7c2d12\s*!important',
  '--n-content-text-color:\s*#1e3a8a\s*!important',
  '--n-text-color:\s*#065f46\s*!important',
  '\.admin-chat-provider-panel[^}]+\.n-alert'
)
foreach ($pattern in $adminContrastPatterns) {
  if ($adminCss.Content -notmatch $pattern) {
    throw "Admin Chat contrast CSS is missing pattern: $pattern"
  }
}

$chatConfigNative = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat/api/config"
Assert-Status $chatConfigNative 200 "native chat API base"
$chatConfigAlias = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat-api/config"
Assert-Status $chatConfigAlias 200 "chat API gateway alias"

$adminLogin = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/admin/login" -Body @{
  username = $AdminUsername
  password = $AdminPassword
}
Assert-Status $adminLogin 200 "chat settings admin login"
$adminLoginJson = Convert-JsonContent $adminLogin "chat settings admin login"
if (-not $adminLoginJson.token) {
  throw "Chat settings admin login did not return a token"
}
$adminHeaders = @{ Authorization = "Bearer $($adminLoginJson.token)" }
$adminChatSettings = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/admin/chat/settings" -Headers $adminHeaders
Assert-Status $adminChatSettings 200 "read admin chat settings"
$adminChatSettingsJson = Convert-JsonContent $adminChatSettings "read admin chat settings"
if (-not $adminChatSettingsJson.deployment.enabled -or -not $adminChatSettingsJson.deployment.bridgeSecretConfigured) {
  throw "Admin Chat settings did not report the enabled test deployment"
}
if (@($adminChatSettingsJson.settings.managedAgents).Count -lt 4) {
  throw "Admin Chat settings must seed the default managed agents"
}
$unconfirmedProviderTest = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/admin/chat/test-provider" -Headers $adminHeaders -Body @{
  confirmRealCall = $false
  model = "gpt-5.6-terra"
  prompt = "Reply OK"
}
Assert-Status $unconfirmedProviderTest 400 "reject unconfirmed real provider test"
if (-not $SkipSettingsWrite) {
  $savedAdminChatSettings = Invoke-ChatSmokeRequest -Method "PATCH" -Path "/api/admin/chat/settings" -Headers $adminHeaders -Body @{
    accessEnabled = [bool]$adminChatSettingsJson.settings.accessEnabled
    textChatEnabled = [bool]$adminChatSettingsJson.settings.textChatEnabled
    imageToolsEnabled = [bool]$adminChatSettingsJson.settings.imageToolsEnabled
    allowedModels = @($adminChatSettingsJson.settings.allowedModels)
    maintenanceMessage = [string]$adminChatSettingsJson.settings.maintenanceMessage
    managedAgents = @($adminChatSettingsJson.settings.managedAgents)
  }
  Assert-Status $savedAdminChatSettings 200 "save admin chat settings"
} else {
  Write-Host "SKIP admin Chat settings write"
}
$adminChatTest = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/admin/chat/test" -Headers $adminHeaders -Body @{}
Assert-Status $adminChatTest 200 "admin chat connection test"
$adminChatTestJson = Convert-JsonContent $adminChatTest "admin chat connection test"
if (-not $adminChatTestJson.healthy -or -not ($adminChatTestJson.checks | Where-Object { $_.key -eq 'librechat-health' -and $_.ok })) {
  throw "Admin Chat connection test did not pass all checks"
}

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if (-not [string]::IsNullOrWhiteSpace($ExistingChatUserToken)) {
  $userHeaders = @{ Authorization = "Bearer $ExistingChatUserToken" }
  $profileResponse = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/user/profile" -Headers $userHeaders
  Assert-Status $profileResponse 200 "read existing Chat user profile"
  $profileJson = Convert-JsonContent $profileResponse "read existing Chat user profile"
  $registerJson = [pscustomobject]@{
    token = $ExistingChatUserToken
    user = $profileJson.user
  }
  $username = [string]$profileJson.user.username
  $email = [string]$profileJson.user.email
  Write-Host "SKIP test user registration; reuse an existing user session"
} elseif ($UseAdminAsChatUser) {
  $registerJson = $adminLoginJson
  $username = [string]$adminLoginJson.user.username
  $email = [string]$adminLoginJson.user.email
  $userHeaders = $adminHeaders
  Write-Host "SKIP test user registration; reuse the existing admin session"
} else {
  $username = "chatsmoke$suffix"
  $email = "$username@local.test"
  $register = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/auth/register" -Body @{
    username = $username
    email = $email
    password = "ChatSmokePass2026!"
  }
  Assert-Status $register 200 "test user registration"
  $registerJson = Convert-JsonContent $register "test user registration"
  if (-not $registerJson.token) {
    throw "Test user registration did not return a JWT"
  }
  $userHeaders = @{ Authorization = "Bearer $($registerJson.token)" }
}

$unauthorizedHomeCatalog = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/chat/home-catalog"
Assert-Status $unauthorizedHomeCatalog 401 "reject unauthenticated managed agent catalog"
$homeCatalog = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/chat/home-catalog" -Headers $userHeaders
Assert-Status $homeCatalog 200 "read managed agent catalog"
$homeCatalogJson = Convert-JsonContent $homeCatalog "read managed agent catalog"
if (@($homeCatalogJson.agents).Count -lt 4 -or -not ($homeCatalogJson.agents | Where-Object { $_.id -eq 'ecommerce-main-image' })) {
  throw "Managed agent catalog did not return the default homepage agents"
}
if ($homeCatalogJson.agents | Where-Object { -not $_.instructions -or -not $_.model }) {
  throw "Managed agent catalog returned an incomplete runtime definition"
}

$ticketResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/integrations/librechat/sso-ticket" -Headers $userHeaders -Body @{}
Assert-Status $ticketResponse 200 "create one-time SSO ticket"
$ticketJson = Convert-JsonContent $ticketResponse "create one-time SSO ticket"
if (-not $ticketJson.ticket -or $ticketJson.chatPath -ne "/chat/") {
  throw "SSO ticket response is incomplete"
}

$serviceHeaders = @{ Authorization = "Bearer $BridgeSecret" }
$exchangeResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/integrations/librechat/sso-exchange" -Headers $serviceHeaders -Body @{
  ticket = $ticketJson.ticket
}
Assert-Status $exchangeResponse 200 "consume one-time SSO ticket"
$exchangeJson = Convert-JsonContent $exchangeResponse "consume one-time SSO ticket"
if ($exchangeJson.user.id -ne $registerJson.user.id -or $exchangeJson.user.email -ne $email) {
  throw "SSO user mapping does not match the main user ID"
}

$reuseResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/integrations/librechat/sso-exchange" -Headers $serviceHeaders -Body @{
  ticket = $ticketJson.ticket
}
Assert-Status $reuseResponse 401 "reject reused SSO ticket"

$chatTicketResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/integrations/librechat/sso-ticket" -Headers $userHeaders -Body @{}
Assert-Status $chatTicketResponse 200 "create LibreChat session ticket"
$chatTicketJson = Convert-JsonContent $chatTicketResponse "create LibreChat session ticket"
$chatSsoResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/chat-api/auth/hjm-sso" -Body @{
  ticket = $chatTicketJson.ticket
}
Assert-Status $chatSsoResponse 200 "create LibreChat session"
$chatSsoJson = Convert-JsonContent $chatSsoResponse "create LibreChat session"
if (-not $chatSsoJson.token) {
  throw "LibreChat SSO did not return a session token"
}
$chatSessionHeaders = @{ Authorization = "Bearer $($chatSsoJson.token)" }
$mcpReinitializeResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/chat-api/mcp/hajimi-website/reinitialize" -Headers $chatSessionHeaders -Body @{}
Assert-Status $mcpReinitializeResponse 200 "initialize user-scoped LibreChat MCP"
$mcpReinitializeJson = Convert-JsonContent $mcpReinitializeResponse "initialize user-scoped LibreChat MCP"
if (-not $mcpReinitializeJson.success -or $mcpReinitializeJson.oauthRequired) {
  throw "User-scoped hajimi MCP did not initialize with service authentication"
}
$libreChatMcpToolsResponse = Invoke-ChatSmokeRequest -Method "GET" -Path "/chat-api/mcp/tools" -Headers $chatSessionHeaders
Assert-Status $libreChatMcpToolsResponse 200 "read user-scoped LibreChat MCP tools"
$libreChatMcpToolsJson = Convert-JsonContent $libreChatMcpToolsResponse "read user-scoped LibreChat MCP tools"
$libreChatMcpToolNames = @($libreChatMcpToolsJson.servers.'hajimi-website'.tools | ForEach-Object { $_.name })
foreach ($toolName in @('prepare_ecommerce_image_plan', 'confirm_ecommerce_image_plan', 'prepare_image_generation', 'execute_image_generation')) {
  if ($libreChatMcpToolNames -notcontains $toolName) {
    throw "User-scoped LibreChat MCP is missing tool: $toolName"
  }
}

$bridgeHeaders = @{
  Authorization = "Bearer $BridgeSecret"
  "X-Chat-User-Id" = [string]$registerJson.user.id
  "X-Chat-User-Email" = $email
}
$modelsResponse = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/integrations/librechat/v1/models" -Headers $bridgeHeaders
Assert-Status $modelsResponse 200 "LibreChat model bridge"
$modelsJson = Convert-JsonContent $modelsResponse "LibreChat model bridge"
if (-not $modelsJson.data -or $modelsJson.data.Count -lt 1) {
  throw "LibreChat model bridge returned no text models"
}

$mcpHeaders = $bridgeHeaders.Clone()
$mcpHeaders["X-Chat-Message-Id"] = "mcp-smoke-$suffix"
$mcpHeaders["Accept"] = "application/json, text/event-stream"
$mcpToolsResponse = Invoke-ChatSmokeRequest -Method "POST" -Path "/api/integrations/librechat/mcp" -Headers $mcpHeaders -Body @{
  jsonrpc = "2.0"
  id = 1
  method = "tools/list"
  params = @{}
}
Assert-Status $mcpToolsResponse 200 "LibreChat MCP tools"
foreach ($toolName in @('prepare_ecommerce_image_plan', 'confirm_ecommerce_image_plan', 'prepare_image_generation', 'execute_image_generation')) {
  if ($mcpToolsResponse.Content -notmatch [regex]::Escape($toolName)) {
    throw "LibreChat MCP endpoint did not expose image workflow tool: $toolName"
  }
}

$badSecretResponse = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/integrations/librechat/v1/models" -Headers @{
  Authorization = "Bearer invalid-secret"
  "X-Chat-User-Id" = [string]$registerJson.user.id
  "X-Chat-User-Email" = $email
}
Assert-Status $badSecretResponse 401 "reject invalid service secret"
$badSecretJson = Convert-JsonContent $badSecretResponse "reject invalid service secret"
$badSecretCode = [string]$badSecretJson.code
$badSecretMessage = [string]$badSecretJson.error.message
if ($badSecretCode -ne "INTEGRATION_AUTH_INVALID" -or [string]::IsNullOrWhiteSpace($badSecretMessage)) {
  throw "LibreChat integration errors are not OpenAI-compatible. Response: $($badSecretResponse.Content)"
}

$wrongUserResponse = Invoke-ChatSmokeRequest -Method "GET" -Path "/api/integrations/librechat/v1/models" -Headers @{
  Authorization = "Bearer $BridgeSecret"
  "X-Chat-User-Id" = "hjm:wrong-user-id"
  "X-Chat-User-Email" = $email
}
Assert-Status $wrongUserResponse 401 "reject mismatched main user ID"
$wrongUserJson = Convert-JsonContent $wrongUserResponse "reject mismatched main user ID"
$wrongUserCode = [string]$wrongUserJson.code
$wrongUserMessage = [string]$wrongUserJson.error.message
if ($wrongUserCode -ne "INTEGRATION_USER_NOT_FOUND" -or [string]::IsNullOrWhiteSpace($wrongUserMessage)) {
  throw "LibreChat user mapping error is not OpenAI-compatible. Response: $($wrongUserResponse.Content)"
}

Write-Host "LibreChat integration smoke passed: $BaseUrl"
