param(
  [Parameter(Mandatory=$true)][string]$PackagePath,
  [Parameter(Mandatory=$true)][string]$TargetDockerDir,
  [switch]$ConfirmEmptyTargetRestore,
  [switch]$AllowEnvironmentFileChange,
  [switch]$StartApp
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

if (-not $ConfirmEmptyTargetRestore) {
  throw "Restore requires empty persistent directories. Re-run with -ConfirmEmptyTargetRestore after checking the target path."
}

function Get-FullPath {
  param([Parameter(Mandatory=$true)][string]$Path)
  return [System.IO.Path]::GetFullPath($Path)
}

function Assert-PathInside {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][string]$Child
  )
  $rootFull = (Get-FullPath -Path $Root).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $childFull = Get-FullPath -Path $Child
  if (-not $childFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escapes the allowed root: $childFull"
  }
  return $childFull
}

function Assert-DirectoryEmpty {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }
  $firstItem = Get-ChildItem -LiteralPath $Path -Force | Select-Object -First 1
  if ($null -ne $firstItem) {
    throw "Target persistent directory is not empty; restore refused: $Path"
  }
}

function Expand-VerifiedArchive {
  param(
    [Parameter(Mandatory=$true)][string]$ArchivePath,
    [Parameter(Mandatory=$true)][string]$DestinationPath
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
  $destinationRoot = (Get-FullPath -Path $DestinationPath).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    foreach ($entry in $archive.Entries) {
      $entryPath = $entry.FullName.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      if ([System.IO.Path]::IsPathRooted($entryPath)) {
        throw "Archive contains an absolute path: $($entry.FullName)"
      }
      $destination = Get-FullPath -Path (Join-Path $DestinationPath $entryPath)
      if (-not $destination.StartsWith($destinationRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Archive entry escapes the target directory: $($entry.FullName)"
      }
    }
  } finally {
    $archive.Dispose()
  }

  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $DestinationPath -Force
  Get-ChildItem -LiteralPath $DestinationPath -Recurse -Force -Filter "__dianshang_empty__" |
    Remove-Item -Force
}

function Copy-DirectoryContents {
  param(
    [Parameter(Mandatory=$true)][string]$SourcePath,
    [Parameter(Mandatory=$true)][string]$DestinationPath
  )
  New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
  Get-ChildItem -LiteralPath $SourcePath -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $DestinationPath -Recurse
  }
}

function Wait-ContainerHealthy {
  param(
    [Parameter(Mandatory=$true)][string]$ContainerName,
    [int]$TimeoutSeconds = 180
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $status = (& docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $ContainerName | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to inspect the restored container: $ContainerName"
    }
    if ($status -eq "healthy" -or $status -eq "running") {
      return $status
    }
    if ($status -eq "unhealthy" -or $status -eq "exited" -or $status -eq "dead") {
      throw "Restored container entered a terminal state: $status"
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Restored container did not become healthy within $TimeoutSeconds seconds."
}

$packageRoot = (Resolve-Path -LiteralPath $PackagePath).Path
$targetRoot = (Resolve-Path -LiteralPath $TargetDockerDir).Path
$manifestTool = Join-Path $PSScriptRoot "portable-migration-manifest.js"
$manifestPath = Join-Path $packageRoot "manifest.json"
$composePath = Join-Path $targetRoot "docker-compose.yml"
$environmentPath = Join-Path $targetRoot ".env"

if (-not (Test-Path -LiteralPath $composePath)) {
  throw "Target source directory is missing docker-compose.yml: $composePath"
}
if (-not (Test-Path -LiteralPath $environmentPath)) {
  throw "Target source directory is missing the separately copied docker/.env: $environmentPath"
}

function Get-DockerVerifierImage {
  if ($script:dockerVerifierImage) {
    return $script:dockerVerifierImage
  }

  & docker compose -f $composePath build app | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to build the Docker verifier image."
  }
  $imageOutput = & docker compose -f $composePath images -q app
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect the Docker verifier image after build."
  }
  $image = [string]($imageOutput | Select-Object -Last 1)
  $image = $image.Trim()
  if (-not $image) {
    throw "Docker verifier image ID is empty."
  }
  $script:dockerVerifierImage = $image
  return $image
}

function Invoke-PackageVerification {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $output = & node $manifestTool "verify" $Path
  } else {
    $image = Get-DockerVerifierImage
    $mount = "type=bind,source=$Path,target=/migration,readonly"
    $output = & docker run --rm --entrypoint node --mount $mount $image "/app/scripts/portable-migration-manifest.js" "verify" "/migration"
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Migration package integrity verification failed."
  }
  return @($output)
}

function Invoke-SqliteVerification {
  param([Parameter(Mandatory=$true)][string]$DatabasePath)
  if (Get-Command node -ErrorAction SilentlyContinue) {
    & node $manifestTool "verify-sqlite" $DatabasePath | Out-Null
  } else {
    $image = Get-DockerVerifierImage
    $databaseDirectory = [System.IO.Path]::GetDirectoryName((Get-FullPath -Path $DatabasePath))
    $databaseName = [System.IO.Path]::GetFileName($DatabasePath)
    $mount = "type=bind,source=$databaseDirectory,target=/restore-db,readonly"
    & docker run --rm --entrypoint node --mount $mount $image "/app/scripts/portable-migration-manifest.js" "verify-sqlite" "/restore-db/$databaseName" | Out-Null
  }
  if ($LASTEXITCODE -ne 0) {
    throw "SQLite integrity verification failed: $DatabasePath"
  }
}

$verifiedOutput = Invoke-PackageVerification -Path $packageRoot
$verifiedManifest = ($verifiedOutput | Select-Object -Last 1) | ConvertFrom-Json
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

$actualEnvironmentHash = (Get-FileHash -LiteralPath $environmentPath -Algorithm SHA256).Hash.ToLowerInvariant()
$expectedEnvironmentHash = [string]$verifiedManifest.environmentFile.sha256
if ($actualEnvironmentHash -ne $expectedEnvironmentHash) {
  if (-not $AllowEnvironmentFileChange) {
    throw "Target docker/.env fingerprint differs from the backup. Copy the original file first, or review secret compatibility and use -AllowEnvironmentFileChange explicitly."
  }
  Write-Warning "Target docker/.env changed. Ensure JWT_SECRET, password migration secrets, and provider settings remain compatible."
}

$targetData = Join-Path $targetRoot "data"
$targetUploads = Join-Path $targetRoot "uploads"
$targetLogs = Join-Path $targetRoot "logs"
Assert-DirectoryEmpty -Path $targetData
Assert-DirectoryEmpty -Path $targetUploads
Assert-DirectoryEmpty -Path $targetLogs

$stagePath = Join-Path $targetRoot ".migration-restore-stage-$([System.Guid]::NewGuid().ToString('N'))"
$stagePath = Assert-PathInside -Root $targetRoot -Child $stagePath
$stageData = Join-Path $stagePath "data"
$stageUploads = Join-Path $stagePath "uploads"
$stageLogs = Join-Path $stagePath "logs"

function Get-ArtifactPath {
  param([Parameter(Mandatory=$true)][string]$Name)
  $artifact = $manifest.artifacts | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($null -eq $artifact) {
    throw "Migration package is missing artifact: $Name"
  }
  return Join-Path $packageRoot ([string]$artifact.relativePath)
}

try {
  New-Item -ItemType Directory -Force -Path $stageData, $stageUploads, $stageLogs | Out-Null
  Expand-VerifiedArchive -ArchivePath (Get-ArtifactPath -Name "data") -DestinationPath $stageData
  Expand-VerifiedArchive -ArchivePath (Get-ArtifactPath -Name "uploads") -DestinationPath $stageUploads
  Expand-VerifiedArchive -ArchivePath (Get-ArtifactPath -Name "logs") -DestinationPath $stageLogs
  Copy-Item -LiteralPath (Get-ArtifactPath -Name "database") -Destination (Join-Path $stageData "data.db")

  Invoke-SqliteVerification -DatabasePath (Join-Path $stageData "data.db")

  Assert-DirectoryEmpty -Path $targetData
  Assert-DirectoryEmpty -Path $targetUploads
  Assert-DirectoryEmpty -Path $targetLogs
  Copy-DirectoryContents -SourcePath $stageData -DestinationPath $targetData
  Copy-DirectoryContents -SourcePath $stageUploads -DestinationPath $targetUploads
  Copy-DirectoryContents -SourcePath $stageLogs -DestinationPath $targetLogs

  $restoredDatabase = Join-Path $targetData "data.db"
  $databaseArtifact = $manifest.artifacts | Where-Object { $_.name -eq "database" } | Select-Object -First 1
  $restoredDatabaseHash = (Get-FileHash -LiteralPath $restoredDatabase -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($restoredDatabaseHash -ne [string]$databaseArtifact.sha256) {
    throw "Restored database SHA-256 does not match the migration package."
  }
  Invoke-SqliteVerification -DatabasePath $restoredDatabase
} finally {
  if (Test-Path -LiteralPath $stagePath) {
    $verifiedStagePath = Assert-PathInside -Root $targetRoot -Child $stagePath
    Remove-Item -LiteralPath $verifiedStagePath -Recurse -Force
  }
}

$containerStatus = "not-started"
if ($StartApp) {
  & docker compose -f $composePath up -d --build --force-recreate app
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose build or start failed. Data is already restored; fix configuration and start without restoring again."
  }
  $containerName = if ($manifest.source.container) { [string]$manifest.source.container } else { "dianshang-internal-app" }
  $containerStatus = Wait-ContainerHealthy -ContainerName $containerName
}

Write-Host "Windows Docker data restore completed: $targetRoot"
Write-Host "SQLite quick_check / integrity_check: ok"
Write-Host "Container status: $containerStatus"
