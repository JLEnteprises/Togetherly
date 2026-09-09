const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'E1 — Shared/Ours Visual Identity Repair';
const MARKER = 'E1_SHARED_OURS_VISUAL_IDENTITY';
const root = process.cwd();

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function fail(message) {
  console.error(`\n[E1] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
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
    "  const ownerPalette = participantColor && participantColor !== 'both' ? participantPalette(participantColor) : null;\n\n  return (",
    "  const ownerPalette = participantColor && participantColor !== 'both' ? participantPalette(participantColor) : null;\n  const sharedOwner = participantColor === 'both';\n  // E1_SHARED_OURS_VISUAL_IDENTITY: shared surfaces visibly carry both participant identities.\n\n  return (",
    'Card shared-owner state',
  );

  next = replaceOnce(
    next,
    "        participantColor === 'both' ? {\n          borderLeftWidth: 4,\n          borderLeftColor: theme.participants.me.accent,\n          borderRightWidth: 4,\n          borderRightColor: theme.participants.partner.accent,\n        } : null,",
    "        sharedOwner ? {\n          borderLeftWidth: 4,\n          borderLeftColor: theme.participants.me.accent,\n          borderRightWidth: 4,\n          borderRightColor: theme.participants.partner.accent,\n        } : null,",
    'Card paired borders',
  );

  next = replaceOnce(
    next,
    "    >\n      {children}\n    </View>",
    "    >\n      {sharedOwner ? (\n        <View\n          pointerEvents=\"none\"\n          style={[styles.sharedWash, { borderRadius: Math.max(0, theme.radii.lg - 1) }]}\n        >\n          <View style={{ flex: 1, backgroundColor: theme.participants.me.accentSoft }} />\n          <View style={{ flex: 1, backgroundColor: theme.participants.partner.accentSoft }} />\n          <View style={styles.sharedRail}>\n            <View style={{ flex: 1, backgroundColor: theme.participants.me.accent }} />\n            <View style={{ flex: 1, backgroundColor: theme.participants.partner.accent }} />\n          </View>\n        </View>\n      ) : null}\n      {children}\n    </View>",
    'Card shared wash',
  );

  next = replaceOnce(
    next,
    "const styles = StyleSheet.create({\n  card: { borderWidth: 1 },\n});",
    "const styles = StyleSheet.create({\n  card: { borderWidth: 1 },\n  sharedWash: {\n    position: 'absolute',\n    top: 1,\n    right: 1,\n    bottom: 1,\n    left: 1,\n    flexDirection: 'row',\n    overflow: 'hidden',\n  },\n  sharedRail: {\n    position: 'absolute',\n    top: 0,\n    left: 14,\n    right: 14,\n    height: 2,\n    borderRadius: 1,\n    flexDirection: 'row',\n    overflow: 'hidden',\n  },\n});",
    'Card shared styles',
  );

  return next;
}

function patchIdentityBadge(source) {
  if (source.includes(MARKER)) return source;

  let next = replaceOnce(
    source,
    "  const { profile, partnerProfile, myColor, partnerColor, colorForUser } = useWorkspace();\n  const size = compact ? 22 : 28;\n\n  if (both) {",
    "  const { profile, partnerProfile, myColor, partnerColor, colorForUser } = useWorkspace();\n  const size = compact ? 22 : 28;\n  const myPalette = participantPalette(myColor);\n  const partnerPaletteValue = participantPalette(partnerColor);\n  // E1_SHARED_OURS_VISUAL_IDENTITY: 'ours' uses both identities, never a third arbitrary colour.\n\n  if (both) {",
    'ParticipantIdentityBadge shared palettes',
  );

  next = replaceOnce(
    next,
    "          borderLeftColor: participantPalette(myColor).accent,\n          borderRightColor: participantPalette(partnerColor).accent,\n          borderColor: theme.colors.border,\n          backgroundColor: theme.colors.elevatedBackground,",
    "          borderLeftColor: myPalette.accent,\n          borderRightColor: partnerPaletteValue.accent,\n          borderColor: theme.colors.border,\n          backgroundColor: theme.colors.elevatedBackground,\n          position: 'relative',",
    'ParticipantIdentityBadge paired borders',
  );

  next = replaceOnce(
    next,
    "      >\n        <View style={{ width: size + 10, height: size, flexDirection: 'row', alignItems: 'center' }}>",
    "      >\n        <View\n          pointerEvents=\"none\"\n          style={{\n            position: 'absolute',\n            top: 1,\n            right: 1,\n            bottom: 1,\n            left: 1,\n            borderRadius: theme.radii.pill,\n            overflow: 'hidden',\n            flexDirection: 'row',\n          }}\n        >\n          <View style={{ flex: 1, backgroundColor: myPalette.accentSoft }} />\n          <View style={{ flex: 1, backgroundColor: partnerPaletteValue.accentSoft }} />\n        </View>\n        <View style={{ width: size + 10, height: size, flexDirection: 'row', alignItems: 'center' }}>",
    'ParticipantIdentityBadge shared wash',
  );

  next = replaceOnce(
    next,
    "          <AppText variant=\"caption\" style={{ color: theme.colors.textPrimary }}>US · {meName} + {partnerName}</AppText>",
    "          <AppText variant=\"caption\" style={{ color: theme.colors.textPrimary }}>OURS · {meName} + {partnerName}</AppText>",
    'ParticipantIdentityBadge ours label',
  );

  return next;
}

function audit() {
  const card = read('src/components/common/Card.tsx');
  const badge = read('src/components/common/ParticipantIdentityBadge.tsx');
  const failures = [];
  if (!card.includes(MARKER)) failures.push('Card E1 marker missing');
  if (!badge.includes(MARKER)) failures.push('ParticipantIdentityBadge E1 marker missing');
  if (!card.includes('theme.participants.me.accentSoft') || !card.includes('theme.participants.partner.accentSoft')) failures.push('Card paired shared wash missing');
  if (!card.includes('styles.sharedRail')) failures.push('Card shared rail missing');
  if (!badge.includes('OURS · {meName} + {partnerName}')) failures.push('OURS badge label missing');
  if (!badge.includes('myPalette.accentSoft') || !badge.includes('partnerPaletteValue.accentSoft')) failures.push('Badge paired shared wash missing');
  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[E1] ${label}`);
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
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[E1] Project root: ${root}`);

const packageJson = path.join(root, 'package.json');
const serverPackageJson = path.join(root, 'server', 'package.json');
if (!fs.existsSync(packageJson) || !fs.existsSync(serverPackageJson)) {
  fail('Run this installer from the Togetherly project root.');
}

const cardPath = 'src/components/common/Card.tsx';
const badgePath = 'src/components/common/ParticipantIdentityBadge.tsx';

let nextCard;
let nextBadge;
let cardEol;
let badgeEol;
try {
  const cardInput = sourceWithEol(cardPath);
  const badgeInput = sourceWithEol(badgePath);
  cardEol = cardInput.eol;
  badgeEol = badgeInput.eol;
  nextCard = patchCard(cardInput.source);
  nextBadge = patchIdentityBadge(badgeInput.source);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

fs.writeFileSync(path.join(root, cardPath), restoreEol(nextCard, cardEol), 'utf8');
fs.writeFileSync(path.join(root, badgePath), restoreEol(nextBadge, badgeEol), 'utf8');

console.log('[E1] Windows-safe Shared/Ours identity patches applied (or already present).');
audit();
console.log('[E1] Source audit passed.');

runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\n[E1] ALL VALIDATIONS PASSED');
console.log('[E1] Shared/Ours visual identity is clean.');
console.log('[E1] No database migration was required.');
console.log('[E1] Do not run expo lint as part of this release.\n');
