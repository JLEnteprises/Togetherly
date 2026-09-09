const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD18 Repair FAILED: ${message}`);
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

console.log('Checking D18 patches already applied by the first installer...');

// D18 shared sheet fix.
// IMPORTANT: JS string uses \\b to represent the single backslash in the source regex.
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

// Reduced-motion coverage added by D18.
requireMarker(
  'src/components/common/CollapsibleComposer.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'slide'}",
  'composer reduced-motion handling',
);
requireMarker(
  'src/components/common/RecordViewSheet.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'slide'}",
  'record view reduced-motion handling',
);
requireMarker(
  'src/components/dashboard/HomeConnectionActions.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'slide'}",
  'quick mood reduced-motion handling',
);
requireMarker(
  'src/components/common/CelebrationMoment.tsx',
  "animationType={theme.reducedMotion ? 'none' : 'fade'}",
  'celebration modal reduced-motion handling',
);
requireMarker(
  'src/components/common/CelebrationMoment.tsx',
  'progress.setValue(theme.reducedMotion ? 1 : 0);',
  'celebration animation reduced-motion handling',
);

// Record view interaction hint.
requireMarker(
  'src/components/common/RecordViewSheet.tsx',
  'Close this view, then use ••• on the card for any edit or delete options.',
  'record-view action hint',
);

// Five-tab architecture.
const tabs = read('src/app/(tabs)/_layout.tsx');
for (const screen of ['index', 'plan', 'together', 'us', 'more']) {
  if (!tabs.includes(`<Tabs.Screen name="${screen}"`)) {
    fail(`UX regression audit: missing ${screen} tab.`);
  }
}

// Home hierarchy.
requireMarker('src/app/(tabs)/index.tsx', '<HomeTodayCard />', 'Home Today card');
requireMarker('src/app/(tabs)/index.tsx', '<HomeConnectionActions />', 'Home connection actions');
requireMarker(
  'src/components/dashboard/HomeTodayCard.tsx',
  'The relationship moment that matters most right now.',
);
requireMarker(
  'src/components/dashboard/HomeTodayCard.tsx',
  '<AppText variant="section">Life today</AppText>',
);

// Together shared lounge.
requireMarker('src/app/(tabs)/together.tsx', '<PartnerPresencePill scope="together" />');
requireMarker('src/app/(tabs)/together.tsx', '<HomeConnectionActions />');
requireMarker('src/app/(tabs)/together.tsx', 'title="Check in together"');
forbidMarker(
  'src/app/(tabs)/together.tsx',
  '<ConnectionPingsCard />',
  'duplicate ConnectionPingsCard',
);

// Presence rooms.
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

// Roadmap anchors.
requireMarker('src/app/(tabs)/us.tsx', 'Explore your story');
requireMarker('src/app/(tabs)/plan.tsx', 'title="Day to day"');
requireMarker('src/app/features/trip-detail.tsx', 'Everything for the trip');
requireMarker('src/app/features/countdowns.tsx', 'NEXT THING WE');
requireMarker('src/app/features/activities.tsx', 'Both want this');
requireMarker('src/app/features/decision-tools.tsx', 'PartnerPresencePill');

console.log('D18 source-level UX regression audit clean.');

function run(args, label) {
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

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}.`);
}

run(['run', 'typecheck'], 'Frontend typecheck');
run(['run', 'lint'], 'Frontend lint');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD18 UX Regression & Hardening repair completed successfully.');
console.log('Source audit, frontend typecheck, lint, server typecheck and server logic all passed.');
console.log('No migration is required.');
