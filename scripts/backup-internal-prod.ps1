param(
  [switch]$ConfirmMaintenanceWindow
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

if (-not $ConfirmMaintenanceWindow) {
  throw "This backup requires a short app maintenance window. Re-run with -ConfirmMaintenanceWindow after approval."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$dockerDir = Join-Path $repoRoot "docker"
$containerName = $env:INTERNAL_PROD_CONTAINER
if (-not $containerName) {
  $containerName = "dianshang-internal-app"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $dockerDir "backup"
$backupDir = Join-Path $backupRoot "internal-prod-$timestamp"
$databaseDir = Join-Path $backupDir "database"
$archiveDir = Join-Path $backupDir "archives"
New-Item -ItemType Directory -Force -Path $databaseDir, $archiveDir | Out-Null

function Invoke-Docker {
  param(
    [Parameter(Mandatory=$true)][string[]]$Arguments,
    [Parameter(Mandatory=$true)][string]$Step
  )
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $Step failed with exit code $LASTEXITCODE"
  }
}

function Get-DockerOutput {
  param(
    [Parameter(Mandatory=$true)][string[]]$Arguments,
    [Parameter(Mandatory=$true)][string]$Step
  )
  $output = & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker $Step failed with exit code $LASTEXITCODE"
  }
  return @($output)
}

function Wait-ContainerHealthy {
  param(
    [Parameter(Mandatory=$true)][string]$ContainerName,
    [int]$TimeoutSeconds = 120
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $status = (Get-DockerOutput -Step "inspect-health" -Arguments @(
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      $ContainerName
    ) | Select-Object -Last 1).Trim()
    if ($status -eq "healthy" -or $status -eq "running") {
      return $status
    }
    if ($status -eq "unhealthy" -or $status -eq "exited" -or $status -eq "dead") {
      throw "Container $ContainerName entered terminal state: $status"
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Container $ContainerName did not become healthy within $TimeoutSeconds seconds"
}

function Compress-DirectoryContents {
  param(
    [Parameter(Mandatory=$true)][string]$SourcePath,
    [Parameter(Mandatory=$true)][string]$DestinationPath,
    [string[]]$ExcludeNames = @()
  )

  if (Test-Path $DestinationPath) {
    Remove-Item -LiteralPath $DestinationPath -Force
  }

  $children = @(Get-ChildItem -LiteralPath $SourcePath -Force | Where-Object {
    $ExcludeNames -notcontains $_.Name
  })

  if ($children.Count) {
    Compress-Archive -LiteralPath ($children | Select-Object -ExpandProperty FullName) -DestinationPath $DestinationPath -Force
    return
  }

  $emptyMarker = Join-Path $backupDir "__dianshang_empty__"
  [System.IO.File]::WriteAllText($emptyMarker, "empty $SourcePath directory`n", [System.Text.UTF8Encoding]::new($false))
  Compress-Archive -LiteralPath $emptyMarker -DestinationPath $DestinationPath -Force
  Remove-Item -LiteralPath $emptyMarker -Force
}

$sourceDatabase = Join-Path $dockerDir "data\data.db"
$databaseBackup = Join-Path $databaseDir "data.db"
if (-not (Test-Path -LiteralPath $sourceDatabase)) {
  throw "Production SQLite database was not found: $sourceDatabase"
}

$runningState = (Get-DockerOutput -Step "inspect-running" -Arguments @(
  "inspect",
  "--format",
  "{{.State.Running}}",
  $containerName
) | Select-Object -Last 1).Trim()
$wasRunning = $runningState -eq "true"
$maintenanceStartedAt = $null
$maintenanceEndedAt = $null
$restoredContainerStatus = if ($wasRunning) { "pending" } else { "not-running-before-backup" }
$verification = $null

$oldBackupSourceDb = $env:BACKUP_SOURCE_DB
$oldBackupDestinationDb = $env:BACKUP_DESTINATION_DB
try {
  if ($wasRunning) {
    $maintenanceStartedAt = (Get-Date).ToString("o")
    Invoke-Docker -Step "stop-for-consistent-backup" -Arguments @("stop", "--timeout", "20", $containerName)
  }

  $env:BACKUP_SOURCE_DB = $sourceDatabase
  $env:BACKUP_DESTINATION_DB = $databaseBackup
  $verificationJson = & node (Join-Path $PSScriptRoot "backup-sqlite.js")
  if ($LASTEXITCODE -ne 0) {
    throw "SQLite maintenance backup failed with exit code $LASTEXITCODE"
  }
  $verification = ($verificationJson | Select-Object -Last 1) | ConvertFrom-Json

  if (-not (Test-Path -LiteralPath $databaseBackup)) {
    throw "SQLite backup file was not created: $databaseBackup"
  }

  $itemsToArchive = @(
    @{ Name = "data"; Path = Join-Path $dockerDir "data"; ExcludeNames = @("data.db", "data.db-shm", "data.db-wal", "backups") },
    @{ Name = "uploads"; Path = Join-Path $dockerDir "uploads"; ExcludeNames = @() },
    @{ Name = "logs"; Path = Join-Path $dockerDir "logs"; ExcludeNames = @() }
  )

  foreach ($item in $itemsToArchive) {
    if (-not (Test-Path -LiteralPath $item.Path)) {
      New-Item -ItemType Directory -Force -Path $item.Path | Out-Null
    }
    $zipPath = Join-Path $archiveDir "$($item.Name).zip"
    Compress-DirectoryContents -SourcePath $item.Path -DestinationPath $zipPath -ExcludeNames $item.ExcludeNames
  }
} finally {
  if ($null -eq $oldBackupSourceDb) { Remove-Item Env:\BACKUP_SOURCE_DB -ErrorAction SilentlyContinue } else { $env:BACKUP_SOURCE_DB = $oldBackupSourceDb }
  if ($null -eq $oldBackupDestinationDb) { Remove-Item Env:\BACKUP_DESTINATION_DB -ErrorAction SilentlyContinue } else { $env:BACKUP_DESTINATION_DB = $oldBackupDestinationDb }
  if ($wasRunning) {
    Invoke-Docker -Step "restart-after-backup" -Arguments @("start", $containerName)
    $restoredContainerStatus = Wait-ContainerHealthy -ContainerName $containerName
    $maintenanceEndedAt = (Get-Date).ToString("o")
  }
}

$metadata = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  container = $containerName
  databaseVerification = $verification
  sourceLayout = [ordered]@{
    database = "docker/data/data.db"
    uploads = "docker/uploads"
    workflows = "docker/data/workflows"
    logs = "docker/logs"
  }
  maintenanceWindow = [ordered]@{
    required = $true
    containerWasRunning = $wasRunning
    startedAt = $maintenanceStartedAt
    endedAt = $maintenanceEndedAt
    restoredContainerStatus = $restoredContainerStatus
  }
  note = "Portable Windows Docker data package. Copy the source tree and the exact docker/.env separately; restore only into empty persistent directories."
}
$metadataPath = Join-Path $backupDir ".manifest-metadata.json"
$metadataJson = $metadata | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($metadataPath, $metadataJson + "`n", [System.Text.UTF8Encoding]::new($false))
try {
  $manifestOutput = & node (Join-Path $PSScriptRoot "portable-migration-manifest.js") "create" $backupDir $metadataPath (Join-Path $dockerDir ".env")
  if ($LASTEXITCODE -ne 0) {
    throw "Portable migration manifest creation failed with exit code $LASTEXITCODE"
  }
  $manifestOutput | Select-Object -Last 1 | ConvertFrom-Json | Out-Null
} finally {
  Remove-Item -LiteralPath $metadataPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Internal production portable backup completed: $backupDir"
