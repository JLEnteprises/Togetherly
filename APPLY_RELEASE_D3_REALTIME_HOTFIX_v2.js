const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const realtimePath = path.join(root, 'src', 'services', 'backend', 'realtime.ts');

function fail(message) {
  console.error(`\nD3 realtime hotfix FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(realtimePath)) {
  fail(`Could not find ${path.relative(root, realtimePath)}. Run this script from the Togetherly project root.`);
}

let source = fs.readFileSync(realtimePath, 'utf8');

if (!source.includes('export type RealtimeResource')) {
  fail('RealtimeResource type was not found in src/services/backend/realtime.ts.');
}

if (!source.includes("'decision_wheel'")) {
  const before = source;

  source = source.replace(
    "'location' | 'relationship_pings';",
    "'location' | 'relationship_pings' | 'decision_wheel';"
  );

  if (source === before) {
    source = source.replace(
      /(export type RealtimeResource\s*=\s*[\s\S]*?)(;)/,
      (match, union, semicolon) => `${union} | 'decision_wheel'${semicolon}`
    );
  }

  if (source === before || !source.includes("'decision_wheel'")) {
    fail('Could not safely add decision_wheel to RealtimeResource. No files were changed.');
  }

  fs.writeFileSync(realtimePath, source, 'utf8');
  console.log('Patched src/services/backend/realtime.ts');
} else {
  console.log('src/services/backend/realtime.ts already includes decision_wheel; no source change needed.');
}

const decisionToolsPath = path.join(root, 'src', 'app', 'features', 'decision-tools.tsx');
if (fs.existsSync(decisionToolsPath)) {
  const decisionTools = fs.readFileSync(decisionToolsPath, 'utf8');
  if (decisionTools.includes("useRealtimeRefresh('decision_wheel'")) {
    console.log('Confirmed D3 Decision Wheel realtime refresh call.');
  } else {
    console.warn('NOTE: decision-tools.tsx does not contain the D3 decision_wheel realtime refresh call.');
  }
}

function run(args, label) {
  console.log(`\n> ${label}`);

  let result;
  if (process.platform === 'win32') {
    // .cmd files must be launched through cmd.exe on Windows.
    // Calling npm.cmd directly via spawnSync can throw EINVAL on some Node/Windows setups.
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
  } else {
    result = spawnSync('npm', args, {
      cwd: root,
      stdio: 'inherit',
    });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}.`);
}

run(['run', 'typecheck'], 'Frontend typecheck');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD3 shared Decision Wheel realtime hotfix applied successfully.');
console.log('All requested validation checks passed.');
