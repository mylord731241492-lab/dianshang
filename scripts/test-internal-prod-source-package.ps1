$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageScript = Join-Path $PSScriptRoot "package-internal-prod-source.ps1"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dianshang-source-package-test-$([System.Guid]::NewGuid().ToString('N'))"
$outputRoot = Join-Path $testRoot "releases"

function Assert-True {
  param(
    [Parameter(Mandatory=$true)][bool]$Condition,
    [Parameter(Mandatory=$true)][string]$Message
  )
  if (-not $Condition) { throw $Message }
}

function Get-StreamSha256 {
  param([Parameter(Mandatory=$true)][System.IO.Stream]$Stream)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash($Stream)
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

try {
  New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
  $resultJson = & $packageScript -DestinationRoot $outputRoot | Select-Object -Last 1
  if ([string]::IsNullOrWhiteSpace([string]$resultJson)) { throw "Source package script returned no result." }
  $result = $resultJson | ConvertFrom-Json
  $zipPath = [string]$result.zipPath
  Assert-True -Condition (Test-Path -LiteralPath $zipPath) -Message "Source package ZIP was not created."

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entries = @($archive.Entries | Where-Object { -not [string]::IsNullOrEmpty($_.Name) })
    $names = @($entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    $required = @(
      "server.js",
      "Dockerfile",
      ".dockerignore",
      "package-lock.json",
      "frontend/package-lock.json",
      "frontend/src/router/index.ts",
      "docker/docker-compose.yml",
      "docker/docker-compose.chat-production.yml",
      "docker/docker-compose.server-direct.yml",
      "integrations/librechat/upstream/LibreChat-0.8.6-rc1.tar.gz",
      "scripts/restore-internal-prod-windows.ps1",
      "release-manifest.json"
    )
    foreach ($name in $required) {
      Assert-True -Condition ($names -contains $name) -Message "Source package is missing required file: $name"
    }

    foreach ($name in $names) {
      $leaf = [System.IO.Path]::GetFileName($name)
      $containsPrivateEnv = $leaf -eq ".env" -or ($leaf.StartsWith(".env.") -and -not $leaf.EndsWith(".example"))
      Assert-True -Condition (-not $containsPrivateEnv) -Message "Source package contains a private environment file: $name"
      Assert-True -Condition ($name -notmatch "(^|/)(node_modules|dist|coverage|\.git|\.codegraph|\.scratch)(/|$)") -Message "Source package contains excluded build/cache content: $name"
      Assert-True -Condition ($name -notmatch "^docker/(data|uploads|logs|backup)(/|$)") -Message "Source package contains persistent Docker data: $name"
      Assert-True -Condition ($name -notmatch "(^|/)(data\.db($|[.-])|[^/]+\.(sqlite|sqlite3)$)") -Message "Source package contains a database file: $name"
    }

    $manifestEntry = $archive.GetEntry("release-manifest.json")
    $reader = [System.IO.StreamReader]::new($manifestEntry.Open(), [System.Text.Encoding]::UTF8)
    try {
      $manifest = $reader.ReadToEnd() | ConvertFrom-Json
    } finally {
      $reader.Dispose()
    }
    Assert-True -Condition ([int]$manifest.formatVersion -eq 1) -Message "Unexpected release manifest format version."
    Assert-True -Condition (@($manifest.files).Count -eq ($entries.Count - 1)) -Message "Release manifest file count mismatch."

    foreach ($file in $manifest.files) {
      $entry = $archive.GetEntry([string]$file.path)
      Assert-True -Condition ($null -ne $entry) -Message "Manifest references a missing file: $($file.path)"
      Assert-True -Condition ([long]$entry.Length -eq [long]$file.bytes) -Message "Manifest byte count mismatch: $($file.path)"
      $stream = $entry.Open()
      try {
        $actualHash = Get-StreamSha256 -Stream $stream
      } finally {
        $stream.Dispose()
      }
      Assert-True -Condition ($actualHash -eq [string]$file.sha256) -Message "Manifest SHA-256 mismatch: $($file.path)"
    }
  } finally {
    $archive.Dispose()
  }

  Write-Host "Internal production source package test passed: required source, exclusions, byte counts, and SHA-256 manifest."
} finally {
  $tempRoot = ([System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  $testRootFull = [System.IO.Path]::GetFullPath($testRoot)
  if (
    (Test-Path -LiteralPath $testRootFull) -and
    $testRootFull.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
    ([System.IO.Path]::GetFileName($testRootFull) -like "dianshang-source-package-test-*")
  ) {
    Remove-Item -LiteralPath $testRootFull -Recurse -Force
  }
}
