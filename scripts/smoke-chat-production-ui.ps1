param(
  [string]$BaseUrl = $(if ($env:CHAT_UI_BASE_URL) { $env:CHAT_UI_BASE_URL } else { 'http://192.168.0.39:3456' }),
  [string]$Session = 'codex-chat-production-ui'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$tokenCode = @'
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH, { readonly: true });
const users = db.prepare("SELECT id,role,email FROM users WHERE role=? AND status=? ORDER BY created_at").all('user', 'active');
const user = users.find(item => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(item.email || '')));
if (!user) process.exit(2);
process.stdout.write(jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '5m' }));
'@
$tokenCodeBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($tokenCode))
$runnerCode = 'eval(Buffer.from(process.env.CODE_B64,process.env.ENC).toString())'
$userToken = docker exec -e CODE_B64=$tokenCodeBase64 -e ENC=base64 dianshang-internal-app node -e $runnerCode
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($userToken)) {
  throw 'Unable to create a short-lived token for an existing Chat user.'
}

$baseUrlNormalized = $BaseUrl.TrimEnd('/')
$openArguments = @('--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', $Session, 'open', "$baseUrlNormalized/")
& npx.cmd @openArguments
if ($LASTEXITCODE -ne 0) { throw 'Could not open the isolated Chat production browser.' }

$tokenLiteral = $userToken.Replace('\', '\\').Replace("'", "\'")
$injectCode = "async page => { await page.evaluate(token => { localStorage.setItem('auth_token', token); sessionStorage.removeItem('hjm-librechat-sso-attempt'); }, '$tokenLiteral'); }"
$injectRunner = [IO.Path]::GetTempFileName()
try {
  [IO.File]::WriteAllText($injectRunner, $injectCode, [Text.UTF8Encoding]::new($false))
  $injectArguments = @('--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', $Session, 'run-code', '--filename', $injectRunner)
  $injectOutput = @(& npx.cmd @injectArguments 2>&1)
  if ($LASTEXITCODE -ne 0 -or ($injectOutput -join "`n") -match '### Error') {
    throw 'Could not install the short-lived main-site session in the isolated browser.'
  }
} finally {
  Remove-Item -LiteralPath $injectRunner -Force -ErrorAction SilentlyContinue
}

$runner = Join-Path $PSScriptRoot 'smoke-chat-production-ui-runner.js'
$runArguments = @('--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', $Session, 'run-code', '--filename', $runner)
$runOutput = @(& npx.cmd @runArguments 2>&1)
if ($LASTEXITCODE -ne 0 -or ($runOutput -join "`n") -match '### Error') {
  throw "Chat production browser smoke failed.`n$($runOutput -join "`n")"
}

$verifyArguments = @('--yes', '--package', '@playwright/cli', 'playwright-cli', '--session', $Session, 'eval', 'document.body.dataset.chatProductionUiSmoke')
$verifyOutput = @(& npx.cmd @verifyArguments 2>&1)
if ($LASTEXITCODE -ne 0 -or ($verifyOutput -join "`n") -notmatch 'done') {
  throw 'Chat production browser smoke marker was not set.'
}

Write-Host "Chat production UI smoke passed: $baseUrlNormalized"
