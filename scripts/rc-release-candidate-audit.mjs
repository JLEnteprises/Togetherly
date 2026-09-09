import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const MARKER = 'RC_RELEASE_CANDIDATE_AUDIT';
let failures = 0;
let warnings = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL ${message}`);
}
function warn(message) {
  warnings += 1;
  console.warn(`WARN ${message}`);
}
function pass(message) {
  console.log(`PASS ${message}`);
}
function read(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    fail(`missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}
function relative(full) {
  return path.relative(root, full).replaceAll('\\', '/');
}
function parseJson(relativePath) {
  try {
    const value = JSON.parse(read(relativePath));
    pass(`${relativePath} parses`);
    return value;
  } catch (error) {
    fail(`${relativePath} JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

console.log('Togetherly v1.14.3 — Release Candidate Audit');
console.log(`Marker: ${MARKER}`);

// -----------------------------------------------------------------------------
// Source / configuration integrity.
// -----------------------------------------------------------------------------
const packageJson = parseJson('package.json');
const serverPackageJson = parseJson('server/package.json');
const appJson = parseJson('app.json');

if (packageJson?.version === serverPackageJson?.version && packageJson?.version === appJson?.expo?.version) {
  pass(`client/server/app versions agree at ${packageJson.version}`);
} else {
  fail(`version mismatch: client=${packageJson?.version} server=${serverPackageJson?.version} app=${appJson?.expo?.version}`);
}

const sourceFiles = [
  ...walk(path.join(root, 'src')),
  ...walk(path.join(root, 'server', 'src')),
].filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file));

pass(`${sourceFiles.length} application/server source files discovered`);

function resolveImport(fromFile, specifier) {
  let candidate;
  if (specifier.startsWith('@/')) candidate = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(fromFile), specifier);
  else return true;

  const attempts = [candidate];

  if (/\.(js|jsx|mjs)$/.test(candidate)) {
    attempts.push(candidate.replace(/\.(js|jsx|mjs)$/, '.ts'));
    attempts.push(candidate.replace(/\.(js|jsx|mjs)$/, '.tsx'));
  } else if (!path.extname(candidate)) {
    attempts.push(`${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.jsx`, `${candidate}.mjs`, `${candidate}.json`);
    attempts.push(
      path.join(candidate, 'index.ts'),
      path.join(candidate, 'index.tsx'),
      path.join(candidate, 'index.js'),
      path.join(candidate, 'index.jsx'),
      path.join(candidate, 'index.mjs'),
    );
  }

  return attempts.some((attempt) => fs.existsSync(attempt));
}

let localImportCount = 0;
const unresolvedImports = [];

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  const specs = new Set();
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(source))) specs.add(match[1]);
  }

  for (const spec of specs) {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    localImportCount += 1;
    if (!resolveImport(file, spec)) unresolvedImports.push(`${relative(file)} -> ${spec}`);
  }
}

if (unresolvedImports.length) {
  for (const item of unresolvedImports.slice(0, 25)) fail(`unresolved local import ${item}`);
  if (unresolvedImports.length > 25) fail(`${unresolvedImports.length - 25} more unresolved local imports`);
} else {
  pass(`${localImportCount} local/aliased imports resolve`);
}

// -----------------------------------------------------------------------------
// Expo Router destination integrity.
// -----------------------------------------------------------------------------
const appFiles = walk(path.join(root, 'src', 'app')).filter((file) => /\.(ts|tsx)$/.test(file));

function routePatternForFile(fullPath) {
  const rel = path.relative(path.join(root, 'src', 'app'), fullPath).replaceAll('\\', '/');
  const noExt = rel.replace(/\.(tsx|ts)$/, '');
  const segments = noExt.split('/').filter((segment) => segment && !segment.startsWith('('));
  if (segments.at(-1) === '_layout') return null;
  if (segments.at(-1) === 'index') segments.pop();
  return `/${segments.join('/')}`;
}
function routeMatches(pattern, literalPath) {
  const clean = literalPath.split('?')[0].split('#')[0];
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = clean.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => /^\[[^\]]+\]$/.test(part) || part === pathParts[index]);
}

const routePatterns = appFiles.map(routePatternForFile).filter(Boolean);
const literalFeatureRoutes = new Set();

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const regex = /['"](\/features\/[A-Za-z0-9_./-]+(?:\?[^'"]*)?)['"]/g;
  let match;
  while ((match = regex.exec(source))) literalFeatureRoutes.add(match[1]);
}

const missingFeatureRoutes = [...literalFeatureRoutes].filter(
  (literal) => !routePatterns.some((pattern) => routeMatches(pattern, literal)),
);

if (missingFeatureRoutes.length) {
  for (const item of missingFeatureRoutes) fail(`missing Expo Router destination ${item}`);
} else {
  pass(`${literalFeatureRoutes.size} literal feature destinations resolve`);
}

// -----------------------------------------------------------------------------
// Fastify registration integrity + literal client API coverage.
// -----------------------------------------------------------------------------
const serverFiles = walk(path.join(root, 'server', 'src')).filter((file) => /\.ts$/.test(file));
const serverRoutes = [];
for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const regex = /\bapp\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source))) {
    serverRoutes.push({ method: match[1].toUpperCase(), route: match[2], file: relative(file) });
  }
}

const duplicateMap = new Map();
for (const item of serverRoutes) {
  const key = `${item.method} ${item.route}`;
  const list = duplicateMap.get(key) ?? [];
  list.push(item.file);
  duplicateMap.set(key, list);
}
const duplicates = [...duplicateMap.entries()].filter(([, files]) => files.length > 1);
if (duplicates.length) {
  for (const [key, files] of duplicates) fail(`duplicate Fastify route ${key} in ${files.join(', ')}`);
} else {
  pass(`${serverRoutes.length} literal Fastify registrations contain no duplicates`);
}

function serverRouteMatches(routePattern, clientPath) {
  const clean = clientPath.split('?')[0].split('#')[0];
  const routeParts = routePattern.split('/').filter(Boolean);
  const clientParts = clean.split('/').filter(Boolean);
  if (routeParts.length !== clientParts.length) return false;
  return routeParts.every((part, index) => part.startsWith(':') || part === clientParts[index]);
}

const apiFiles = walk(path.join(root, 'src', 'services', 'backend')).filter((file) => /\.(ts|tsx)$/.test(file));
const literalApiPaths = new Set();
for (const file of apiFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const regex = /\bapiRequest(?:<[\s\S]*?>)?\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source))) {
    if (match[1].startsWith('/')) literalApiPaths.add(match[1]);
  }
}

const unmatchedApiPaths = [...literalApiPaths].filter(
  (clientPath) => !serverRoutes.some((item) => serverRouteMatches(item.route, clientPath)),
);
if (unmatchedApiPaths.length) {
  for (const item of unmatchedApiPaths) fail(`literal client API path has no matching Fastify route: ${item}`);
} else {
  pass(`${literalApiPaths.size} literal client API paths match server routes`);
}

// -----------------------------------------------------------------------------
// Migration ordering and latest photo compatibility migrations.
// -----------------------------------------------------------------------------
const migrationDir = path.join(root, 'server', 'migrations');
const migrations = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort()
  : [];

const migrationNumbers = migrations.map((name) => Number(name.slice(0, 3)));
const duplicateMigrationNumbers = migrationNumbers.filter((number, index) => migrationNumbers.indexOf(number) !== index);
if (duplicateMigrationNumbers.length) {
  fail(`duplicate migration numbers: ${[...new Set(duplicateMigrationNumbers)].join(', ')}`);
} else {
  pass(`${migrations.length} migration numbers are unique`);
}

if (migrations.includes('018_standalone_photos.sql') && migrations.includes('019_memory_photo_integration.sql')) {
  pass('H1/H3 standalone-photo migrations are present');
} else {
  fail('standalone-photo migrations 018/019 are missing');
}

for (let expected = 1; expected <= Math.max(...migrationNumbers, 0); expected += 1) {
  if (!migrationNumbers.includes(expected)) warn(`migration sequence has gap at ${String(expected).padStart(3, '0')}`);
}

// -----------------------------------------------------------------------------
// Completed redesign architecture markers.
// -----------------------------------------------------------------------------
const phaseChecks = [
  ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
  ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],
  ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],
  ['src/components/plan/PlanHubGroups.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
  ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],
  ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
  ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
  ['src/app/features/photos.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
  ['server/migrations/019_memory_photo_integration.sql', 'H3_MEMORY_PHOTO_INTEGRATION'],
  ['src/app/features/memories.tsx', 'H3_MEMORY_PHOTO_INTEGRATION'],
  ['src/components/scratchpad/FullscreenScratchpadDrawing.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],
  ['src/components/common/DrawingCanvas.tsx', 'I2_DRAWING_PERFORMANCE_HARDENING'],
  ['scripts/i3-ui-regression-audit.mjs', 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY'],
];

for (const [file, marker] of phaseChecks) {
  const source = read(file);
  if (source.includes(marker)) pass(`${marker} retained`);
  else fail(`${marker} missing from ${file}`);
}

const i3Audit = read('scripts/i3-ui-regression-audit.mjs');
if (i3Audit.includes('I3_LOVE_TAP_AUDIT_REPAIR')) pass('I3 Love Tap audit repair retained');
else fail('I3 Love Tap audit repair marker missing');

// -----------------------------------------------------------------------------
// Product-cleanup scan (warnings unless clearly release-blocking).
// -----------------------------------------------------------------------------
const productionSource = sourceFiles
  .filter((file) => !relative(file).includes('/smoke'))
  .map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }));

const todoMatches = [];
for (const { file, source } of productionSource) {
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) todoMatches.push(`${relative(file)}:${index + 1}`);
  });
}
if (todoMatches.length) warn(`${todoMatches.length} TODO/FIXME/HACK/XXX markers remain: ${todoMatches.slice(0, 8).join(', ')}`);
else pass('no TODO/FIXME/HACK/XXX markers in production source');

// -----------------------------------------------------------------------------
// Referenced build assets.
// -----------------------------------------------------------------------------
const assetPaths = [
  appJson?.expo?.icon,
  appJson?.expo?.splash?.image,
  appJson?.expo?.android?.adaptiveIcon?.foregroundImage,
  appJson?.expo?.web?.favicon,
  ...(Array.isArray(appJson?.expo?.plugins)
    ? appJson.expo.plugins.flatMap((plugin) => {
        if (!Array.isArray(plugin) || typeof plugin[1] !== 'object' || plugin[1] === null) return [];
        return [plugin[1].icon].filter(Boolean);
      })
    : []),
].filter((value) => typeof value === 'string');

const missingAssets = assetPaths.filter((asset) => !fs.existsSync(path.resolve(root, asset)));
if (missingAssets.length) {
  for (const asset of missingAssets) fail(`referenced build asset missing: ${asset}`);
} else {
  pass(`${assetPaths.length} referenced app/build assets exist`);
}

// -----------------------------------------------------------------------------
// Distribution/deployment readiness warnings — not source-code RC failures.
// -----------------------------------------------------------------------------
const iosBundle = appJson?.expo?.ios?.bundleIdentifier;
const androidPackage = appJson?.expo?.android?.package;
const appGroups = appJson?.expo?.ios?.entitlements?.['com.apple.security.application-groups'] ?? [];

if (iosBundle === 'com.example.togetherly') warn('iOS bundleIdentifier is still placeholder com.example.togetherly');
else pass(`iOS bundleIdentifier is non-placeholder: ${iosBundle}`);

if (androidPackage === 'com.example.togetherly') warn('Android package is still placeholder com.example.togetherly');
else pass(`Android package is non-placeholder: ${androidPackage}`);

if (Array.isArray(appGroups) && appGroups.some((value) => String(value).includes('com.example.togetherly'))) {
  warn('iOS App Group entitlement still uses placeholder com.example.togetherly identity');
}

const envExample = read('.env.example');
if (/EXPO_PUBLIC_EAS_PROJECT_ID=\s*(?:\r?\n|$)/.test(envExample)) warn('EAS project ID is intentionally unset in .env.example');
if (/EXPO_PUBLIC_APPLE_TEAM_ID=\s*(?:\r?\n|$)/.test(envExample)) warn('Apple Team ID is intentionally unset in .env.example');
if (/EXPO_PUBLIC_API_URL=http:\/\/localhost:4000/.test(envExample)) warn('example client API URL is local HTTP; production requires HTTPS/environment configuration');

// Local file dependency must resolve.
for (const [name, version] of Object.entries(packageJson?.dependencies ?? {})) {
  if (typeof version === 'string' && version.startsWith('file:')) {
    const dependencyPath = path.resolve(root, version.slice(5), 'package.json');
    if (fs.existsSync(dependencyPath)) pass(`local dependency ${name} resolves`);
    else fail(`local dependency ${name} missing at ${relative(dependencyPath)}`);
  }
}

console.log(`\nRC static audit summary: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) {
  console.error('RC STATIC AUDIT FAILED');
  process.exit(1);
}

console.log('RC STATIC AUDIT PASSED');
console.log('Deployment warnings above do not invalidate the code/integration release candidate; resolve them before signed store distribution.');
