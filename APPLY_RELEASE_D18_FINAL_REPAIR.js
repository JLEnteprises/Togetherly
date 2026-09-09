const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD18 Final Repair FAILED: ${message}`);
  process.exit(1);
}

function full(rel) {
  return path.join(root, ...rel.split('/'));
}

function read(rel) {
  const file = full(rel);
  if (!fs.existsSync(file)) fail(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function requireMarker(rel, marker, label = marker) {
  const source = read(rel);
  if (!source.includes(marker)) fail(`UX regression audit: ${rel} is missing ${label}.`);
}

function forbidMarker(rel, marker, label = marker) {
  const source = read(rel);
  if (source.includes(marker)) fail(`UX regression audit: ${rel} still contains ${label}.`);
}

function runNpm(args, label, allowFailure = false) {
  console.log(`\n> ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) {
    if (allowFailure) {
      console.warn(`${label} could not start: ${result.error.message}`);
      return false;
    }
    fail(`${label} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    if (allowFailure) {
      console.warn(`${label} exited with code ${result.status}; continuing cleanup.`);
      return false;
    }
    fail(`${label} exited with code ${result.status}.`);
  }
  return true;
}

// -----------------------------------------------------------------------------
// Clean up Expo's accidental first-run lint mutation.
// -----------------------------------------------------------------------------
console.log('Checking for Expo first-run lint setup changes...');

const packagePath = full('package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
let packageChanged = false;

if (pkg.devDependencies?.eslint) {
  delete pkg.devDependencies.eslint;
  packageChanged = true;
  console.log('Removed accidental devDependency: eslint');
}

if (pkg.devDependencies?.['eslint-config-expo']) {
  delete pkg.devDependencies['eslint-config-expo'];
  packageChanged = true;
  console.log('Removed accidental devDependency: eslint-config-expo');
}

if (packageChanged) {
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

for (const name of ['eslint.config.js', 'eslint.config.mjs', '.eslintrc.js', '.eslintrc.json']) {
  const candidate = full(name);
  if (!fs.existsSync(candidate)) continue;

  const text = fs.readFileSync(candidate, 'utf8');
  const looksExpoGenerated =
    text.includes('eslint-config-expo') ||
    text.includes('expo/flat') ||
    text.includes('defineConfig');

  if (looksExpoGenerated) {
    fs.unlinkSync(candidate);
    console.log(`Removed Expo-generated lint config: ${name}`);
  }
}

// Reconcile package-lock/node_modules after removing the accidental dev deps.
// npm install is deliberate here so package-lock no longer retains the transient lint setup.
runNpm(['install', '--ignore-scripts'], 'Reconcile package-lock after lint cleanup');

// -----------------------------------------------------------------------------
// D18 source-level regression audit.
// -----------------------------------------------------------------------------
console.log('\nChecking D18 source patches and roadmap anchors...');

requireMarker(
  'src/components/common/CollapsibleComposer.tsx',
  "const isEditing = /^edit\\b/i.test(title.trim());",
  'edit-mode inference',
);
requireMarker(
  'src/components/common/CollapsibleComposer.tsx',
  "{isEditing ? 'QUICK EDIT' : 'QUICK ADD'}",
  'correct quick sheet caption',
);
forbidMarker(
  'src/components/common/CollapsibleComposer.tsx',
  "{open ? 'QUICK EDIT' : 'QUICK CREATE'}",
  'old always-edit caption',
);

requireMarker(
  'src/components/common/CollapsibleComposer.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'slide'}",
);
requireMarker(
  'src/components/common/RecordViewSheet.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'slide'}",
);
requireMarker(
  'src/components/dashboard/HomeConnectionActions.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'slide'}",
);
requireMarker(
  'src/components/common/CelebrationMoment.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'fade'}",
);
requireMarker(
  'src/components/common/CelebrationMoment.tsx',
  'progress.setValue(theme.reducedMotion ? 1 : 0);',
);

requireMarker(
  'src/components/common/RecordViewSheet.tsx',
  'Close this view, then use ••• on the card for any edit or delete options.',
);

const tabs = read('src/app/(tabs)/_layout.tsx');
for (const screen of ['index', 'plan', 'together', 'us', 'more']) {
  if (!tabs.includes(`<Tabs.Screen name="${screen}"`)) {
    fail(`UX regression audit: missing ${screen} tab.`);
  }
}

requireMarker('src/app/(tabs)/index.tsx', '<HomeTodayCard />');
requireMarker('src/app/(tabs)/index.tsx', '<HomeConnectionActions />');
requireMarker(
  'src/components/dashboard/HomeTodayCard.tsx',
  'The relationship moment that matters most right now.',
);
requireMarker(
  'src/components/dashboard/HomeTodayCard.tsx',
  '<AppText variant="section">Life today</AppText>',
);

requireMarker('src/app/(tabs)/together.tsx', '<PartnerPresencePill scope="together" />');
requireMarker('src/app/(tabs)/together.tsx', '<HomeConnectionActions />');
requireMarker('src/app/(tabs)/together.tsx', 'title="Check in together"');
forbidMarker('src/app/(tabs)/together.tsx', '<ConnectionPingsCard />');

requireMarker('src/hooks/usePartnerPresence.ts', 'partnerScope,');
requireMarker(
  'src/components/dashboard/SharedScratchpadCard.tsx',
  "partnerScope?.startsWith('scratchpad:')",
);
requireMarker(
  'src/app/features/games/[id].tsx',
  "const gamePresenceScope = id ? `game:${id}` : 'game:loading';",
);
requireMarker(
  'src/app/features/notes.tsx',
  "const notePresenceScope = presenceNote ? `note:${presenceNote.id}:${notePresenceMode}` : 'note:none';",
);

requireMarker('src/app/(tabs)/us.tsx', 'Explore your story');
requireMarker('src/app/(tabs)/plan.tsx', 'title="Day to day"');
requireMarker('src/app/features/trip-detail.tsx', 'Everything for the trip');
requireMarker('src/app/features/countdowns.tsx', 'NEXT THING WE');
requireMarker('src/app/features/activities.tsx', 'Both want this');
requireMarker('src/app/features/decision-tools.tsx', 'PartnerPresencePill');

console.log('D18 source-level UX regression audit clean.');

// -----------------------------------------------------------------------------
// Trusted project validations.
// -----------------------------------------------------------------------------
runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

// Package sanity after cleanup.
const finalPkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (finalPkg.devDependencies?.eslint || finalPkg.devDependencies?.['eslint-config-expo']) {
  fail('Transient Expo lint dependencies are still present after cleanup.');
}

console.log('\nD18 UX Regression & Hardening completed successfully.');
console.log('The current UX roadmap is clean.');
console.log('No migration is required.');
console.log('Expo lint was intentionally excluded because its first-run bootstrap mutated the project and failed inside Expo CLI itself.');
