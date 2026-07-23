$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dianshang-migration-test-$([System.Guid]::NewGuid().ToString('N'))"
$packagePath = Join-Path $testRoot "package"
$targetDockerDir = Join-Path $testRoot "target\docker"
$mismatchedEnvironmentDockerDir = Join-Path $testRoot "target-env-mismatch\docker"
$tamperedPackagePath = Join-Path $testRoot "tampered-package"
$manifestTool = Join-Path $PSScriptRoot "portable-migration-manifest.js"
$restoreScript = Join-Path $PSScriptRoot "restore-internal-prod-windows.ps1"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Get-NormalizedFullPath {
  param([Parameter(Mandatory=$true)][string]$Path)
  return [System.IO.Path]::GetFullPath($Path)
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Assert-Equal {
  param(
    [Parameter(Mandatory=$true)]$Actual,
    [Parameter(Mandatory=$true)]$Expected,
    [Parameter(Mandatory=$true)][string]$Message
  )
  if ($Actual -ne $Expected) {
    throw "$Message; actual=$Actual, expected=$Expected"
  }
}

try {
  $fixtureDirectories = @(
    (Join-Path $packagePath "database"),
    (Join-Path $packagePath "archives"),
    (Join-Path $testRoot "source-data\workflows"),
    (Join-Path $testRoot "source-uploads\generated"),
    (Join-Path $testRoot "source-logs"),
    $targetDockerDir,
    $mismatchedEnvironmentDockerDir
  )
  New-Item -ItemType Directory -Force -Path $fixtureDirectories | Out-Null

  $databasePath = Join-Path $packagePath "database\data.db"
  $createDatabaseScript = @'
const Database = require('better-sqlite3');
const database = new Database(process.argv[1]);
database.exec('CREATE TABLE migration_fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
const insert = database.prepare('INSERT INTO migration_fixture (value) VALUES (?)');
for (const value of ['alpha', 'beta', 'gamma']) insert.run(value);
database.close();
'@
  & node -e $createDatabaseScript $databasePath
  if ($LASTEXITCODE -ne 0) { throw "Unable to create the migration fixture database." }

  $workflowSource = Join-Path $testRoot "source-data\workflows\sample.json"
  $uploadSource = Join-Path $testRoot "source-uploads\generated\sample.png"
  $logSource = Join-Path $testRoot "source-logs\app.log"
  Write-Utf8NoBom -Path $workflowSource -Content '{"nodes":[{"id":"fixture"}]}'
  [System.IO.File]::WriteAllBytes($uploadSource, [byte[]](137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4))
  Write-Utf8NoBom -Path $logSource -Content "migration fixture log`n"

  Compress-Archive -LiteralPath (Join-Path $testRoot "source-data\workflows") -DestinationPath (Join-Path $packagePath "archives\data.zip")
  Compress-Archive -LiteralPath (Join-Path $testRoot "source-uploads\generated") -DestinationPath (Join-Path $packagePath "archives\uploads.zip")
  Compress-Archive -LiteralPath $logSource -DestinationPath (Join-Path $packagePath "archives\logs.zip")

  $environmentPath = Join-Path $testRoot "source.env"
  Write-Utf8NoBom -Path $environmentPath -Content "JWT_SECRET=migration-fixture-secret-with-more-than-32-characters`nHOST_PORT=3456`n"
  Write-Utf8NoBom -Path (Join-Path $targetDockerDir ".env") -Content ([System.IO.File]::ReadAllText($environmentPath, [System.Text.Encoding]::UTF8))
  Write-Utf8NoBom -Path (Join-Path $targetDockerDir "docker-compose.yml") -Content "services:`n  app:`n    image: migration-fixture`n"

  $metadataPath = Join-Path $testRoot "metadata.json"
  $metadata = [ordered]@{
    createdAt = (Get-Date).ToString("o")
    container = "dianshang-internal-app"
    maintenanceWindow = [ordered]@{ required = $true; containerWasRunning = $false }
    note = "Windows Docker migration fixture"
  } | ConvertTo-Json -Depth 5
  Write-Utf8NoBom -Path $metadataPath -Content ($metadata + "`n")

  & node $manifestTool "create" $packagePath $metadataPath $environmentPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Unable to create the migration fixture manifest." }
  & node $manifestTool "verify" $packagePath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Initial migration fixture verification failed." }

  Copy-Item -LiteralPath (Join-Path $targetDockerDir "docker-compose.yml") -Destination (Join-Path $mismatchedEnvironmentDockerDir "docker-compose.yml")
  Write-Utf8NoBom -Path (Join-Path $mismatchedEnvironmentDockerDir ".env") -Content "JWT_SECRET=different-migration-fixture-secret-with-more-than-32-characters"
  $environmentMismatchRejected = $false
  try {
    & $restoreScript -PackagePath $packagePath -TargetDockerDir $mismatchedEnvironmentDockerDir -ConfirmEmptyTargetRestore
  } catch {
    $environmentMismatchRejected = $_.Exception.Message -match "fingerprint differs"
  }
  if (-not $environmentMismatchRejected) {
    throw "Environment fingerprint mismatch was not rejected."
  }
  if (Test-Path -LiteralPath (Join-Path $mismatchedEnvironmentDockerDir "data")) {
    throw "Environment mismatch wrote data before being rejected."
  }

  & $restoreScript -PackagePath $packagePath -TargetDockerDir $targetDockerDir -ConfirmEmptyTargetRestore

  $readDatabaseScript = @'
const Database = require('better-sqlite3');
const database = new Database(process.argv[1], { readonly: true });
process.stdout.write(String(database.prepare('SELECT COUNT(*) AS count FROM migration_fixture').get().count));
database.close();
'@
  $restoredCount = & node -e $readDatabaseScript (Join-Path $targetDockerDir "data\data.db")
  if ($LASTEXITCODE -ne 0) { throw "Unable to read the restored migration fixture database." }
  Assert-Equal -Actual ([int]$restoredCount) -Expected 3 -Message "Restored database row count mismatch"
  Assert-Equal -Actual (Get-Content -LiteralPath (Join-Path $targetDockerDir "data\workflows\sample.json") -Raw -Encoding UTF8) -Expected '{"nodes":[{"id":"fixture"}]}' -Message "Workflow file content mismatch"
  Assert-Equal -Actual (Get-FileHash -LiteralPath (Join-Path $targetDockerDir "uploads\generated\sample.png") -Algorithm SHA256).Hash -Expected (Get-FileHash -LiteralPath $uploadSource -Algorithm SHA256).Hash -Message "Uploaded image hash mismatch"
  Assert-Equal -Actual (Get-Content -LiteralPath (Join-Path $targetDockerDir "logs\app.log") -Raw -Encoding UTF8) -Expected "migration fixture log`n" -Message "Log file content mismatch"

  $duplicateRestoreRejected = $false
  try {
    & $restoreScript -PackagePath $packagePath -TargetDockerDir $targetDockerDir -ConfirmEmptyTargetRestore
  } catch {
    $duplicateRestoreRejected = $_.Exception.Message -match "not empty"
  }
  if (-not $duplicateRestoreRejected) {
    throw "Duplicate restore was not rejected by the empty-target guard."
  }

  Copy-Item -LiteralPath $packagePath -Destination $tamperedPackagePath -Recurse
  $tamperedArchive = Join-Path $tamperedPackagePath "archives\uploads.zip"
  $stream = [System.IO.File]::Open($tamperedArchive, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $stream.WriteByte(255)
  } finally {
    $stream.Dispose()
  }
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & node $manifestTool "verify" $tamperedPackagePath 2>&1 | Out-Null
    $tamperedVerificationExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($tamperedVerificationExitCode -eq 0) {
    throw "Tampered migration package was not rejected by the SHA-256 guard."
  }

  Write-Host "Windows Docker migration drill passed: database, workflow, image, log, environment guard, duplicate-restore guard, and tamper guard."
} finally {
  $tempRoot = (Get-NormalizedFullPath -Path ([System.IO.Path]::GetTempPath())).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $testRootFull = Get-NormalizedFullPath -Path $testRoot
  if (
    (Test-Path -LiteralPath $testRootFull) -and
    $testRootFull.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
    ([System.IO.Path]::GetFileName($testRootFull) -like "dianshang-migration-test-*")
  ) {
    Remove-Item -LiteralPath $testRootFull -Recurse -Force
  }
}
