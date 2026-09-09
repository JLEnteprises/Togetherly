const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const auditPath = path.join(root, 'scripts', 'i3-ui-regression-audit.mjs');
const I3_MARKER = 'I3_UI_REGRESSION_CROSS_TAB_CONSISTENCY';
const REPAIR_MARKER = 'I3_LOVE_TAP_AUDIT_REPAIR';

function fail(message) {
  console.error(`\n[I3 repair] ${message}`);
  process.exit(1);
}

function run(command, label) {
  console.log(`\n[I3 repair] ${label}`);
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

if (!fs.existsSync(auditPath)) fail('Missing scripts/i3-ui-regression-audit.mjs. Run the I3 installer first.');

const raw = fs.readFileSync(auditPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let source = raw.replace(/\r\n/g, '\n');

if (!source.includes(I3_MARKER)) fail('The existing audit is not the expected I3 audit; refusing to modify it.');

if (source.includes(REPAIR_MARKER)) {
  console.log('[I3 repair] Audit rule already repaired.');
} else {
  const before = `  ['Love Tap remains a small direct signal', (s) => s.includes('label="Love Tap"')],`;
  const after = `  // ${REPAIR_MARKER}: Love Tap uses a dynamic sent/sending/default label, so audit the actual dynamic branch rather than a static JSX label.
  ['Love Tap remains a small direct signal', (s) => s.includes("label={recentSignal === 'love'") && s.includes("'Love Tap'")],`;

  const first = source.indexOf(before);
  if (first < 0) fail('Could not find the original Love Tap audit rule. No files were changed.');
  if (source.indexOf(before, first + before.length) >= 0) fail('Love Tap audit rule is ambiguous. No files were changed.');

  source = source.slice(0, first) + after + source.slice(first + before.length);
  fs.writeFileSync(auditPath, eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source, 'utf8');
  console.log('[I3 repair] Love Tap audit rule repaired.');
}

run('node scripts/i3-ui-regression-audit.mjs', 'UI regression / cross-tab consistency audit');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  run('npm.cmd run typecheck', 'Client typecheck');
  run('npm.cmd --prefix server run typecheck', 'Server typecheck');
  run('npm.cmd --prefix server run logic', 'Server logic');
}

console.log('\n[I3 repair] ALL VALIDATIONS PASSED');
