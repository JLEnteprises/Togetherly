const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'RC — Release Candidate Audit';
const MARKER = 'RC_RELEASE_CANDIDATE_AUDIT';
const root = process.cwd();

const auditSource = "import fs from 'node:fs';\nimport path from 'node:path';\n\nconst root = process.cwd();\nconst MARKER = 'RC_RELEASE_CANDIDATE_AUDIT';\nlet failures = 0;\nlet warnings = 0;\n\nfunction fail(message) {\n  failures += 1;\n  console.error(`FAIL ${message}`);\n}\nfunction warn(message) {\n  warnings += 1;\n  console.warn(`WARN ${message}`);\n}\nfunction pass(message) {\n  console.log(`PASS ${message}`);\n}\nfunction read(relativePath) {\n  const full = path.join(root, relativePath);\n  if (!fs.existsSync(full)) {\n    fail(`missing ${relativePath}`);\n    return '';\n  }\n  return fs.readFileSync(full, 'utf8').replace(/\\r\\n/g, '\\n');\n}\nfunction walk(dir) {\n  if (!fs.existsSync(dir)) return [];\n  const output = [];\n  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {\n    const full = path.join(dir, entry.name);\n    if (entry.isDirectory()) output.push(...walk(full));\n    else output.push(full);\n  }\n  return output;\n}\nfunction relative(full) {\n  return path.relative(root, full).replaceAll('\\\\', '/');\n}\nfunction parseJson(relativePath) {\n  try {\n    const value = JSON.parse(read(relativePath));\n    pass(`${relativePath} parses`);\n    return value;\n  } catch (error) {\n    fail(`${relativePath} JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);\n    return null;\n  }\n}\n\nconsole.log('Togetherly v1.14.3 — Release Candidate Audit');\nconsole.log(`Marker: ${MARKER}`);\n\n// -----------------------------------------------------------------------------\n// Source / configuration integrity.\n// -----------------------------------------------------------------------------\nconst packageJson = parseJson('package.json');\nconst serverPackageJson = parseJson('server/package.json');\nconst appJson = parseJson('app.json');\n\nif (packageJson?.version === serverPackageJson?.version && packageJson?.version === appJson?.expo?.version) {\n  pass(`client/server/app versions agree at ${packageJson.version}`);\n} else {\n  fail(`version mismatch: client=${packageJson?.version} server=${serverPackageJson?.version} app=${appJson?.expo?.version}`);\n}\n\nconst sourceFiles = [\n  ...walk(path.join(root, 'src')),\n  ...walk(path.join(root, 'server', 'src')),\n].filter((file) => /\\.(ts|tsx|js|jsx|mjs)$/.test(file));\n\npass(`${sourceFiles.length} application/server source files discovered`);\n\nfunction resolveImport(fromFile, specifier) {\n  let candidate;\n  if (specifier.startsWith('@/')) candidate = path.join(root, 'src', specifier.slice(2));\n  else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(fromFile), specifier);\n  else return true;\n\n  const attempts = [candidate];\n\n  if (/\\.(js|jsx|mjs)$/.test(candidate)) {\n    attempts.push(candidate.replace(/\\.(js|jsx|mjs)$/, '.ts'));\n    attempts.push(candidate.replace(/\\.(js|jsx|mjs)$/, '.tsx'));\n  } else if (!path.extname(candidate)) {\n    attempts.push(`${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.jsx`, `${candidate}.mjs`, `${candidate}.json`);\n    attempts.push(\n      path.join(candidate, 'index.ts'),\n      path.join(candidate, 'index.tsx'),\n      path.join(candidate, 'index.js'),\n      path.join(candidate, 'index.jsx'),\n      path.join(candidate, 'index.mjs'),\n    );\n  }\n\n  return attempts.some((attempt) => fs.existsSync(attempt));\n}\n\nlet localImportCount = 0;\nconst unresolvedImports = [];\n\nfor (const file of sourceFiles) {\n  const source = fs.readFileSync(file, 'utf8');\n  const patterns = [\n    /\\b(?:import|export)\\s+(?:type\\s+)?(?:[\\s\\S]*?\\s+from\\s+)?['\"]([^'\"]+)['\"]/g,\n    /\\brequire\\(\\s*['\"]([^'\"]+)['\"]\\s*\\)/g,\n  ];\n\n  const specs = new Set();\n  for (const regex of patterns) {\n    let match;\n    while ((match = regex.exec(source))) specs.add(match[1]);\n  }\n\n  for (const spec of specs) {\n    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;\n    localImportCount += 1;\n    if (!resolveImport(file, spec)) unresolvedImports.push(`${relative(file)} -> ${spec}`);\n  }\n}\n\nif (unresolvedImports.length) {\n  for (const item of unresolvedImports.slice(0, 25)) fail(`unresolved local import ${item}`);\n  if (unresolvedImports.length > 25) fail(`${unresolvedImports.length - 25} more unresolved local imports`);\n} else {\n  pass(`${localImportCount} local/aliased imports resolve`);\n}\n\n// -----------------------------------------------------------------------------\n// Expo Router destination integrity.\n// -----------------------------------------------------------------------------\nconst appFiles = walk(path.join(root, 'src', 'app')).filter((file) => /\\.(ts|tsx)$/.test(file));\n\nfunction routePatternForFile(fullPath) {\n  const rel = path.relative(path.join(root, 'src', 'app'), fullPath).replaceAll('\\\\', '/');\n  const noExt = rel.replace(/\\.(tsx|ts)$/, '');\n  const segments = noExt.split('/').filter((segment) => segment && !segment.startsWith('('));\n  if (segments.at(-1) === '_layout') return null;\n  if (segments.at(-1) === 'index') segments.pop();\n  return `/${segments.join('/')}`;\n}\nfunction routeMatches(pattern, literalPath) {\n  const clean = literalPath.split('?')[0].split('#')[0];\n  const patternParts = pattern.split('/').filter(Boolean);\n  const pathParts = clean.split('/').filter(Boolean);\n  if (patternParts.length !== pathParts.length) return false;\n  return patternParts.every((part, index) => /^\\[[^\\]]+\\]$/.test(part) || part === pathParts[index]);\n}\n\nconst routePatterns = appFiles.map(routePatternForFile).filter(Boolean);\nconst literalFeatureRoutes = new Set();\n\nfor (const file of sourceFiles) {\n  const source = fs.readFileSync(file, 'utf8');\n  const regex = /['\"](\\/features\\/[A-Za-z0-9_./-]+(?:\\?[^'\"]*)?)['\"]/g;\n  let match;\n  while ((match = regex.exec(source))) literalFeatureRoutes.add(match[1]);\n}\n\nconst missingFeatureRoutes = [...literalFeatureRoutes].filter(\n  (literal) => !routePatterns.some((pattern) => routeMatches(pattern, literal)),\n);\n\nif (missingFeatureRoutes.length) {\n  for (const item of missingFeatureRoutes) fail(`missing Expo Router destination ${item}`);\n} else {\n  pass(`${literalFeatureRoutes.size} literal feature destinations resolve`);\n}\n\n// -----------------------------------------------------------------------------\n// Fastify registration integrity + literal client API coverage.\n// -----------------------------------------------------------------------------\nconst serverFiles = walk(path.join(root, 'server', 'src')).filter((file) => /\\.ts$/.test(file));\nconst serverRoutes = [];\nfor (const file of serverFiles) {\n  const source = fs.readFileSync(file, 'utf8');\n  const regex = /\\bapp\\.(get|post|put|patch|delete)\\(\\s*['\"]([^'\"]+)['\"]/g;\n  let match;\n  while ((match = regex.exec(source))) {\n    serverRoutes.push({ method: match[1].toUpperCase(), route: match[2], file: relative(file) });\n  }\n}\n\nconst duplicateMap = new Map();\nfor (const item of serverRoutes) {\n  const key = `${item.method} ${item.route}`;\n  const list = duplicateMap.get(key) ?? [];\n  list.push(item.file);\n  duplicateMap.set(key, list);\n}\nconst duplicates = [...duplicateMap.entries()].filter(([, files]) => files.length > 1);\nif (duplicates.length) {\n  for (const [key, files] of duplicates) fail(`duplicate Fastify route ${key} in ${files.join(', ')}`);\n} else {\n  pass(`${serverRoutes.length} literal Fastify registrations contain no duplicates`);\n}\n\nfunction serverRouteMatches(routePattern, clientPath) {\n  const clean = clientPath.split('?')[0].split('#')[0];\n  const routeParts = routePattern.split('/').filter(Boolean);\n  const clientParts = clean.split('/').filter(Boolean);\n  if (routeParts.length !== clientParts.length) return false;\n  return routeParts.every((part, index) => part.startsWith(':') || part === clientParts[index]);\n}\n\nconst apiFiles = walk(path.join(root, 'src', 'services', 'backend')).filter((file) => /\\.(ts|tsx)$/.test(file));\nconst literalApiPaths = new Set();\nfor (const file of apiFiles) {\n  const source = fs.readFileSync(file, 'utf8');\n  const regex = /\\bapiRequest(?:<[\\s\\S]*?>)?\\(\\s*['\"]([^'\"]+)['\"]/g;\n  let match;\n  while ((match = regex.exec(source))) {\n    if (match[1].startsWith('/')) literalApiPaths.add(match[1]);\n  }\n}\n\nconst unmatchedApiPaths = [...literalApiPaths].filter(\n  (clientPath) => !serverRoutes.some((item) => serverRouteMatches(item.route, clientPath)),\n);\nif (unmatchedApiPaths.length) {\n  for (const item of unmatchedApiPaths) fail(`literal client API path has no matching Fastify route: ${item}`);\n} else {\n  pass(`${literalApiPaths.size} literal client API paths match server routes`);\n}\n\n// -----------------------------------------------------------------------------\n// Migration ordering and latest photo compatibility migrations.\n// -----------------------------------------------------------------------------\nconst migrationDir = path.join(root, 'server', 'migrations');\nconst migrations = fs.existsSync(migrationDir)\n  ? fs.readdirSync(migrationDir).filter((name) => /^\\d{3}_.+\\.sql$/.test(name)).sort()\n  : [];\n\nconst migrationNumbers = migrations.map((name) => Number(name.slice(0, 3)));\nconst duplicateMigrationNumbers = migrationNumbers.filter((number, index) => migrationNumbers.indexOf(number) !== index);\nif (duplicateMigrationNumbers.length) {\n  fail(`duplicate migration numbers: ${[...new Set(duplicateMigrationNumbers)].join(', ')}`);\n} else {\n  pass(`${migrations.length} migration numbers are unique`);\n}\n\nif (migrations.includes('018_standalone_photos.sql') && migrations.includes('019_memory_photo_integration.sql')) {\n  pass('H1/H3 standalone-photo migrations are present');\n} else {\n  fail('standalone-photo migrations 018/019 are missing');\n}\n\nfor (let expected = 1; expected <= Math.max(...migrationNumbers, 0); expected += 1) {\n  if (!migrationNumbers.includes(expected)) warn(`migration sequence has gap at ${String(expected).padStart(3, '0')}`);\n}\n\n// -----------------------------------------------------------------------------\n// Completed redesign architecture markers.\n// -----------------------------------------------------------------------------\nconst phaseChecks = [\n  ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],\n  ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],\n  ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],\n  ['src/components/plan/PlanHubGroups.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],\n  ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],\n  ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],\n  ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],\n  ['src/app/features/photos.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],\n  ['server/migrations/019_memory_photo_integration.sql', 'H3_MEMORY_PHOTO_INTEGRATION'],\n  ['src/app/features/memories.tsx', 'H3_MEMORY_PHOTO_INTEGRATION'],\n  ['src/components/scratchpad/FullscreenScratchpadDrawing.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],\n  ['src/components/common/DrawingCanvas.tsx', 'I2_DRAWING_PERFORMANCE_HARDENING'],\n  ['scripts/i3-ui-regression-audit.mjs', 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY'],\n];\n\nfor (const [file, marker] of phaseChecks) {\n  const source = read(file);\n  if (source.includes(marker)) pass(`${marker} retained`);\n  else fail(`${marker} missing from ${file}`);\n}\n\nconst i3Audit = read('scripts/i3-ui-regression-audit.mjs');\nif (i3Audit.includes('I3_LOVE_TAP_AUDIT_REPAIR')) pass('I3 Love Tap audit repair retained');\nelse fail('I3 Love Tap audit repair marker missing');\n\n// -----------------------------------------------------------------------------\n// Product-cleanup scan (warnings unless clearly release-blocking).\n// -----------------------------------------------------------------------------\nconst productionSource = sourceFiles\n  .filter((file) => !relative(file).includes('/smoke'))\n  .map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }));\n\nconst todoMatches = [];\nfor (const { file, source } of productionSource) {\n  const lines = source.split(/\\r?\\n/);\n  lines.forEach((line, index) => {\n    if (/\\b(TODO|FIXME|HACK|XXX)\\b/i.test(line)) todoMatches.push(`${relative(file)}:${index + 1}`);\n  });\n}\nif (todoMatches.length) warn(`${todoMatches.length} TODO/FIXME/HACK/XXX markers remain: ${todoMatches.slice(0, 8).join(', ')}`);\nelse pass('no TODO/FIXME/HACK/XXX markers in production source');\n\n// -----------------------------------------------------------------------------\n// Referenced build assets.\n// -----------------------------------------------------------------------------\nconst assetPaths = [\n  appJson?.expo?.icon,\n  appJson?.expo?.splash?.image,\n  appJson?.expo?.android?.adaptiveIcon?.foregroundImage,\n  appJson?.expo?.web?.favicon,\n  ...(Array.isArray(appJson?.expo?.plugins)\n    ? appJson.expo.plugins.flatMap((plugin) => {\n        if (!Array.isArray(plugin) || typeof plugin[1] !== 'object' || plugin[1] === null) return [];\n        return [plugin[1].icon].filter(Boolean);\n      })\n    : []),\n].filter((value) => typeof value === 'string');\n\nconst missingAssets = assetPaths.filter((asset) => !fs.existsSync(path.resolve(root, asset)));\nif (missingAssets.length) {\n  for (const asset of missingAssets) fail(`referenced build asset missing: ${asset}`);\n} else {\n  pass(`${assetPaths.length} referenced app/build assets exist`);\n}\n\n// -----------------------------------------------------------------------------\n// Distribution/deployment readiness warnings — not source-code RC failures.\n// -----------------------------------------------------------------------------\nconst iosBundle = appJson?.expo?.ios?.bundleIdentifier;\nconst androidPackage = appJson?.expo?.android?.package;\nconst appGroups = appJson?.expo?.ios?.entitlements?.['com.apple.security.application-groups'] ?? [];\n\nif (iosBundle === 'com.example.togetherly') warn('iOS bundleIdentifier is still placeholder com.example.togetherly');\nelse pass(`iOS bundleIdentifier is non-placeholder: ${iosBundle}`);\n\nif (androidPackage === 'com.example.togetherly') warn('Android package is still placeholder com.example.togetherly');\nelse pass(`Android package is non-placeholder: ${androidPackage}`);\n\nif (Array.isArray(appGroups) && appGroups.some((value) => String(value).includes('com.example.togetherly'))) {\n  warn('iOS App Group entitlement still uses placeholder com.example.togetherly identity');\n}\n\nconst envExample = read('.env.example');\nif (/EXPO_PUBLIC_EAS_PROJECT_ID=\\s*(?:\\r?\\n|$)/.test(envExample)) warn('EAS project ID is intentionally unset in .env.example');\nif (/EXPO_PUBLIC_APPLE_TEAM_ID=\\s*(?:\\r?\\n|$)/.test(envExample)) warn('Apple Team ID is intentionally unset in .env.example');\nif (/EXPO_PUBLIC_API_URL=http:\\/\\/localhost:4000/.test(envExample)) warn('example client API URL is local HTTP; production requires HTTPS/environment configuration');\n\n// Local file dependency must resolve.\nfor (const [name, version] of Object.entries(packageJson?.dependencies ?? {})) {\n  if (typeof version === 'string' && version.startsWith('file:')) {\n    const dependencyPath = path.resolve(root, version.slice(5), 'package.json');\n    if (fs.existsSync(dependencyPath)) pass(`local dependency ${name} resolves`);\n    else fail(`local dependency ${name} missing at ${relative(dependencyPath)}`);\n  }\n}\n\nconsole.log(`\\nRC static audit summary: ${failures} failure(s), ${warnings} warning(s).`);\nif (failures) {\n  console.error('RC STATIC AUDIT FAILED');\n  process.exit(1);\n}\n\nconsole.log('RC STATIC AUDIT PASSED');\nconsole.log('Deployment warnings above do not invalidate the code/integration release candidate; resolve them before signed store distribution.');\n";
const smokeBlock = "\n    // RC_RELEASE_CANDIDATE_AUDIT: H1-H3 standalone Photos integration coverage.\n    const memoryPhotoId = loadedMemory?.photos?.[0]?.id as string | undefined;\n    assert(memoryPhotoId, 'H3 Memory creation did not return a first-class Photo id.');\n\n    const firstClassPhotos = await request<{ photos: Json[] }>('/photos', { token: b.accessToken });\n    assert(firstClassPhotos.photos.some((item) => item.id === memoryPhotoId && item.linked_memory_id === memory.id), 'Memory-created Photo was not visible in standalone Photos with its Memory link.');\n\n    const standalonePhoto = (await request<{ photo: Json }>('/photos', {\n      method: 'POST',\n      token: a.accessToken,\n      expected: 201,\n      body: { mediaUrl: tinyPng, caption: 'Standalone smoke photo', takenAt: '2026-07-26T12:00:00Z' },\n    })).photo;\n    assert(standalonePhoto.id && standalonePhoto.linked_memory_id == null, 'Standalone Photo was not created independently of a Memory.');\n    await request(`/photos/${standalonePhoto.id}`, { token: c.accessToken, expected: 404 });\n\n    const photoAlbum = (await request<{ album: Json }>('/photo-albums', {\n      method: 'POST',\n      token: b.accessToken,\n      expected: 201,\n      body: { title: 'First-class smoke album', description: 'Standalone photo album coverage' },\n    })).album;\n\n    await request(`/photo-albums/${photoAlbum.id}/photos`, {\n      method: 'POST', token: a.accessToken, expected: 201, body: { photoId: memoryPhotoId },\n    });\n    await request(`/photo-albums/${photoAlbum.id}/photos`, {\n      method: 'POST', token: b.accessToken, expected: 201, body: { photoId: standalonePhoto.id },\n    });\n\n    const firstClassAlbumDetail = await request<{ album: Json; photos: Json[] }>(`/photo-albums/${photoAlbum.id}`, { token: a.accessToken });\n    assert(firstClassAlbumDetail.photos.length === 2, `Photo album expected 2 Photos, got ${firstClassAlbumDetail.photos.length}.`);\n    assert(firstClassAlbumDetail.photos.some((item) => item.id === memoryPhotoId) && firstClassAlbumDetail.photos.some((item) => item.id === standalonePhoto.id), 'Photo album did not preserve individual Photo membership.');\n    await request(`/photo-albums/${photoAlbum.id}/photos`, {\n      method: 'POST', token: c.accessToken, expected: 404, body: { photoId: standalonePhoto.id },\n    });\n\n    await request(`/photo-albums/${photoAlbum.id}/photos/${memoryPhotoId}`, { method: 'DELETE', token: b.accessToken, expected: 204 });\n    const photoAfterAlbumRemoval = await request<{ photo: Json }>(`/photos/${memoryPhotoId}`, { token: a.accessToken });\n    assert(photoAfterAlbumRemoval.photo.id === memoryPhotoId, 'Removing a Photo from a photo album deleted the Photo.');\n\n    const existingPhotoMemory = (await request<{ memory: Json }>('/memories', {\n      method: 'POST',\n      token: b.accessToken,\n      expected: 201,\n      body: { title: 'Existing Photo smoke memory', memoryDate: '2026-07-26', photoIds: [standalonePhoto.id] },\n    })).memory;\n    assert(existingPhotoMemory.photos?.[0]?.id === standalonePhoto.id, 'Memory could not select an existing standalone Photo.');\n\n    const linkedStandalone = await request<{ photo: Json }>(`/photos/${standalonePhoto.id}`, { token: a.accessToken });\n    assert(linkedStandalone.photo.linked_memory_id === existingPhotoMemory.id, 'Selecting an existing Photo did not link it to the Memory.');\n\n    await request(`/memories/${existingPhotoMemory.id}`, { method: 'DELETE', token: b.accessToken, expected: 204 });\n    const preservedStandalone = await request<{ photo: Json }>(`/photos/${standalonePhoto.id}`, { token: a.accessToken });\n    assert(preservedStandalone.photo.linked_memory_id == null, 'Deleting a Memory did not unlink its Photo.');\n    const albumAfterMemoryDelete = await request<{ album: Json; photos: Json[] }>(`/photo-albums/${photoAlbum.id}`, { token: b.accessToken });\n    assert(albumAfterMemoryDelete.photos.some((item) => item.id === standalonePhoto.id), 'Deleting a linked Memory removed its Photo from a standalone Photo Album.');\n\n    await request(`/photo-albums/${photoAlbum.id}`, { method: 'DELETE', token: a.accessToken, expected: 204 });\n    const photoAfterAlbumDelete = await request<{ photo: Json }>(`/photos/${standalonePhoto.id}`, { token: b.accessToken });\n    assert(photoAfterAlbumDelete.photo.id === standalonePhoto.id, 'Deleting a Photo Album deleted its Photos.');\n\n    console.log('PASS standalone Photos, photo albums, Memory linking/unlinking, preservation and cross-couple isolation');\n";

function fail(message) {
  console.error(`\n[RC] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(full, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  return { source: source.replace(/\r\n/g, '\n'), eol: source.includes('\r\n') ? '\r\n' : '\n' };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function guardCompletedPhases() {
  const guards = [
    ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
    ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['src/app/features/photos.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['server/migrations/019_memory_photo_integration.sql', 'H3_MEMORY_PHOTO_INTEGRATION'],
    ['src/app/features/memories.tsx', 'H3_MEMORY_PHOTO_INTEGRATION'],
    ['src/components/scratchpad/FullscreenScratchpadDrawing.tsx', 'I1_FULLSCREEN_SCRATCHPAD_DRAWING'],
    ['src/components/common/DrawingCanvas.tsx', 'I2_DRAWING_PERFORMANCE_HARDENING'],
    ['scripts/i3-ui-regression-audit.mjs', 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY'],
    ['scripts/i3-ui-regression-audit.mjs', 'I3_LOVE_TAP_AUDIT_REPAIR'],
  ];

  const failures = [];
  for (const [file, marker] of guards) {
    const source = read(file).replace(/\r\n/g, '\n');
    if (!source.includes(marker)) failures.push(`${file} missing ${marker}`);
  }
  if (failures.length) fail(`Completed-phase guard failed before any RC write:\n- ${failures.join('\n- ')}`);
}

function prepareNewFile(relativePath, output, eol) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) return { relativePath, output, eol, write: true };

  const raw = fs.readFileSync(full, 'utf8');
  const existing = raw.replace(/\r\n/g, '\n');
  const existingEol = raw.includes('\r\n') ? '\r\n' : '\n';
  if (!existing.includes(MARKER)) throw new Error(`${relativePath} already exists without RC marker; refusing to overwrite unrelated work.`);
  return { relativePath, output: existing, eol: existingEol, write: false };
}

function prepareSmoke() {
  const { source, eol } = sourceWithEol('server/src/smoke.ts');
  if (source.includes(MARKER)) return { relativePath: 'server/src/smoke.ts', output: source, eol, write: false };

  const anchor = "    console.log('PASS multi-photo memories, albums, timeline and memory jar');\n";
  const output = replaceOnce(
    source,
    anchor,
    `${anchor}${smokeBlock}\n`,
    'RC standalone Photos smoke insertion',
  );
  return { relativePath: 'server/src/smoke.ts', output, eol, write: true };
}

function run(command, label) {
  console.log(`\n[RC] ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes remain in place for a targeted repair.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[RC] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const reference = sourceWithEol('scripts/i3-ui-regression-audit.mjs');
  pending = [
    prepareSmoke(),
    prepareNewFile('scripts/rc-release-candidate-audit.mjs', auditSource, reference.eol),
  ];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Every modified output is prepared before the first source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[RC] ${item.relativePath}: already ready`);
    continue;
  }
  const full = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[RC] ${item.relativePath}: ready`);
}

run('node scripts/rc-release-candidate-audit.mjs', 'Static release-candidate audit');
run('node scripts/i3-ui-regression-audit.mjs', 'I3 UI regression gate');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  run('npm.cmd run typecheck', 'Client typecheck');
  run('npm.cmd --prefix server run typecheck', 'Server typecheck');
  run('npm.cmd --prefix server run logic', 'Deterministic logic suite');
  run('npm.cmd --prefix server run smoke', 'Live PostgreSQL/API/WebSocket smoke suite');
}

console.log('\n[RC] ALL VALIDATIONS PASSED');
console.log('[RC] Code/integration release-candidate gate passed.');
console.log('[RC] Resolve reported deployment warnings before signed App Store / Play Store distribution.');
