$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

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

  $emptyMarker = Join-Path $backupDir "$([System.IO.Path]::GetFileName($SourcePath))-empty.txt"
  [System.IO.File]::WriteAllText($emptyMarker, "empty $SourcePath directory`n", [System.Text.UTF8Encoding]::new($false))
  Compress-Archive -LiteralPath $emptyMarker -DestinationPath $DestinationPath -Force
  Remove-Item -LiteralPath $emptyMarker -Force
}

$containerBackupDir = "/app/data/backups/internal-prod-$timestamp"
$containerDbBackup = "$containerBackupDir/data.db"
$backupScript = @"
const fs = require('fs');
const Database = require('better-sqlite3');
async function main() {
  fs.mkdirSync('$containerBackupDir', { recursive: true });
  const db = new Database('/app/data/data.db', { readonly: true });
  try {
    await db.backup('$containerDbBackup');
  } finally {
    db.close();
  }
}
main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

Invoke-Docker -Step "sqlite-backup" -Arguments @("exec", $containerName, "node", "-e", $backupScript)

$hostDbBackup = Join-Path $dockerDir "data\backups\internal-prod-$timestamp\data.db"
if (-not (Test-Path $hostDbBackup)) {
  throw "SQLite backup file was not created: $hostDbBackup"
}
Copy-Item -LiteralPath $hostDbBackup -Destination (Join-Path $databaseDir "data.db") -Force

$itemsToArchive = @(
  @{ Name = "data"; Path = Join-Path $dockerDir "data"; ExcludeNames = @("data.db", "data.db-shm", "data.db-wal", "backups") },
  @{ Name = "uploads"; Path = Join-Path $dockerDir "uploads"; ExcludeNames = @() },
  @{ Name = "logs"; Path = Join-Path $dockerDir "logs"; ExcludeNames = @() }
)

foreach ($item in $itemsToArchive) {
  if (Test-Path $item.Path) {
    $zipPath = Join-Path $archiveDir "$($item.Name).zip"
    Compress-DirectoryContents -SourcePath $item.Path -DestinationPath $zipPath -ExcludeNames $item.ExcludeNames
  }
}

$manifest = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  container = $containerName
  backupDir = $backupDir
  databaseBackup = (Join-Path $databaseDir "data.db")
  archives = Get-ChildItem -Path $archiveDir -Filter "*.zip" | Select-Object -ExpandProperty FullName
  note = "SQLite database was copied using better-sqlite3 backup inside the running container."
}
$manifestJson = $manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $backupDir "manifest.json"), $manifestJson + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host "Internal production backup completed: $backupDir"
