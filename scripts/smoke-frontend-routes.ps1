$ErrorActionPreference = "Stop"
$OutputEncoding = [console]::InputEncoding = [console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$baseUrl = $env:SMOKE_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://127.0.0.1:3456"
}

$routes = @(
  "/",
  "/login",
  "/register",
  "/template-image",
  "/canvas",
  "/user/center",
  "/admin/login",
  "/admin/dashboard",
  "/admin/users",
  "/admin/recycle-bin",
  "/admin/orders",
  "/admin/logs",
  "/admin/generate-tasks",
  "/admin/redeem-codes",
  "/admin/api-providers",
  "/admin/model-prices",
  "/admin/template-workflows",
  "/admin/settings"
)

foreach ($route in $routes) {
  $response = Invoke-WebRequest -Method Get -Uri "$baseUrl$route" -UseBasicParsing
  if ($response.StatusCode -ne 200) {
    throw "Frontend route $route returned HTTP $($response.StatusCode)"
  }
  if ($response.Content -notmatch '<div id="app"></div>') {
    throw "Frontend route $route did not return SPA shell"
  }
  if ($response.Content -notmatch '/assets/index-.*\.js') {
    throw "Frontend route $route missing bundled index script"
  }
  Write-Host "OK GET $route"
}

$assetPaths = @(
  "/assets/index-DglIsp_g.js",
  "/assets/canvas-project-restore-guard.js",
  "/assets/index-C4xTg-zU.css",
  "/assets/home-carousel-inertia.js",
  "/assets/user-center-data-bridge.js",
  "/assets/gallery-persistence-bridge.js",
  "/assets/home-overrides.css",
  "/assets/canvas-node-radius-fix.css",
  "/logo.png",
  "/templates/covers/main-image.svg"
)

foreach ($assetPath in $assetPaths) {
  $response = Invoke-WebRequest -Method Get -Uri "$baseUrl$assetPath" -UseBasicParsing
  if ($response.StatusCode -ne 200) {
    throw "Static asset $assetPath returned HTTP $($response.StatusCode)"
  }
  if (-not $response.Content -and -not $response.RawContent) {
    throw "Static asset $assetPath returned empty response"
  }
  Write-Host "OK GET $assetPath"
}

Write-Host "Frontend route smoke checks passed for $baseUrl"
