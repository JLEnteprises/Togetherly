const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const smokePath = path.join(root, 'server', 'src', 'smoke.ts');
const RC_MARKER = 'RC_RELEASE_CANDIDATE_AUDIT';
const REPAIR_MARKER = 'RC_PARTICIPANT_COLOR_SMOKE_REPAIR';

function fail(message) {
  console.error(`\n[RC repair] ${message}`);
  process.exit(1);
}

function run(command, label) {
  console.log(`\n[RC repair] ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes remain in place for targeted follow-up.`);
}

if (!fs.existsSync(smokePath)) fail('Missing server/src/smoke.ts.');

const raw = fs.readFileSync(smokePath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let source = raw.replace(/\r\n/g, '\n');

if (!source.includes(RC_MARKER)) {
  fail('RC standalone Photos smoke coverage marker is missing. Run the RC installer before this repair.');
}

if (source.includes(REPAIR_MARKER)) {
  console.log('[RC repair] Participant-colour smoke assertions are already repaired.');
} else {
  const constantsAnchor = `type Json = Record<string, any>;\n`;
  const constantsReplacement = `type Json = Record<string, any>;\n\n// ${REPAIR_MARKER}: workspace legacy colour names are normalized to canonical #RRGGBB values.\nconst LEGACY_PURPLE = '#BE9AFF';\nconst LEGACY_GREEN = '#B7CB7C';\n`;

  const initialBefore = `    assert(aSnapshot.myColor === 'green' && bSnapshot.myColor === 'purple', 'Creator colour choice or opposite partner colour was not preserved.');`;
  const initialAfter = `    assert(aSnapshot.myColor === LEGACY_GREEN && bSnapshot.myColor === LEGACY_PURPLE, 'Creator colour choice or opposite partner colour was not preserved.');`;

  const swapBefore = `    assert(swappedA.myColor === 'purple' && swappedB.myColor === 'green', 'Participant colours did not swap consistently.');`;
  const swapAfter = `    assert(swappedA.myColor === LEGACY_PURPLE && swappedB.myColor === LEGACY_GREEN, 'Participant colours did not swap consistently.');`;

  const preferredBefore = `    assert(swappedA.profile.preferred_participant_color === 'purple' && swappedB.profile.preferred_participant_color === 'green', 'Preferred colours did not stay in sync after swap.');`;
  const preferredAfter = `    assert(swappedA.profile.preferred_participant_color === LEGACY_PURPLE && swappedB.profile.preferred_participant_color === LEGACY_GREEN, 'Preferred colours did not stay in sync after swap.');`;

  const patches = [
    [constantsAnchor, constantsReplacement, 'smoke colour constants'],
    [initialBefore, initialAfter, 'initial workspace colour assertion'],
    [swapBefore, swapAfter, 'swapped workspace colour assertion'],
    [preferredBefore, preferredAfter, 'swapped preferred-colour assertion'],
  ];

  // Precompute every replacement before the first write.
  let next = source;
  for (const [before, after, label] of patches) {
    const first = next.indexOf(before);
    if (first < 0) fail(`Could not find ${label}. No files were changed.`);
    if (next.indexOf(before, first + before.length) >= 0) fail(`${label} is ambiguous. No files were changed.`);
    next = next.slice(0, first) + after + next.slice(first + before.length);
  }

  source = next;
  fs.writeFileSync(smokePath, eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source, 'utf8');
  console.log('[RC repair] Participant-colour smoke assertions repaired.');
}

const audited = fs.readFileSync(smokePath, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
if (!audited.includes(REPAIR_MARKER)) failures.push('repair marker missing');
if (!audited.includes("const LEGACY_PURPLE = '#BE9AFF';")) failures.push('canonical purple constant missing');
if (!audited.includes("const LEGACY_GREEN = '#B7CB7C';")) failures.push('canonical green constant missing');
if (audited.includes("aSnapshot.myColor === 'green'")) failures.push('old initial green string assertion remains');
if (audited.includes("swappedA.myColor === 'purple'")) failures.push('old swap purple string assertion remains');
if (audited.includes("preferred_participant_color === 'purple'")) failures.push('old preferred-colour string assertion remains');
if (!audited.includes(RC_MARKER)) failures.push('RC Photos smoke marker lost');
if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);

console.log('[RC repair] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  run('node scripts/rc-release-candidate-audit.mjs', 'Static release-candidate audit');
  run('node scripts/i3-ui-regression-audit.mjs', 'I3 UI regression gate');
  run('npm.cmd run typecheck', 'Client typecheck');
  run('npm.cmd --prefix server run typecheck', 'Server typecheck');
  run('npm.cmd --prefix server run logic', 'Deterministic logic suite');
  run('npm.cmd --prefix server run smoke', 'Live PostgreSQL/API/WebSocket smoke suite');
}

console.log('\n[RC repair] ALL VALIDATIONS PASSED');
console.log('[RC repair] Participant identity smoke expectations now match the canonical dynamic #RRGGBB model.');
