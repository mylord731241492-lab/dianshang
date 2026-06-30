const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const migrationFile = path.join(root, 'frontend', 'src', 'config', 'frontendMigration.ts');
const routerFile = path.join(root, 'frontend', 'src', 'router', 'index.ts');
const legacyRedirectFile = path.join(root, 'frontend', 'src', 'views', 'LegacyRouteRedirect.vue');

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function unique(values) {
  return Array.from(new Set(values));
}

function extractMigrationRoutes(source) {
  const routes = [];
  const routePattern = /\{\s*path:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'\s*,\s*area:\s*'([^']+)'\s*,\s*status:\s*'([^']+)'/g;
  let match;
  while ((match = routePattern.exec(source)) !== null) {
    routes.push({
      path: match[1],
      title: match[2],
      area: match[3],
      status: match[4]
    });
  }
  return routes;
}

function extractRouterPaths(source) {
  const paths = [];
  const routePattern = /\{\s*path:\s*'([^']+)'/g;
  let match;
  while ((match = routePattern.exec(source)) !== null) {
    paths.push(match[1]);
  }
  return paths.filter((routePath) => routePath !== '/:pathMatch(.*)*');
}

function fail(messages) {
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

const migrationSource = readText(migrationFile);
const routerSource = readText(routerFile);
const migrationRoutes = extractMigrationRoutes(migrationSource);
const routerPaths = extractRouterPaths(routerSource);
const errors = [];

if (migrationRoutes.length === 0) {
  errors.push('No migration routes were found.');
}

const duplicateMigrationPaths = unique(
  migrationRoutes
    .map((route) => route.path)
    .filter((routePath, index, all) => all.indexOf(routePath) !== index)
);
for (const routePath of duplicateMigrationPaths) {
  errors.push(`Duplicate migration route: ${routePath}`);
}

const duplicateRouterPaths = unique(
  routerPaths.filter((routePath, index, all) => all.indexOf(routePath) !== index)
);
for (const routePath of duplicateRouterPaths) {
  errors.push(`Duplicate router path: ${routePath}`);
}

const migrationPathSet = new Set(migrationRoutes.map((route) => route.path));
const routerPathSet = new Set(routerPaths);

for (const route of migrationRoutes) {
  if (route.status !== 'source') {
    errors.push(`Migration route is not source: ${route.path} (${route.status})`);
  }
  if (!routerPathSet.has(route.path)) {
    errors.push(`Migration route missing in router: ${route.path}`);
  }
}

for (const routePath of routerPaths) {
  if (!migrationPathSet.has(routePath)) {
    errors.push(`Router path missing in migration index: ${routePath}`);
  }
}

if (routerSource.includes('LegacyRouteRedirect')) {
  errors.push('Router still references LegacyRouteRedirect.');
}

if (fs.existsSync(legacyRedirectFile)) {
  errors.push('LegacyRouteRedirect.vue still exists after source migration.');
}

if (errors.length > 0) {
  console.error('Source frontend route maintenance check failed:');
  fail(errors);
}

console.log(`Source frontend route maintenance check passed: ${migrationRoutes.length}/${routerPaths.length} source routes.`);
