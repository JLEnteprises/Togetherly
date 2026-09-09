const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/app/features/activities.tsx';
const file = path.join(root, ...rel.split('/'));

function fail(message) {
  console.error(`\nD6 Date Matches repair FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!source.includes("type Filter = 'all' | 'matches'")) {
  fail('D6 Date Matches does not appear to be applied yet.');
}

if (!source.includes('const topMatch = mutualMatches[0] ?? null;')) {
  const marker = "  }, [activities, profile, partnerProfile]);\n";
  const idx = source.indexOf(marker, source.indexOf('const mutualMatches = useMemo'));
  if (idx < 0) fail('Could not locate the mutualMatches memo block.');
  const insertAt = idx + marker.length;
  source = source.slice(0, insertAt) + "  const topMatch = mutualMatches[0] ?? null;\n" + source.slice(insertAt);
  console.log('Added safe topMatch derivation.');
} else {
  console.log('Safe topMatch derivation already present.');
}

source = source.replace(
  '{mutualMatches.length ? <Card tone="accent"',
  '{topMatch ? <Card tone="accent"'
);

source = source.replace(
  '<AppText variant="hero">{mutualMatches[0].title}</AppText>',
  '<AppText variant="hero">{topMatch.title}</AppText>'
);

source = source.replace(
  'planActivityHref(mutualMatches[0])',
  'planActivityHref(topMatch)'
);

source = source.replace(
  'setViewTarget(mutualMatches[0])',
  'setViewTarget(topMatch)'
);

fs.writeFileSync(file, source.replace(/\n/g, '\r\n'), 'utf8');
console.log(`Wrote ${rel}`);

const finalSource = fs.readFileSync(file, 'utf8');
const required = [
  'const topMatch = mutualMatches[0] ?? null;',
  '{topMatch ? <Card tone="accent"',
  '<AppText variant="hero">{topMatch.title}</AppText>',
  'planActivityHref(topMatch)',
  'setViewTarget(topMatch)',
];
for (const marker of required) {
  if (!finalSource.includes(marker)) fail(`Post-repair audit missing marker: ${marker}`);
}
if (finalSource.includes('mutualMatches[0].title') ||
    finalSource.includes('planActivityHref(mutualMatches[0])') ||
    finalSource.includes('setViewTarget(mutualMatches[0])')) {
  fail('Unsafe mutualMatches[0] reference remains.');
}

console.log('D6 Date Matches repair audit clean.');

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

console.log('\nD6 Date Matches repair applied successfully.');
console.log('All requested validation checks passed.');
