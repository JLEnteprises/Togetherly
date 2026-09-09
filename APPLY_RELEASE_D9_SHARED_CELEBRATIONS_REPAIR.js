const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD9 Shared Celebrations repair FAILED: ${message}`);
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

function write(rel, text) {
  fs.writeFileSync(full(rel), text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) {
    console.log(`Already good: ${label}`);
    return text;
  }
  const first = text.indexOf(oldText);
  if (first < 0) fail(`Could not find expected source for: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) fail(`Multiple matches found for: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

// Confirm the partial D9 install reached the files it reported writing.
const partialRequired = [
  ['src/hooks/useCelebrationMoment.ts', 'export function useCelebrationMoment'],
  ['src/components/common/CelebrationMoment.tsx', 'export function CelebrationMoment'],
  ['src/app/features/tasks.tsx', "celebrate({ title: 'Done ✓'"],
  ['src/app/features/goals.tsx', "title: 'Goal reached ✦'"],
  ['src/app/features/daily-question.tsx', "title: 'A little more of us ♥'"],
];

for (const [rel, marker] of partialRequired) {
  if (!read(rel).includes(marker)) {
    fail(`The partial D9 install is missing ${marker} in ${rel}. Reapply the main D9 package first.`);
  }
}

const rel = 'src/app/features/activities.tsx';
let source = read(rel);

// Add CelebrationMoment component import.
if (!source.includes("import { CelebrationMoment } from '@/components/common/CelebrationMoment';")) {
  source = replaceOnce(
    source,
    "import { BackHeader } from '@/components/common/BackHeader';",
    "import { BackHeader } from '@/components/common/BackHeader';\nimport { CelebrationMoment } from '@/components/common/CelebrationMoment';",
    'Date Ideas celebration component import',
  );
}

// Add celebration hook import.
if (!source.includes("import { useCelebrationMoment } from '@/hooks/useCelebrationMoment';")) {
  source = replaceOnce(
    source,
    "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';",
    "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { useCelebrationMoment } from '@/hooks/useCelebrationMoment';",
    'Date Ideas celebration hook import',
  );
}

// Add hook state.
if (!source.includes('const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();')) {
  source = replaceOnce(
    source,
    `  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string }>(); const { profile, partnerProfile, colorForUser } = useWorkspace();`,
    `  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string }>(); const { profile, partnerProfile, colorForUser } = useWorkspace();
  const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();`,
    'Date Ideas celebration hook state',
  );
}

// Replace the old alert with the actual celebration moment.
const oldAlert = `        Alert.alert(
          'It’s a match ❤️',
          \`You and \${partnerName} both want to do “\${activity.title}”.\`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Plan it', onPress: () => router.push(planActivityHref(activity) as never) },
          ],
        );`;

const newCelebration = `        celebrate({
          title: 'It’s a match ❤️',
          body: \`You and \${partnerName} both want to do “\${activity.title}”.\`,
          icon: 'heart',
          actionLabel: 'Plan it',
          onAction: () => router.push(planActivityHref(activity) as never),
        });`;

source = replaceOnce(
  source,
  oldAlert,
  newCelebration,
  'Date Idea mutual-match celebration',
);

// Insert the CelebrationMoment before the compact direct AppScreen close.
// activities.tsx ends with: ... <ConfirmDialog ... />\n  </AppScreen>;\n}
if (!source.includes('<CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />')) {
  const closeMarker = '\n  </AppScreen>;\n}';
  const closeIndex = source.lastIndexOf(closeMarker);
  if (closeIndex < 0) {
    fail('Could not locate the compact Date Ideas AppScreen close.');
  }
  source =
    source.slice(0, closeIndex) +
    '\n    <CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />' +
    source.slice(closeIndex);
  console.log('Added Date Ideas celebration renderer.');
} else {
  console.log('Already good: Date Ideas celebration renderer');
}

write(rel, source);

// Full D9 audit: make sure the earlier partial changes and this repair are all present.
const audits = [
  ['src/hooks/useCelebrationMoment.ts', [
    'NotificationFeedbackType.Success',
    'export function useCelebrationMoment',
  ]],
  ['src/components/common/CelebrationMoment.tsx', [
    'Easing.back(1.35)',
    'moment.actionLabel ? 3600 : 1900',
    'A little win for the two of you.',
  ]],
  ['src/app/features/tasks.tsx', [
    "celebrate({ title: 'Done ✓'",
    '<CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />',
  ]],
  ['src/app/features/goals.tsx', [
    "title: 'Goal reached ✦'",
    "title: 'Goal complete ✦'",
    '<CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />',
  ]],
  ['src/app/features/daily-question.tsx', [
    "title: 'A little more of us ♥'",
    '<CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />',
  ]],
  ['src/app/features/activities.tsx', [
    "import { CelebrationMoment } from '@/components/common/CelebrationMoment';",
    "import { useCelebrationMoment } from '@/hooks/useCelebrationMoment';",
    'const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();',
    "title: 'It’s a match ❤️'",
    "actionLabel: 'Plan it'",
    '<CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />',
  ]],
];

for (const [auditRel, markers] of audits) {
  const auditSource = read(auditRel);
  for (const marker of markers) {
    if (!auditSource.includes(marker)) {
      fail(`Post-repair audit missing "${marker}" in ${auditRel}`);
    }
  }
}

console.log('D9 Shared Celebrations repair audit clean.');

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
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD9 Shared Celebrations repair applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
