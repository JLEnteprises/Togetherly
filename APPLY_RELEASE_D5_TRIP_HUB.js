const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const packageRoot = __dirname;

function fail(message) {
  console.error(`\nD5 Trip Hub FAILED: ${message}`);
  process.exit(1);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail(`Missing ${rel}. Run this script from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8');
}

function copyPayload(rel) {
  const source = path.join(packageRoot, 'payload', rel);
  const destination = path.join(root, rel);
  if (!fs.existsSync(source)) fail(`Release payload is missing ${rel}. Re-extract the complete D5 ZIP.`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`Wrote ${rel}`);
}

const home = read('src/components/dashboard/HomeTodayCard.tsx');
if (!home.includes('Right now')) {
  fail('D4 Living Home baseline was not detected. Apply and checkpoint D4 before D5.');
}

const currentTripDetail = read('src/app/features/trip-detail.tsx');
if (!currentTripDetail.includes('Quick setup') || !currentTripDetail.includes('Trip plan')) {
  if (currentTripDetail.includes('Everything for the trip') && currentTripDetail.includes('+ Add to trip')) {
    console.log('D5 Trip Hub already appears to be applied; source will be refreshed from the release payload.');
  } else {
    fail('trip-detail.tsx is not the expected pre-D5 baseline. No files were changed.');
  }
}

copyPayload('src/app/features/trip-detail.tsx');

const applied = read('src/app/features/trip-detail.tsx');
for (const marker of ['Everything for the trip', 'Things to remember', '+ Add to trip', 'TRIP GOAL', 'PACKING']) {
  if (!applied.includes(marker)) fail(`Post-apply verification failed; missing marker: ${marker}`);
}

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

console.log('\nD5 Trip Hub applied successfully.');
console.log('No database migration or new dependency is required.');
console.log('All requested validation checks passed.');
