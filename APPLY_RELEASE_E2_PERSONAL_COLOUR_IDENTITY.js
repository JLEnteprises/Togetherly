const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'E2 — Personal Colour Identity';
const MARKER = 'E2_PERSONAL_COLOUR_IDENTITY';
const root = process.cwd();

function fail(message) {
  console.error(`\n[E2] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchCard(source) {
  if (source.includes(MARKER)) return source;

  let next = replaceOnce(
    source,
    "  // E1_SHARED_OURS_VISUAL_IDENTITY: shared surfaces visibly carry both participant identities.\n",
    "  // E1_SHARED_OURS_VISUAL_IDENTITY: shared surfaces visibly carry both participant identities.\n  // E2_PERSONAL_COLOUR_IDENTITY: individually owned surfaces carry a clear, restrained participant signature.\n",
    'Card E2 marker',
  );

  next = replaceOnce(
    next,
    "    >\n      {sharedOwner ? (",
    `    >
      {ownerPalette ? (
        <View
          pointerEvents="none"
          style={[
            styles.ownerWash,
            {
              borderRadius: Math.max(0, theme.radii.lg - 1),
              backgroundColor: ownerPalette.tint,
            },
          ]}
        >
          <View style={[styles.ownerRail, { backgroundColor: ownerPalette.accent }]} />
        </View>
      ) : null}
      {sharedOwner ? (`,
    'Card individual owner wash',
  );

  next = replaceOnce(
    next,
    "  sharedWash: {\n",
    `  ownerWash: {
    position: 'absolute',
    top: 1,
    right: 1,
    bottom: 1,
    left: 1,
    overflow: 'hidden',
  },
  ownerRail: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 58,
    height: 2,
    borderRadius: 1,
  },
  sharedWash: {
`,
    'Card individual owner styles',
  );

  return next;
}

function patchAttribution(source) {
  if (source.includes(MARKER)) return source;

  let next = replaceOnce(
    source,
    "  const accent = palette?.accent ?? theme.colors.textMuted;\n",
    "  const accent = palette?.accent ?? theme.colors.textMuted;\n  // E2_PERSONAL_COLOUR_IDENTITY: creator identity gets a compact participant-colour surface when ownership is known.\n",
    'ParticipantAttribution E2 marker',
  );

  next = replaceOnce(
    next,
    "    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>",
    `    <View
      accessibilityLabel={\`${'${verb}'} ${'${name}'}${'${role ? `. ${role}` : \'\'}'}${'${suffix ? `. ${suffix}` : \'\'}'}\`}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        paddingHorizontal: palette ? 7 : 0,
        paddingVertical: palette ? 4 : 0,
        borderRadius: theme.radii.pill,
        borderWidth: palette ? 1 : 0,
        borderColor: palette?.border ?? 'transparent',
        backgroundColor: palette?.accentSoft ?? 'transparent',
      }}
    >`,
    'ParticipantAttribution owner pill',
  );

  next = replaceOnce(
    next,
    "        borderWidth: 1, borderColor: palette?.border ?? theme.colors.border,\n        backgroundColor: palette?.tint ?? theme.colors.elevatedBackground,",
    "        borderWidth: palette ? 1.5 : 1, borderColor: palette?.accent ?? theme.colors.border,\n        backgroundColor: palette?.tint ?? theme.colors.elevatedBackground,",
    'ParticipantAttribution identity dot',
  );

  return next;
}

function audit() {
  const card = read('src/components/common/Card.tsx');
  const attribution = read('src/components/common/ParticipantAttribution.tsx');
  const failures = [];

  if (!card.includes(MARKER)) failures.push('Card E2 marker missing');
  if (!attribution.includes(MARKER)) failures.push('ParticipantAttribution E2 marker missing');

  if (!card.includes('backgroundColor: ownerPalette.tint')) failures.push('Card individual owner tint missing');
  if (!card.includes('styles.ownerRail')) failures.push('Card individual owner rail missing');
  if (!card.includes('backgroundColor: ownerPalette.accent')) failures.push('Card individual owner accent rail missing');

  if (!attribution.includes("backgroundColor: palette?.accentSoft ?? 'transparent'")) failures.push('ParticipantAttribution owner tint missing');
  if (!attribution.includes("borderColor: palette?.border ?? 'transparent'")) failures.push('ParticipantAttribution owner border missing');
  if (!attribution.includes("borderWidth: palette ? 1.5 : 1")) failures.push('ParticipantAttribution identity dot emphasis missing');

  // Guardrails: E1 paired/shared identity must still be present.
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 shared card identity marker missing');
  if (!card.includes('theme.participants.me.accentSoft') || !card.includes('theme.participants.partner.accentSoft')) {
    failures.push('E1 shared paired wash was disturbed');
  }

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[E2] ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
    });
  } else {
    result = spawnSync('npm', args, {
      cwd: root,
      stdio: 'inherit',
    });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
  }
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[E2] Project root: ${root}`);

const packageJson = path.join(root, 'package.json');
const serverPackageJson = path.join(root, 'server', 'package.json');
if (!fs.existsSync(packageJson) || !fs.existsSync(serverPackageJson)) {
  fail('Run this installer from the Togetherly project root.');
}

const cardPath = 'src/components/common/Card.tsx';
const attributionPath = 'src/components/common/ParticipantAttribution.tsx';

let nextCard;
let nextAttribution;
let cardEol;
let attributionEol;

try {
  const cardInput = sourceWithEol(cardPath);
  const attributionInput = sourceWithEol(attributionPath);
  cardEol = cardInput.eol;
  attributionEol = attributionInput.eol;

  // Precompute both files before writing either one, so an anchor failure does
  // not leave a half-applied E2 release.
  nextCard = patchCard(cardInput.source);
  nextAttribution = patchAttribution(attributionInput.source);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

fs.writeFileSync(path.join(root, cardPath), restoreEol(nextCard, cardEol), 'utf8');
fs.writeFileSync(path.join(root, attributionPath), restoreEol(nextAttribution, attributionEol), 'utf8');

console.log('[E2] Personal colour identity patches applied (or already present).');
audit();
console.log('[E2] Source audit passed.');

runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\n[E2] ALL VALIDATIONS PASSED');
console.log('[E2] Personal ownership is now more visually legible across owner-aware screens.');
console.log('[E2] Generic controls remain neutral and E1 shared/Ours styling is preserved.');
console.log('[E2] No database migration was required.');
console.log('[E2] Do not run expo lint as part of this release.\n');
