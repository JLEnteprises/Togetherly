const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'I3 — UI Regression / Cross-tab Consistency';
const MARKER = 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY';
const root = process.cwd();
const auditSource = "import fs from 'node:fs';\nimport path from 'node:path';\n\nconst root = process.cwd();\nconst MARKER = 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY';\n\nfunction fail(message) {\n  console.error(`FAIL ${message}`);\n  process.exitCode = 1;\n}\n\nfunction pass(message) {\n  console.log(`PASS ${message}`);\n}\n\nfunction read(relativePath) {\n  const fullPath = path.join(root, relativePath);\n  if (!fs.existsSync(fullPath)) {\n    fail(`missing ${relativePath}`);\n    return '';\n  }\n  return fs.readFileSync(fullPath, 'utf8').replace(/\\r\\n/g, '\\n');\n}\n\nfunction expect(relativePath, checks) {\n  const source = read(relativePath);\n  if (!source) return;\n  for (const [label, predicate] of checks) {\n    if (predicate(source)) pass(`${relativePath}: ${label}`);\n    else fail(`${relativePath}: ${label}`);\n  }\n}\n\nfunction count(source, token) {\n  return source.split(token).length - 1;\n}\n\nfunction walk(dir) {\n  if (!fs.existsSync(dir)) return [];\n  const output = [];\n  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {\n    const full = path.join(dir, entry.name);\n    if (entry.isDirectory()) output.push(...walk(full));\n    else output.push(full);\n  }\n  return output;\n}\n\nfunction routePatternForFile(fullPath) {\n  const relative = path.relative(path.join(root, 'src', 'app'), fullPath).replaceAll('\\\\', '/');\n  if (!/\\.(tsx|ts)$/.test(relative)) return null;\n  const noExt = relative.replace(/\\.(tsx|ts)$/, '');\n  const segments = noExt.split('/').filter((segment) => segment && !segment.startsWith('('));\n  if (segments.at(-1) === '_layout') return null;\n  if (segments.at(-1) === 'index') segments.pop();\n  return `/${segments.join('/')}`;\n}\n\nfunction routeMatches(pattern, literalPath) {\n  const clean = literalPath.split('?')[0].split('#')[0];\n  const patternParts = pattern.split('/').filter(Boolean);\n  const pathParts = clean.split('/').filter(Boolean);\n  if (patternParts.length !== pathParts.length) return false;\n  return patternParts.every((part, index) => /^\\[[^\\]]+\\]$/.test(part) || part === pathParts[index]);\n}\n\nconsole.log('Togetherly I3 — UI regression / cross-tab consistency');\nconsole.log(`Marker: ${MARKER}`);\n\n// -----------------------------------------------------------------------------\n// 1. Literal navigation integrity / no obvious dead feature destinations.\n// -----------------------------------------------------------------------------\nconst appFiles = walk(path.join(root, 'src', 'app')).filter((file) => /\\.(tsx|ts)$/.test(file));\nconst routePatterns = appFiles.map(routePatternForFile).filter(Boolean);\n\nconst sourceFiles = walk(path.join(root, 'src')).filter((file) => /\\.(tsx|ts)$/.test(file));\nconst literalFeatureRoutes = new Set();\n\nfor (const file of sourceFiles) {\n  const source = fs.readFileSync(file, 'utf8');\n  const regex = /['\"](\\/features\\/[A-Za-z0-9_./-]+(?:\\?[^'\"]*)?)['\"]/g;\n  let match;\n  while ((match = regex.exec(source))) literalFeatureRoutes.add(match[1]);\n}\n\nconst missingRoutes = [...literalFeatureRoutes]\n  .filter((literal) => !routePatterns.some((pattern) => routeMatches(pattern, literal)))\n  .sort();\n\nif (missingRoutes.length) {\n  fail(`literal feature navigation has missing destinations: ${missingRoutes.join(', ')}`);\n} else {\n  pass(`${literalFeatureRoutes.size} literal feature navigation destinations resolve`);\n}\n\n// -----------------------------------------------------------------------------\n// 2. Home/Together canonical ownership — no duplicate generic CTAs.\n// -----------------------------------------------------------------------------\nexpect('src/app/(tabs)/index.tsx', [\n  ['Home keeps contextual connection actions', (s) => s.includes('<HomeConnectionActions />')],\n  ['Home does not directly own the mood route', (s) => !s.includes('/features/mood')],\n]);\n\nexpect('src/components/dashboard/HomeConnectionActions.tsx', [\n  ['home/together contexts remain explicit', (s) => s.includes(\"context?: 'home' | 'together'\") && s.includes(\"const together = context === 'together'\")],\n  ['mood route appears exactly once and is Together-only', (s) => count(s, \"router.push('/features/mood'\") === 1 && s.includes('{together ? (')],\n  ['Love Tap remains a small direct signal', (s) => s.includes('label=\"Love Tap\"')],\n  ['Thinking of you remains a small direct signal', (s) => s.includes(\"label={recentSignal === 'thinking_of_you'\")],\n]);\n\nexpect('src/components/dashboard/HomeQuickActions.tsx', [\n  ['Home quick slot is active-game-only', (s) => s.includes('if (!activeGame) return null;') && s.includes('Continue {activeGame.title}')],\n  ['no generic feature-home shortcuts returned to Home', (s) => !s.includes('/features/play-together') && !s.includes('/features/activities') && !s.includes('/features/memories')],\n]);\n\nexpect('src/components/together/TogetherHubGroups.tsx', [\n  ['Together uses exclusive expansion', (s) => s.includes('useExclusiveExpandedGroup<TogetherGroupKey>()')],\n  ['check-in does not duplicate Mood navigation', (s) => !s.includes(\"href: '/features/mood'\")],\n  ['check-in owns Daily Question and Location', (s) => s.includes(\"href: '/features/daily-question'\") && s.includes(\"href: '/features/location'\")],\n  ['play owns Play Together', (s) => s.includes(\"href: '/features/play-together'\")],\n  ['things-to-do owns Date Ideas', (s) => s.includes(\"href: '/features/activities'\")],\n]);\n\n// -----------------------------------------------------------------------------\n// 3. Plan/Us hierarchy and duplicate-navigation checks.\n// -----------------------------------------------------------------------------\nexpect('src/components/plan/PlanHubGroups.tsx', [\n  ['Plan uses exclusive expansion', (s) => s.includes('useExclusiveExpandedGroup<PlanGroupKey>()')],\n  ['Day to day owns Tasks/Lists/Notes once each', (s) => count(s, \"href: '/features/tasks'\") === 1 && count(s, \"href: '/features/lists'\") === 1 && count(s, \"href: '/features/notes'\") === 1],\n  ['Dates & time owns Calendar/Countdowns/Availability once each', (s) => count(s, \"href: '/features/calendar'\") === 1 && count(s, \"href: '/features/countdowns'\") === 1 && count(s, \"href: '/features/availability'\") === 1],\n  ['Looking ahead owns Trips/Goals once each', (s) => count(s, \"href: '/features/trips'\") === 1 && count(s, \"href: '/features/goals'\") === 1],\n]);\n\nexpect('src/components/us/UsStoryDashboard.tsx', [\n  ['Us owns one Memories destination', (s) => count(s, 'href=\"/features/memories\"') === 1],\n  ['Us owns one Photos destination', (s) => count(s, 'href=\"/features/photos\"') === 1],\n  ['Us owns one Timeline destination', (s) => count(s, 'href=\"/features/timeline\"') === 1],\n  ['Rediscover owns Memory Jar', (s) => s.includes(\"href: '/features/memory-jar'\")],\n  ['Us photo summary is first-class Photos data', (s) => s.includes('getPhotos()') && s.includes('getPhotoAlbums()')],\n]);\n\nexpect('src/app/features/memories.tsx', [\n  ['Memories does not re-add story navigation', (s) => !s.includes('FeatureGroupCard') && !s.includes('title=\"Our story\"')],\n]);\n\n// -----------------------------------------------------------------------------\n// 4. Expandable group behavior + accessibility.\n// -----------------------------------------------------------------------------\nexpect('src/components/navigation/ExpandableFeatureGroup.tsx', [\n  ['expanded state is exposed to accessibility', (s) => s.includes('accessibilityState={{ expanded: open }}')],\n  ['header toggles controlled/uncontrolled state', (s) => s.includes('if (expanded === undefined) setLocalExpanded(next);') && s.includes('onExpandedChange?.(next);')],\n  ['disabled child actions are communicated', (s) => s.includes('accessibilityState={{ disabled: !activate }}') && s.includes('disabled={!activate}')],\n]);\n\n// -----------------------------------------------------------------------------\n// 5. Back behavior and sheets.\n// -----------------------------------------------------------------------------\nexpect('src/components/common/BackHeader.tsx', [\n  ['Back is a real accessible button', (s) => s.includes('accessibilityRole=\"button\"') && s.includes('accessibilityLabel=\"Back\"')],\n  ['custom nested back behavior remains supported', (s) => s.includes('onBack?: () => void') && s.includes('(onBack ?? (() => router.back()))();')],\n]);\n\nexpect('src/components/common/ComposerSheet.tsx', [\n  ['sheet remains modal', (s) => s.includes('<Modal') && s.includes('visible={open}')],\n  ['sheet remains keyboard safe and scrollable', (s) => s.includes('<KeyboardAvoidingView') && s.includes('<ScrollView')],\n  ['sheet supports native/back close', (s) => s.includes('onRequestClose={toggle}')],\n  ['sheet close action is accessible', (s) => count(s, 'accessibilityLabel={closeLabel}') >= 2],\n]);\n\nconst composerScreens = [\n  'tasks.tsx',\n  'calendar.tsx',\n  'notes.tsx',\n  'lists.tsx',\n  'goals.tsx',\n  'trips.tsx',\n  'countdowns.tsx',\n  'memories.tsx',\n  'activities.tsx',\n  'photos.tsx',\n];\n\nfor (const name of composerScreens) {\n  expect(`src/app/features/${name}`, [\n    ['major create/edit flow uses ComposerSheet', (s) => s.includes(\"from '@/components/common/ComposerSheet'\") && s.includes('<ComposerSheet')],\n    ['legacy CollapsibleComposer is not reintroduced', (s) => !s.includes('CollapsibleComposer')],\n  ]);\n}\n\n// -----------------------------------------------------------------------------\n// 6. Photo flow consistency.\n// -----------------------------------------------------------------------------\nexpect('src/app/features/photos.tsx', [\n  ['Photos is first-class standalone data', (s) => s.includes('H2_STANDALONE_PHOTO_GALLERY') && s.includes('getPhotos') && s.includes('createPhoto')],\n  ['photo tap uses PhotoViewer', (s) => s.includes('<PhotoViewer')],\n  ['legacy MemoryDetailModal is absent from Photos', (s) => !s.includes('MemoryDetailModal') && !s.includes('getMemoryAlbums')],\n]);\n\nexpect('src/app/features/memories.tsx', [\n  ['Memories integrates first-class Photos', (s) => s.includes('H3_MEMORY_PHOTO_INTEGRATION') && s.includes('getPhotos()') && s.includes('<MemoryPhotoField')],\n  ['Memory photo taps use PhotoViewer', (s) => s.includes('<PhotoViewer') && s.includes('openMemoryPhoto')],\n  ['Memories refreshes on photo realtime', (s) => s.includes(\"useRealtimeRefresh('photos'\")],\n]);\n\nexpect('src/components/photos/PhotoViewer.tsx', [\n  ['viewer is fullscreen', (s) => s.includes('presentationStyle=\"fullScreen\"')],\n  ['viewer is swipe-paged', (s) => s.includes('pagingEnabled')],\n  ['viewer close is accessible', (s) => s.includes('accessibilityLabel=\"Close photo viewer\"')],\n  ['Memory navigation remains secondary', (s) => s.includes('View memory') && s.includes('linked_memory_id')],\n]);\n\n// -----------------------------------------------------------------------------\n// 7. Scratchpad collaboration/performance consistency.\n// -----------------------------------------------------------------------------\nexpect('src/components/dashboard/SharedScratchpadCard.tsx', [\n  ['I1 fullscreen state remains connected', (s) => s.includes('I1_FULLSCREEN_SCRATCHPAD_DRAWING') && s.includes('<FullscreenScratchpadDrawing')],\n  ['I2 performance hardening remains connected', (s) => s.includes('I2_DRAWING_PERFORMANCE_HARDENING')],\n  ['partner presence remains connected', (s) => s.includes('usePartnerPresence') && s.includes('partnerInScratchpad')],\n  ['conflict protection remains connected', (s) => s.includes('remoteUpdate') && s.includes('updatedAt: item?.updated_at ?? null')],\n  ['no 120-stroke disappearance regression', (s) => !s.includes('.slice(-120)')],\n  ['no whole-drawing JSON stringify dirty regression', (s) => !s.includes('JSON.stringify(strokes)')],\n]);\n\nexpect('src/components/common/DrawingCanvas.tsx', [\n  ['committed strokes remain memoized', (s) => s.includes('const CommittedStrokeLayer = memo(')],\n  ['live stroke layer remains separate', (s) => s.includes('LiveStrokeLayer')],\n  ['live rendering remains frame-throttled', (s) => s.includes('requestAnimationFrame') && s.includes('scheduleDraftRender')],\n  ['point simplification remains active', (s) => s.includes('simplifyPoints') && s.includes('MIN_POINT_DISTANCE')],\n  ['old 500-point truncation is absent', (s) => !s.includes('.slice(-500)')],\n]);\n\nexpect('src/components/scratchpad/FullscreenScratchpadDrawing.tsx', [\n  ['fullscreen workspace remains full screen', (s) => s.includes('presentationStyle=\"fullScreen\"')],\n  ['presence remains visible fullscreen', (s) => s.includes('partnerSameMode') && s.includes('partnerInScratchpad')],\n  ['save/undo/clear remain available', (s) => s.includes(\"label={saving ? 'Saving…' : 'Save'}\") && s.includes('label=\"Undo mine\"') && s.includes('label=\"Clear\"')],\n]);\n\n// -----------------------------------------------------------------------------\n// 8. Participant identity principles — broad regression guards.\n// -----------------------------------------------------------------------------\nexpect('src/app/(tabs)/together.tsx', [\n  ['Together keeps paired identity signature', (s) => s.includes('<CoupleIdentitySignature')],\n]);\n\nexpect('src/app/(tabs)/us.tsx', [\n  ['Us keeps paired identity signature', (s) => s.includes('<CoupleIdentitySignature')],\n]);\n\nconst planSource = read('src/components/plan/PlanHubGroups.tsx');\nif (planSource) {\n  if (!planSource.includes('participantColor=')) pass('Plan generic navigation remains neutral');\n  else fail('Plan generic navigation unexpectedly gained participant ownership colour');\n}\n\nif (process.exitCode) {\n  console.error('\\nI3 UI REGRESSION AUDIT FAILED');\n  process.exit(process.exitCode);\n}\n\nconsole.log('\\nI3 UI REGRESSION AUDIT PASSED');\n";

function fail(message) {
  console.error(`\n[I3] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function guardCompletedPhases() {
  const guards = [
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
    ['src/components/dashboard/SharedScratchpadCard.tsx', 'I2_DRAWING_PERFORMANCE_HARDENING'],
  ];

  const failures = [];
  for (const [relativePath, marker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(marker)) failures.push(`${relativePath} missing ${marker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before I3 audit installation:\n- ${failures.join('\n- ')}`);
}

function prepareAudit() {
  const reference = sourceWithEol('src/components/navigation/ExpandableFeatureGroup.tsx');
  const relativePath = 'scripts/i3-ui-regression-audit.mjs';
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { relativePath, output: auditSource, eol: reference.eol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the I3 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function run(command, label) {
  console.log(`\n[I3] ${label}`);
  let result;

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[I3] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  pending = [prepareAudit()];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// The only source addition is fully prepared before the first write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[I3] ${item.relativePath}: already ready`);
    continue;
  }
  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[I3] ${item.relativePath}: ready`);
}

run('node scripts/i3-ui-regression-audit.mjs', 'UI regression / cross-tab consistency audit');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  run('npm.cmd run typecheck', 'Client typecheck');
  run('npm.cmd --prefix server run typecheck', 'Server typecheck');
  run('npm.cmd --prefix server run logic', 'Server logic');
}

console.log('\n[I3] ALL VALIDATIONS PASSED');
console.log('[I3] No runtime UI rewrite, migration, or dependency change was required.');
