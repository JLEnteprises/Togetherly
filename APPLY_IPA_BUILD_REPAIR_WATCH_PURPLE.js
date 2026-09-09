const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nIPA Watch Build Repair FAILED: ${message}`);
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

function write(rel, source) {
  fs.writeFileSync(full(rel), source.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function runNpm(args, label) {
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

const rel = 'targets/TogetherlyWatch/TogetherlyWatchHome.swift';
let source = read(rel);

const broken = '.tint(mood == item.0 ? purple : .gray)';
const fixed = '.tint(mood == item.0 ? identityColor("purple") : .gray)';

if (source.includes(fixed)) {
  console.log('Watch tint fix is already present.');
} else {
  const count = source.split(broken).length - 1;
  if (count !== 1) {
    fail(`Expected exactly one broken Watch tint expression, found ${count}.`);
  }
  source = source.replace(broken, fixed);
  write(rel, source);
}

const finalSource = read(rel);

if (!finalSource.includes('private func identityColor(_ raw: String) -> Color')) {
  fail('Existing identityColor helper is missing; refusing to invent a separate Watch color path.');
}

if (!finalSource.includes(fixed)) {
  fail('Fixed Watch tint expression is missing after patch.');
}

if (finalSource.includes(broken)) {
  fail('Broken bare purple identifier is still present.');
}

console.log('\nWatch source audit clean.');
console.log('Fixed TogetherlyWatchHome.swift build blocker: bare `purple` -> existing identityColor("purple") helper.');

// Existing project checks.
runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nIPA Watch Build Repair applied successfully.');
console.log('No migration and no dependency change.');
console.log('Re-run the IPA GitHub Actions build after committing and pushing this repair.');
