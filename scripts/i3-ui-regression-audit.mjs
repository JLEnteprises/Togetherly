import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const MARKER = 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY';

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
}

function expect(relativePath, checks) {
  const source = read(relativePath);
  if (!source) return;
  for (const [label, predicate] of checks) {
    if (predicate(source)) pass(`${relativePath}: ${label}`);
    else fail(`${relativePath}: ${label}`);
  }
}

function count(source, token) {
  return source.split(token).length - 1;
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

function routePatternForFile(fullPath) {
  const relative = path.relative(path.join(root, 'src', 'app'), fullPath).replaceAll('\\', '/');
  if (!/\.(tsx|ts)$/.test(relative)) return null;
  const noExt = relative.replace(/\.(tsx|ts)$/, '');
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

console.log('Togetherly I3 — UI regression / cross-tab consistency');
console.log(`Marker: ${MARKER}`);

// -----------------------------------------------------------------------------
// 1. Literal navigation integrity / no obvious dead feature destinations.
// -----------------------------------------------------------------------------
const appFiles = walk(path.join(root, 'src', 'app')).filter((file) => /\.(tsx|ts)$/.test(file));
const routePatterns = appFiles.map(routePatternForFile).filter(Boolean);

const sourceFiles = walk(path.join(root, 'src')).filter((file) => /\.(tsx|ts)$/.test(file));
const literalFeatureRoutes = new Set();

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const regex = /['"](\/features\/[A-Za-z0-9_./-]+(?:\?[^'"]*)?)['"]/g;
  let match;
  while ((match = regex.exec(source))) literalFeatureRoutes.add(match[1]);
}

const missingRoutes = [...literalFeatureRoutes]
  .filter((literal) => !routePatterns.some((pattern) => routeMatches(pattern, literal)))
  .sort();

if (missingRoutes.length) {
  fail(`literal feature navigation has missing destinations: ${missingRoutes.join(', ')}`);
} else {
  pass(`${literalFeatureRoutes.size} literal feature navigation destinations resolve`);
}

// -----------------------------------------------------------------------------
// 2. Home/Together canonical ownership — no duplicate generic CTAs.
// -----------------------------------------------------------------------------
expect('src/app/(tabs)/index.tsx', [
  ['Home keeps contextual connection actions', (s) => s.includes('<HomeConnectionActions />')],
  ['Home does not directly own the mood route', (s) => !s.includes('/features/mood')],
]);

expect('src/components/dashboard/HomeConnectionActions.tsx', [
  ['home/together contexts remain explicit', (s) => s.includes("context?: 'home' | 'together'") && s.includes("const together = context === 'together'")],
  ['mood route appears exactly once and is Together-only', (s) => count(s, "router.push('/features/mood'") === 1 && s.includes('{together ? (')],
  // I3_LOVE_TAP_AUDIT_REPAIR: Love Tap uses a dynamic sent/sending/default label, so audit the actual dynamic branch rather than a static JSX label.
  ['Love Tap remains a small direct signal', (s) => s.includes("label={recentSignal === 'love'") && s.includes("'Love Tap'")],
  ['Thinking of you remains a small direct signal', (s) => s.includes("label={recentSignal === 'thinking_of_you'")],
]);

expect('src/components/dashboard/HomeQuickActions.tsx', [
  ['Home quick slot is active-game-only', (s) => s.includes('if (!activeGame) return null;') && s.includes('Continue {activeGame.title}')],
  ['no generic feature-home shortcuts returned to Home', (s) => !s.includes('/features/play-together') && !s.includes('/features/activities') && !s.includes('/features/memories')],
]);

expect('src/components/together/TogetherHubGroups.tsx', [
  ['Together uses exclusive expansion', (s) => s.includes('useExclusiveExpandedGroup<TogetherGroupKey>()')],
  ['check-in does not duplicate Mood navigation', (s) => !s.includes("href: '/features/mood'")],
  ['check-in owns Daily Question and Location', (s) => s.includes("href: '/features/daily-question'") && s.includes("href: '/features/location'")],
  ['play owns Play Together', (s) => s.includes("href: '/features/play-together'")],
  ['things-to-do owns Date Ideas', (s) => s.includes("href: '/features/activities'")],
]);

// -----------------------------------------------------------------------------
// 3. Plan/Us hierarchy and duplicate-navigation checks.
// -----------------------------------------------------------------------------
expect('src/components/plan/PlanHubGroups.tsx', [
  ['Plan uses exclusive expansion', (s) => s.includes('useExclusiveExpandedGroup<PlanGroupKey>()')],
  ['Day to day owns Tasks/Lists/Notes once each', (s) => count(s, "href: '/features/tasks'") === 1 && count(s, "href: '/features/lists'") === 1 && count(s, "href: '/features/notes'") === 1],
  ['Dates & time owns Calendar/Countdowns/Availability once each', (s) => count(s, "href: '/features/calendar'") === 1 && count(s, "href: '/features/countdowns'") === 1 && count(s, "href: '/features/availability'") === 1],
  ['Looking ahead owns Trips/Goals once each', (s) => count(s, "href: '/features/trips'") === 1 && count(s, "href: '/features/goals'") === 1],
]);

expect('src/components/us/UsStoryDashboard.tsx', [
  ['Us owns one Memories destination', (s) => count(s, 'href="/features/memories"') === 1],
  ['Us owns one Photos destination', (s) => count(s, 'href="/features/photos"') === 1],
  ['Us owns one Timeline destination', (s) => count(s, 'href="/features/timeline"') === 1],
  ['Rediscover owns Memory Jar', (s) => s.includes("href: '/features/memory-jar'")],
  ['Us photo summary is first-class Photos data', (s) => s.includes('getPhotos()') && s.includes('getPhotoAlbums()')],
]);

expect('src/app/features/memories.tsx', [
  ['Memories does not re-add story navigation', (s) => !s.includes('FeatureGroupCard') && !s.includes('title="Our story"')],
]);

// -----------------------------------------------------------------------------
// 4. Expandable group behavior + accessibility.
// -----------------------------------------------------------------------------
expect('src/components/navigation/ExpandableFeatureGroup.tsx', [
  ['expanded state is exposed to accessibility', (s) => s.includes('accessibilityState={{ expanded: open }}')],
  ['header toggles controlled/uncontrolled state', (s) => s.includes('if (expanded === undefined) setLocalExpanded(next);') && s.includes('onExpandedChange?.(next);')],
  ['disabled child actions are communicated', (s) => s.includes('accessibilityState={{ disabled: !activate }}') && s.includes('disabled={!activate}')],
]);

// -----------------------------------------------------------------------------
// 5. Back behavior and sheets.
// -----------------------------------------------------------------------------
expect('src/components/common/BackHeader.tsx', [
  ['Back is a real accessible button', (s) => s.includes('accessibilityRole="button"') && s.includes('accessibilityLabel="Back"')],
  ['custom nested back behavior remains supported', (s) => s.includes('onBack?: () => void') && s.includes('(onBack ?? (() => router.back()))();')],
]);

expect('src/components/common/ComposerSheet.tsx', [
  ['sheet remains modal', (s) => s.includes('<Modal') && s.includes('visible={open}')],
  ['sheet remains keyboard safe and scrollable', (s) => s.includes('<KeyboardAvoidingView') && s.includes('<ScrollView')],
  ['sheet supports native/back close', (s) => s.includes('onRequestClose={toggle}')],
  ['sheet close action is accessible', (s) => count(s, 'accessibilityLabel={closeLabel}') >= 2],
]);

const composerScreens = [
  'tasks.tsx',
  'calendar.tsx',
  'notes.tsx',
  'lists.tsx',
  'goals.tsx',
  'trips.tsx',
  'countdowns.tsx',
  'memories.tsx',
  'activities.tsx',
  'photos.tsx',
];

for (const name of composerScreens) {
  expect(`src/app/features/${name}`, [
    ['major create/edit flow uses ComposerSheet', (s) => s.includes("from '@/components/common/ComposerSheet'") && s.includes('<ComposerSheet')],
    ['legacy CollapsibleComposer is not reintroduced', (s) => !s.includes('CollapsibleComposer')],
  ]);
}

// -----------------------------------------------------------------------------
// 6. Photo flow consistency.
// -----------------------------------------------------------------------------
expect('src/app/features/photos.tsx', [
  ['Photos is first-class standalone data', (s) => s.includes('H2_STANDALONE_PHOTO_GALLERY') && s.includes('getPhotos') && s.includes('createPhoto')],
  ['photo tap uses PhotoViewer', (s) => s.includes('<PhotoViewer')],
  ['legacy MemoryDetailModal is absent from Photos', (s) => !s.includes('MemoryDetailModal') && !s.includes('getMemoryAlbums')],
]);

expect('src/app/features/memories.tsx', [
  ['Memories integrates first-class Photos', (s) => s.includes('H3_MEMORY_PHOTO_INTEGRATION') && s.includes('getPhotos()') && s.includes('<MemoryPhotoField')],
  ['Memory photo taps use PhotoViewer', (s) => s.includes('<PhotoViewer') && s.includes('openMemoryPhoto')],
  ['Memories refreshes on photo realtime', (s) => s.includes("useRealtimeRefresh('photos'")],
]);

expect('src/components/photos/PhotoViewer.tsx', [
  ['viewer is fullscreen', (s) => s.includes('presentationStyle="fullScreen"')],
  ['viewer is swipe-paged', (s) => s.includes('pagingEnabled')],
  ['viewer close is accessible', (s) => s.includes('accessibilityLabel="Close photo viewer"')],
  ['Memory navigation remains secondary', (s) => s.includes('View memory') && s.includes('linked_memory_id')],
]);

// -----------------------------------------------------------------------------
// 7. Scratchpad collaboration/performance consistency.
// -----------------------------------------------------------------------------
expect('src/components/dashboard/SharedScratchpadCard.tsx', [
  ['I1 fullscreen state remains connected', (s) => s.includes('I1_FULLSCREEN_SCRATCHPAD_DRAWING') && s.includes('<FullscreenScratchpadDrawing')],
  ['I2 performance hardening remains connected', (s) => s.includes('I2_DRAWING_PERFORMANCE_HARDENING')],
  ['partner presence remains connected', (s) => s.includes('usePartnerPresence') && s.includes('partnerInScratchpad')],
  ['conflict protection remains connected', (s) => s.includes('remoteUpdate') && s.includes('updatedAt: item?.updated_at ?? null')],
  ['no 120-stroke disappearance regression', (s) => !s.includes('.slice(-120)')],
  ['no whole-drawing JSON stringify dirty regression', (s) => !s.includes('JSON.stringify(strokes)')],
]);

expect('src/components/common/DrawingCanvas.tsx', [
  ['committed strokes remain memoized', (s) => s.includes('const CommittedStrokeLayer = memo(')],
  ['live stroke layer remains separate', (s) => s.includes('LiveStrokeLayer')],
  ['live rendering remains frame-throttled', (s) => s.includes('requestAnimationFrame') && s.includes('scheduleDraftRender')],
  ['point simplification remains active', (s) => s.includes('simplifyPoints') && s.includes('MIN_POINT_DISTANCE')],
  ['old 500-point truncation is absent', (s) => !s.includes('.slice(-500)')],
]);

expect('src/components/scratchpad/FullscreenScratchpadDrawing.tsx', [
  ['fullscreen workspace remains full screen', (s) => s.includes('presentationStyle="fullScreen"')],
  ['presence remains visible fullscreen', (s) => s.includes('partnerSameMode') && s.includes('partnerInScratchpad')],
  ['save/undo/clear remain available', (s) => s.includes("label={saving ? 'Saving…' : 'Save'}") && s.includes('label="Undo mine"') && s.includes('label="Clear"')],
]);

// -----------------------------------------------------------------------------
// 8. Participant identity principles — broad regression guards.
// -----------------------------------------------------------------------------
expect('src/app/(tabs)/together.tsx', [
  ['Together keeps paired identity signature', (s) => s.includes('<CoupleIdentitySignature')],
]);

expect('src/app/(tabs)/us.tsx', [
  ['Us keeps paired identity signature', (s) => s.includes('<CoupleIdentitySignature')],
]);

const planSource = read('src/components/plan/PlanHubGroups.tsx');
if (planSource) {
  if (!planSource.includes('participantColor=')) pass('Plan generic navigation remains neutral');
  else fail('Plan generic navigation unexpectedly gained participant ownership colour');
}

if (process.exitCode) {
  console.error('\nI3 UI REGRESSION AUDIT FAILED');
  process.exit(process.exitCode);
}

console.log('\nI3 UI REGRESSION AUDIT PASSED');
