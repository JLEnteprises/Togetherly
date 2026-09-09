const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const sessionPath = path.join(root, 'server', 'src', 'auth', 'session.ts');
const smokePath = path.join(root, 'server', 'src', 'smoke.ts');

const RC_MARKER = 'RC_RELEASE_CANDIDATE_AUDIT';
const SMOKE_REPAIR_MARKER = 'RC_PARTICIPANT_COLOR_SMOKE_REPAIR';
const REPAIR_MARKER = 'RC_PUBLIC_PARTICIPANT_COLOR_CONTRACT_REPAIR';

function fail(message) {
  console.error(`\n[RC contract repair] ${message}`);
  process.exit(1);
}

function run(command, label) {
  console.log(`\n[RC contract repair] ${label}`);
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

if (!fs.existsSync(sessionPath)) fail('Missing server/src/auth/session.ts.');
if (!fs.existsSync(smokePath)) fail('Missing server/src/smoke.ts.');

const smoke = fs.readFileSync(smokePath, 'utf8').replace(/\r\n/g, '\n');
if (!smoke.includes(RC_MARKER)) fail('RC smoke coverage marker is missing. Run the RC installer first.');
if (!smoke.includes(SMOKE_REPAIR_MARKER)) fail('Participant-colour smoke repair marker is missing. Run the previous RC colour smoke repair first.');

const raw = fs.readFileSync(sessionPath, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let source = raw.replace(/\r\n/g, '\n');

if (source.includes(REPAIR_MARKER)) {
  console.log('[RC contract repair] Public participant-colour contract is already repaired.');
} else {
  const typeBefore = `  preferred_participant_color: 'purple' | 'green' | null;`;
  const typeAfter = `  preferred_participant_color: string | null;`;

  const functionAnchor = `export function toPublicUser(row: Record<string, unknown>): PublicUser {\n`;
  const functionReplacement = `const LEGACY_PURPLE = '#BE9AFF';
const LEGACY_GREEN = '#B7CB7C';
const PARTICIPANT_COLOR_RE = /^#[0-9A-F]{6}$/;

// ${REPAIR_MARKER}: public profiles expose the same canonical dynamic #RRGGBB identity colour model as workspace membership.
function publicParticipantColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'PURPLE') return LEGACY_PURPLE;
  if (normalized === 'GREEN') return LEGACY_GREEN;
  return PARTICIPANT_COLOR_RE.test(normalized) ? normalized : null;
}

export function toPublicUser(row: Record<string, unknown>): PublicUser {
`;

  const mappingBefore = `    preferred_participant_color: row.preferred_participant_color === 'green' ? 'green' : row.preferred_participant_color === 'purple' ? 'purple' : null,`;
  const mappingAfter = `    preferred_participant_color: publicParticipantColor(row.preferred_participant_color),`;

  const patches = [
    [typeBefore, typeAfter, 'PublicUser preferred colour type'],
    [functionAnchor, functionReplacement, 'public participant colour normalizer'],
    [mappingBefore, mappingAfter, 'toPublicUser preferred colour mapping'],
  ];

  // Prepare all replacements before the first write.
  let next = source;
  for (const [before, after, label] of patches) {
    const first = next.indexOf(before);
    if (first < 0) fail(`Could not find ${label}. No files were changed.`);
    if (next.indexOf(before, first + before.length) >= 0) fail(`${label} is ambiguous. No files were changed.`);
    next = next.slice(0, first) + after + next.slice(first + before.length);
  }

  source = next;
  fs.writeFileSync(sessionPath, eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source, 'utf8');
  console.log('[RC contract repair] server/src/auth/session.ts repaired.');
}

const audited = fs.readFileSync(sessionPath, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
if (!audited.includes(REPAIR_MARKER)) failures.push('repair marker missing');
if (!audited.includes('preferred_participant_color: string | null;')) failures.push('PublicUser type is still legacy-narrow');
if (!audited.includes("const LEGACY_PURPLE = '#BE9AFF';")) failures.push('canonical purple mapping missing');
if (!audited.includes("const LEGACY_GREEN = '#B7CB7C';")) failures.push('canonical green mapping missing');
if (!audited.includes('return PARTICIPANT_COLOR_RE.test(normalized) ? normalized : null;')) failures.push('dynamic #RRGGBB pass-through missing');
if (!audited.includes('preferred_participant_color: publicParticipantColor(row.preferred_participant_color),')) failures.push('toPublicUser still does not use canonical colour mapping');
if (audited.includes("preferred_participant_color: 'purple' | 'green' | null;")) failures.push('legacy PublicUser union remains');
if (audited.includes("row.preferred_participant_color === 'green' ? 'green'")) failures.push('legacy profile serialization remains');

if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
console.log('[RC contract repair] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  run('node scripts/rc-release-candidate-audit.mjs', 'Static release-candidate audit');
  run('node scripts/i3-ui-regression-audit.mjs', 'I3 UI regression gate');
  run('npm.cmd run typecheck', 'Client typecheck');
  run('npm.cmd --prefix server run typecheck', 'Server typecheck');
  run('npm.cmd --prefix server run logic', 'Deterministic logic suite');
  run('npm.cmd --prefix server run smoke', 'Live PostgreSQL/API/WebSocket smoke suite');
}

console.log('\n[RC contract repair] ALL VALIDATIONS PASSED');
console.log('[RC contract repair] Public profile participant colours now stay synchronized with dynamic workspace identity colours.');
