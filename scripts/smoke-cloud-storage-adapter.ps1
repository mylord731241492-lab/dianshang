# 账号隔离云端资产库 smoke（Task 6，ADR-0006）。
# -UseFakeStorage：disposable 后端走 Fake Storage，跑 上传→列表→签名 URL→过期拒绝→软删除 全链路。
# 不带开关：ENABLE_REAL_STORAGE=true 启动，断言上传返回 503 ASSET_STORAGE_UNAVAILABLE 且不回退本地 uploads。
# 脚本不打印文件内容、Base64 或任何密钥。

[CmdletBinding()]
param(
  [switch]$UseFakeStorage
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$port = $env:SMOKE_ASSET_PORT
if (-not $port) {
  $port = "4598"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dianshang-cloud-storage-smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$dataDir = Join-Path $tempRoot "data"
$uploadDir = Join-Path $tempRoot "uploads"
$logDir = Join-Path $tempRoot "logs"
$outLog = Join-Path $tempRoot "server-out.log"
$errLog = Join-Path $tempRoot "server-err.log"

New-Item -ItemType Directory -Force -Path $dataDir, $uploadDir, $logDir | Out-Null

# 运行时生成的 disposable 签名密钥：仅存在于本进程环境变量，不写入日志或控制台。
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$secretBytes = New-Object byte[] 32
$rng.GetBytes($secretBytes)
$signingSecret = ([System.BitConverter]::ToString($secretBytes)).Replace("-", "").ToLowerInvariant()

$oldPort = $env:PORT
$oldDataDir = $env:DATA_DIR
$oldDbPath = $env:DB_PATH
$oldUploadDir = $env:UPLOAD_DIR
$oldLogDir = $env:LOG_DIR
$oldEnableRealAi = $env:ENABLE_REAL_AI
$oldEnableRealEmail = $env:ENABLE_REAL_EMAIL
$oldEnableRealPayment = $env:ENABLE_REAL_PAYMENT
$oldEnableRealStorage = $env:ENABLE_REAL_STORAGE
$oldAssetSigningSecret = $env:ASSET_URL_SIGNING_SECRET
$oldAssetFakeRoot = $env:ASSET_FAKE_STORAGE_ROOT
$proc = $null

function Invoke-SmokeRequest {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$ExpectedStatus = 200,
    [hashtable]$Headers = @{},
    $JsonBody = $null,
    [byte[]]$RawBody = $null,
    [string]$RawContentType = ""
  )

  $params = @{
    Method = $Method
    Uri = "http://127.0.0.1:$port$Path"
    Headers = $Headers
    UseBasicParsing = $true
  }
  if ($null -ne $JsonBody) {
    $params.ContentType = "application/json; charset=utf-8"
    $params.Body = ($JsonBody | ConvertTo-Json -Depth 10)
  } elseif ($null -ne $RawBody) {
    $params.ContentType = $RawContentType
    $params.Body = $RawBody
  }

  $statusCode = 0
  $content = ""
  $rawBytes = $null
  try {
    $response = Invoke-WebRequest @params
    $statusCode = [int]$response.StatusCode
    if ($null -ne $response.RawContentStream) {
      $ms = New-Object System.IO.MemoryStream
      $response.RawContentStream.CopyTo($ms)
      $rawBytes = $ms.ToArray()
    }
    $content = [string]$response.Content
  } catch {
    $httpResponse = $_.Exception.Response
    if (-not $httpResponse) {
      throw
    }
    $statusCode = [int]$httpResponse.StatusCode
    # PS 5.1 下异常响应流可能已被 Invoke-WebRequest 消费，优先取 ErrorDetails。
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = $_.ErrorDetails.Message
    } else {
      $stream = $httpResponse.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
      $content = $reader.ReadToEnd()
    }
  }

  if ($statusCode -ne $ExpectedStatus) {
    # 只输出状态码与错误 code 字段，不回显完整响应体（可能携带 URL 参数）。
    $code = ""
    try { $code = ($content | ConvertFrom-Json).code } catch {}
    throw "$Method $Path expected HTTP $ExpectedStatus but got $statusCode (code=$code)"
  }

  Write-Host "OK $Method $Path -> $statusCode"
  return @{ Content = $content; Bytes = $rawBytes }
}

function New-PngBytes {
  # 合法 PNG magic bytes + 填充；仅用于契约 smoke，不是真实图片。
  $bytes = New-Object System.Collections.Generic.List[byte]
  $bytes.AddRange([byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
  $fill = New-Object byte[] 64
  $rng.GetBytes($fill)
  $bytes.AddRange([byte[]]$fill)
  return $bytes.ToArray()
}

function New-MultipartBody {
  param(
    [Parameter(Mandatory=$true)][string]$Boundary,
    [Parameter(Mandatory=$true)][string]$FileName,
    [Parameter(Mandatory=$true)][string]$ContentType,
    [Parameter(Mandatory=$true)][byte[]]$Data
  )
  $header = [System.Text.Encoding]::UTF8.GetBytes(
    "--$Boundary`r`nContent-Disposition: form-data; name=`"file`"; filename=`"$FileName`"`r`nContent-Type: $ContentType`r`n`r`n")
  $footer = [System.Text.Encoding]::UTF8.GetBytes("`r`n--$Boundary--`r`n")
  $ms = New-Object System.IO.MemoryStream
  $ms.Write($header, 0, $header.Length)
  $ms.Write($Data, 0, $Data.Length)
  $ms.Write($footer, 0, $footer.Length)
  return $ms.ToArray()
}

function Get-AssetContentSig {
  param(
    [Parameter(Mandatory=$true)][string]$AssetId,
    [Parameter(Mandatory=$true)][long]$Expires
  )
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($signingSecret))
  try {
    $hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$AssetId.$Expires"))
    return ([System.BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
  } finally {
    $hmac.Dispose()
  }
}

try {
  $env:PORT = "$port"
  $env:DATA_DIR = $dataDir
  $env:DB_PATH = Join-Path $dataDir "data.db"
  $env:UPLOAD_DIR = $uploadDir
  $env:LOG_DIR = $logDir
  $env:ENABLE_REAL_AI = "false"
  $env:ENABLE_REAL_EMAIL = "false"
  $env:ENABLE_REAL_PAYMENT = "false"
  $env:ENABLE_LIBRECHAT = "false"
  $env:ASSET_URL_SIGNING_SECRET = $signingSecret
  if ($UseFakeStorage) {
    $env:ENABLE_REAL_STORAGE = "false"
    $env:ASSET_FAKE_STORAGE_ROOT = Join-Path $tempRoot "object-storage"
  } else {
    $env:ENABLE_REAL_STORAGE = "true"
    Remove-Item Env:\ASSET_FAKE_STORAGE_ROOT -ErrorAction SilentlyContinue
  }

  $proc = Start-Process -FilePath "node" `
    -ArgumentList "server.js" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $health = Invoke-RestMethod "http://127.0.0.1:$port/api/health"
      if ($health.success -and $health.database -eq "ok") {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    $errText = ""
    if (Test-Path $errLog) {
      $errText = Get-Content -Encoding UTF8 $errLog -Raw
    }
    throw "Cloud storage smoke server did not become ready on port $port. $errText"
  }

  $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $registerContent = (Invoke-SmokeRequest -Method "POST" -Path "/api/auth/register" -JsonBody @{
    username = "asset-smoke-$suffix"
    email = "asset-smoke-$suffix@test.internal"
    password = "AssetSmoke!$suffix"
  }).Content
  $token = ($registerContent | ConvertFrom-Json).token
  if (-not $token) {
    throw "Smoke user registration did not return a token"
  }
  $headers = @{ Authorization = "Bearer $token" }

  $pngBytes = New-PngBytes
  $boundary = "----hjmSmoke$([Guid]::NewGuid().ToString('N'))"
  $multipart = New-MultipartBody -Boundary $boundary -FileName "smoke.png" -ContentType "image/png" -Data $pngBytes

  if (-not $UseFakeStorage) {
    # 真实存储未实施：上传必须 503，不得静默成功。
    $unavailable = (Invoke-SmokeRequest -Method "POST" -Path "/api/user/assets/upload" -ExpectedStatus 503 `
      -Headers $headers -RawBody $multipart -RawContentType "multipart/form-data; boundary=$boundary").Content | ConvertFrom-Json
    if ($unavailable.code -ne "ASSET_STORAGE_UNAVAILABLE") {
      throw "ENABLE_REAL_STORAGE=true upload must return code ASSET_STORAGE_UNAVAILABLE, got $($unavailable.code)"
    }
    Write-Host "OK ENABLE_REAL_STORAGE=true -> 503 ASSET_STORAGE_UNAVAILABLE (no local fallback)"
    Write-Host "Cloud storage adapter smoke (real-storage 503 guard) passed with temp data dir: $tempRoot"
    return
  }

  # 1) 上传
  $uploadContent = (Invoke-SmokeRequest -Method "POST" -Path "/api/user/assets/upload" `
    -Headers $headers -RawBody $multipart -RawContentType "multipart/form-data; boundary=$boundary").Content
  $uploadResult = $uploadContent | ConvertFrom-Json
  $asset = $uploadResult.asset
  if (-not $uploadResult.success -or -not $asset -or -not $asset.id) {
    throw "Upload response missing success/asset"
  }
  if ($asset.accessUrl -and -not $asset.accessUrl.StartsWith("/api/asset-content/")) {
    throw "accessUrl must be a same-origin /api/asset-content/ signed path"
  }
  if ($uploadContent -match "secretAccessKey|accessKeyId|OBJECT_STORAGE_|sessionToken|presign") {
    throw "Upload response leaked storage credentials"
  }
  Write-Host "OK upload asset kind=$($asset.kind) sizeBytes=$($asset.sizeBytes)"

  # 2) 列表
  $list = (Invoke-SmokeRequest -Method "GET" -Path "/api/user/assets" -Headers $headers).Content | ConvertFrom-Json
  if (-not ($list.items | Where-Object { $_.id -eq $asset.id })) {
    throw "Asset list does not contain the uploaded asset"
  }

  # 3) 签名 URL 签发与内容回读
  $access = (Invoke-SmokeRequest -Method "GET" -Path "/api/user/assets/$($asset.id)/access-url" -Headers $headers).Content | ConvertFrom-Json
  if ($access.expiresInSeconds -ne 900 -or -not $access.url.StartsWith("/api/asset-content/")) {
    throw "access-url contract invalid: expiresInSeconds=$($access.expiresInSeconds)"
  }
  $contentResult = Invoke-SmokeRequest -Method "GET" -Path $access.url
  if ($null -eq $contentResult.Bytes -or $contentResult.Bytes.Length -ne $pngBytes.Length) {
    throw "Signed content read length mismatch"
  }
  for ($i = 0; $i -lt $pngBytes.Length; $i++) {
    if ($contentResult.Bytes[$i] -ne $pngBytes[$i]) {
      throw "Signed content read bytes mismatch at offset $i"
    }
  }
  Write-Host "OK signed content read matches uploaded bytes"

  # 4) 过期签名拒绝（自行按同一密钥构造已过期的合法签名）
  $expiredExpires = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - 10
  $expiredSig = Get-AssetContentSig -AssetId $asset.id -Expires $expiredExpires
  $expiredContent = (Invoke-SmokeRequest -Method "GET" -Path "/api/asset-content/$($asset.id)?expires=$expiredExpires&sig=$expiredSig" -ExpectedStatus 403).Content | ConvertFrom-Json
  if ($expiredContent.code -ne "ASSET_URL_EXPIRED") {
    throw "Expired signed URL must return code ASSET_URL_EXPIRED, got $($expiredContent.code)"
  }
  Write-Host "OK expired signed URL rejected with ASSET_URL_EXPIRED"

  # 5) 软删除：列表消失，旧签名 URL 失效
  $deleteResult = (Invoke-SmokeRequest -Method "DELETE" -Path "/api/user/assets/$($asset.id)" -Headers $headers).Content | ConvertFrom-Json
  if (-not $deleteResult.success) {
    throw "Soft delete did not return success"
  }
  $listAfter = (Invoke-SmokeRequest -Method "GET" -Path "/api/user/assets" -Headers $headers).Content | ConvertFrom-Json
  if ($listAfter.items | Where-Object { $_.id -eq $asset.id }) {
    throw "Soft-deleted asset still visible in list"
  }
  Invoke-SmokeRequest -Method "GET" -Path $access.url -ExpectedStatus 404 | Out-Null
  Write-Host "OK soft delete hides asset and invalidates signed URL"

  Write-Host "Cloud storage adapter smoke (Fake Storage full chain) passed with temp data dir: $tempRoot"
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    try {
      Wait-Process -Id $proc.Id -Timeout 5 -ErrorAction SilentlyContinue
    } catch {}
  }

  if ($null -eq $oldPort) { Remove-Item Env:\PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
  if ($null -eq $oldDataDir) { Remove-Item Env:\DATA_DIR -ErrorAction SilentlyContinue } else { $env:DATA_DIR = $oldDataDir }
  if ($null -eq $oldDbPath) { Remove-Item Env:\DB_PATH -ErrorAction SilentlyContinue } else { $env:DB_PATH = $oldDbPath }
  if ($null -eq $oldUploadDir) { Remove-Item Env:\UPLOAD_DIR -ErrorAction SilentlyContinue } else { $env:UPLOAD_DIR = $oldUploadDir }
  if ($null -eq $oldLogDir) { Remove-Item Env:\LOG_DIR -ErrorAction SilentlyContinue } else { $env:LOG_DIR = $oldLogDir }
  if ($null -eq $oldEnableRealAi) { Remove-Item Env:\ENABLE_REAL_AI -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_AI = $oldEnableRealAi }
  if ($null -eq $oldEnableRealEmail) { Remove-Item Env:\ENABLE_REAL_EMAIL -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_EMAIL = $oldEnableRealEmail }
  if ($null -eq $oldEnableRealPayment) { Remove-Item Env:\ENABLE_REAL_PAYMENT -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_PAYMENT = $oldEnableRealPayment }
  if ($null -eq $oldEnableRealStorage) { Remove-Item Env:\ENABLE_REAL_STORAGE -ErrorAction SilentlyContinue } else { $env:ENABLE_REAL_STORAGE = $oldEnableRealStorage }
  if ($null -eq $oldAssetSigningSecret) { Remove-Item Env:\ASSET_URL_SIGNING_SECRET -ErrorAction SilentlyContinue } else { $env:ASSET_URL_SIGNING_SECRET = $oldAssetSigningSecret }
  if ($null -eq $oldAssetFakeRoot) { Remove-Item Env:\ASSET_FAKE_STORAGE_ROOT -ErrorAction SilentlyContinue } else { $env:ASSET_FAKE_STORAGE_ROOT = $oldAssetFakeRoot }
  $rng.Dispose()

  if ($env:SMOKE_KEEP_TEMP -ne "true") {
    $resolvedTempRoot = Resolve-Path $tempRoot -ErrorAction SilentlyContinue
    $systemTemp = [System.IO.Path]::GetTempPath()
    if ($resolvedTempRoot -and $resolvedTempRoot.Path.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
      for ($i = 0; $i -lt 8; $i++) {
        try {
          Remove-Item -LiteralPath $resolvedTempRoot.Path -Recurse -Force
          break
        } catch {
          if ($i -eq 7) {
            Write-Warning "Could not remove temp smoke directory: $($resolvedTempRoot.Path). You can delete it later."
          } else {
            Start-Sleep -Milliseconds 500
          }
        }
      }
    }
  }
}
