const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/components/common/CelebrationMoment.tsx';
const file = path.join(root, ...rel.split('/'));

function fail(message) {
  console.error(`\nD9 Shared Celebrations repair V2 FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!source.includes('export function CelebrationMoment')) {
  fail('D9 CelebrationMoment component is not present.');
}

const oldHandler = `  function runAction() {
    const action = moment.onAction;
    onDismiss();
    action?.();
  }`;

const newHandler = `  function runAction() {
    if (!moment) return;
    const action = moment.onAction;
    onDismiss();
    action?.();
  }`;

if (source.includes(newHandler)) {
  console.log('Safe runAction null guard already present.');
} else if (source.includes(oldHandler)) {
  source = source.replace(oldHandler, newHandler);
  fs.writeFileSync(file, source.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
} else {
  fail('Could not locate the expected runAction handler.');
}

const finalSource = fs.readFileSync(file, 'utf8');
if (!finalSource.includes('if (!moment) return;')) {
  fail('Post-repair audit missing local moment null guard.');
}

// Confirm all D9 integrations from the previous repair remain present.
const audits = [
  ['src/hooks/useCelebrationMoment.ts', 'export function useCelebrationMoment'],
  ['src/components/common/CelebrationMoment.tsx', 'NotificationFeedbackType' /* harmless absence check replaced below */],
  ['src/app/features/tasks.tsx', "celebrate({ title: 'Done ✓'"],
  ['src/app/features/goals.tsx', "title: 'Goal reached ✦'"],
  ['src/app/features/daily-question.tsx', "title: 'A little more of us ♥'"],
  ['src/app/features/activities.tsx', "title: 'It’s a match ❤️'"],
];

for (const [auditRel, marker] of audits) {
  const auditFile = path.join(root, ...auditRel.split('/'));
  if (!fs.existsSync(auditFile)) fail(`Missing ${auditRel}.`);
  const auditSource = fs.readFileSync(auditFile, 'utf8');
  if (auditRel === 'src/components/common/CelebrationMoment.tsx') {
    if (!auditSource.includes('Easing.back(1.35)')) fail('Celebration animation audit failed.');
  } else if (!auditSource.includes(marker)) {
    fail(`D9 audit missing "${marker}" in ${auditRel}.`);
  }
}

console.log('D9 Shared Celebrations repair V2 audit clean.');

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

console.log('\nD9 Shared Celebrations repair V2 applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
