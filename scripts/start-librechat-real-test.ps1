param(
  [int]$Port = 3464,
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$composeFile = Join-Path $root 'docker\docker-compose.chat-test.yml'
$envFile = Join-Path $root '.env'
$databaseFile = Join-Path $root 'data.db'

if (-not (Test-Path $envFile)) { throw 'Missing root .env file.' }
if (-not (Test-Path $databaseFile)) { throw 'Missing root data.db file.' }

$routeJson = @'
const Database = require('better-sqlite3');
const db = new Database(process.argv[2], { readonly: true });
const row = db.prepare("SELECT value FROM app_state WHERE key='admin.apiProviders'").get();
const routes = row ? JSON.parse(row.value) : [];
const route = routes.find(item => String(item.cat || item.g || item.group || '').toLowerCase() === 'text' && String(item.apiKey || '').trim().length >= 12);
if (!route || !route.baseUrl || !route.apiKey) process.exit(2);
process.stdout.write(JSON.stringify({ base: route.baseUrl, key: route.apiKey }));
'@ | node - $databaseFile

if ($LASTEXITCODE -ne 0 -or -not $routeJson) { throw 'No configured text provider route was found in data.db.' }
$route = $routeJson | ConvertFrom-Json

$env:AI_PROVIDER_GATEWAY = 'legacy'
$env:AI_API_BASE = [string]$route.base
$env:AI_TEXT_KEY = [string]$route.key
$env:CHAT_TEST_GATEWAY_PORT = [string]$Port
$env:CHAT_TEST_PUBLIC_ORIGIN = "http://127.0.0.1:$Port"
$env:CHAT_TEST_ENABLE_REAL_AI = 'true'

if ($Build) {
  docker compose --env-file $envFile -f $composeFile build app
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

docker compose --env-file $envFile -f $composeFile up -d chat-mongodb librechat
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose --env-file $envFile -f $composeFile up -d --force-recreate --no-deps app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$deadline = (Get-Date).AddMinutes(2)
do {
  Start-Sleep -Seconds 3
  $health = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 'dianshang-chat-test-app-1'
  Write-Host "app-health=$health"
} while ($health -ne 'healthy' -and (Get-Date) -lt $deadline)
if ($health -ne 'healthy') { throw 'Test app did not become healthy.' }

docker compose --env-file $envFile -f $composeFile up -d --force-recreate --no-deps gateway
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Real Chat test stack is running at http://127.0.0.1:$Port"
