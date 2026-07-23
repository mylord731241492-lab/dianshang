param(
  [string]$DestinationRoot
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $DestinationRoot) {
  $DestinationRoot = Join-Path $repoRoot "output\releases"
}
$destinationFull = [System.IO.Path]::GetFullPath($DestinationRoot)
New-Item -ItemType Directory -Force -Path $destinationFull | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipPath = Join-Path $destinationFull "dianshang-source-$timestamp.zip"
if (Test-Path -LiteralPath $zipPath) {
  throw "Source package already exists: $zipPath"
}

function Test-ExcludedSourcePath {
  param([Parameter(Mandatory=$true)][string]$RelativePath)

  $normalized = $RelativePath.Replace('\', '/')
  $leaf = [System.IO.Path]::GetFileName($normalized)
  if ($normalized -match "(^|/)(\.git|\.codegraph|\.playwright-cli|\.scratch|node_modules|dist|build|coverage|tmp|temp|\.cache)(/|$)") {
    return $true
  }
  if ($normalized -match "^(output|outputs)(/|$)") {
    return $true
  }
  if ($normalized -match "^docker/(data|uploads|logs|backup)(/|$)") {
    return $true
  }
  if ($normalized -match "^(uploads|logs)(/|$)") {
    return $true
  }
  if ($leaf -eq ".env" -or ($leaf.StartsWith(".env.") -and -not $leaf.EndsWith(".example"))) {
    return $true
  }
  if ($leaf -eq ".local-server.pid" -or $leaf -match "^data\.db($|[.-])" -or $leaf -match "\.(sqlite|sqlite3)$") {
    return $true
  }
  return $false
}

$files = @(
  Get-ChildItem -LiteralPath $repoRoot -File -Recurse -Force | Where-Object {
    $relative = $_.FullName.Substring($repoRoot.Length).TrimStart('\', '/')
    -not (Test-ExcludedSourcePath -RelativePath $relative)
  } | Sort-Object FullName
)
if (-not $files.Count) {
  throw "No source files were selected for packaging."
}

$head = (& git -C $repoRoot rev-parse HEAD 2>$null | Select-Object -Last 1)
if ($LASTEXITCODE -ne 0 -or -not $head) { $head = "unknown" }
$dirty = [bool](& git -C $repoRoot status --porcelain 2>$null | Select-Object -First 1)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = $null
try {
  $archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  $manifestFiles = [System.Collections.Generic.List[object]]::new()

  foreach ($file in $files) {
    $relative = $file.FullName.Substring($repoRoot.Length).TrimStart('\', '/').Replace('\', '/')
    $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
    $sourceStream = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $entryStream = $entry.Open()
    try {
      $sourceStream.CopyTo($entryStream)
    } finally {
      $entryStream.Dispose()
      $sourceStream.Dispose()
    }
    $manifestFiles.Add([pscustomobject]@{
      path = $relative
      bytes = [long]$file.Length
      sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    })
  }

  $manifest = [ordered]@{
    formatVersion = 1
    packageType = "dianshang-source"
    createdAt = (Get-Date).ToString("o")
    sourceHead = ([string]$head).Trim()
    workingTreeDirty = $dirty
    excludes = @(
      "private environment files",
      "SQLite databases",
      "Docker persistent data and backups",
      "node_modules and build outputs",
      "Git and local tool caches"
    )
    files = $manifestFiles
  }
  $manifestJson = $manifest | ConvertTo-Json -Depth 6
  $manifestEntry = $archive.CreateEntry("release-manifest.json", [System.IO.Compression.CompressionLevel]::Optimal)
  $manifestStream = $manifestEntry.Open()
  $writer = [System.IO.StreamWriter]::new($manifestStream, [System.Text.UTF8Encoding]::new($false))
  try {
    $writer.Write($manifestJson)
    $writer.Write("`n")
  } finally {
    $writer.Dispose()
  }
} catch {
  if ($archive) { $archive.Dispose(); $archive = $null }
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  throw
} finally {
  if ($archive) { $archive.Dispose() }
}

$result = [ordered]@{
  success = $true
  zipPath = $zipPath
  bytes = (Get-Item -LiteralPath $zipPath).Length
  fileCount = $files.Count
  sha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  sourceHead = ([string]$head).Trim()
  workingTreeDirty = $dirty
}
$result | ConvertTo-Json -Compress
