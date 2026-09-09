const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'E3 — Paired Identity in Couple-Owned Spaces';
const MARKER = 'E3_PAIRED_COUPLE_IDENTITY';
const root = process.cwd();

function fail(message) {
  console.error(`\n[E3] ${message}`);
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

const signatureSource = `import { View } from 'react-native';
import { Avatar } from './Avatar';
import { AppText } from './AppText';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// E3_PAIRED_COUPLE_IDENTITY: couple-owned spaces show both people as one paired identity.
export function CoupleIdentitySignature({ detail }: { detail?: string }) {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  const myPalette = participantPalette(myColor);
  const partnerPaletteValue = participantPalette(partnerColor);
  const meName = profile?.display_name ?? 'You';
  const partnerName = partnerProfile?.display_name ?? 'Partner';
  const meInitial = meName.trim().slice(0, 1).toUpperCase() || '?';
  const partnerInitial = partnerName.trim().slice(0, 1).toUpperCase() || '♡';

  return (
    <View
      accessibilityLabel={['Ours', meName, partnerName, detail].filter(Boolean).join('. ')}
      style={{
        alignSelf: 'stretch',
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderColor: theme.colors.border,
        borderLeftColor: myPalette.accent,
        borderRightColor: partnerPaletteValue.accent,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.elevatedBackground,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          flexDirection: 'row',
        }}
      >
        <View style={{ flex: 1, backgroundColor: myPalette.glowSoft }} />
        <View style={{ flex: 1, backgroundColor: partnerPaletteValue.glowSoft }} />
      </View>

      <View style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, flexDirection: 'row', overflow: 'hidden', borderRadius: 1 }}>
        <View style={{ flex: 1, backgroundColor: myPalette.accent }} />
        <View style={{ flex: 1, backgroundColor: partnerPaletteValue.accent }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar initials={meInitial} imageUrl={profile?.avatar_url} size={34} participantColor={myColor} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="caption" style={{ color: myPalette.accent }}>YOU</AppText>
            <AppText variant="bodySmall" numberOfLines={1}>{meName}</AppText>
          </View>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 5, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }}>
          <AppText variant="caption" style={{ color: theme.colors.textPrimary, letterSpacing: 0.7 }}>OURS</AppText>
        </View>

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
            <AppText variant="caption" style={{ color: partnerPaletteValue.accent }}>PARTNER</AppText>
            <AppText variant="bodySmall" numberOfLines={1} align="right">{partnerName}</AppText>
          </View>
          <Avatar initials={partnerInitial} imageUrl={partnerProfile?.avatar_url} size={34} participantColor={partnerColor} />
        </View>
      </View>

      {detail ? (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
          <AppText variant="caption" tone="muted" align="center">{detail}</AppText>
        </View>
      ) : null}
    </View>
  );
}
`;

function patchUs(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { RecentMemoryCard } from '@/components/dashboard/RecentMemoryCard';\n",
    "import { RecentMemoryCard } from '@/components/dashboard/RecentMemoryCard';\nimport { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';\n",
    'Us import',
  );
  next = replaceOnce(
    next,
    "      <View style={{ gap: theme.spacing.xl }}>\n",
    "      <View style={{ gap: theme.spacing.xl }}>\n        {/* E3_PAIRED_COUPLE_IDENTITY */}\n        <CoupleIdentitySignature detail=\"Your shared story belongs to both of you.\" />\n",
    'Us paired signature',
  );
  return next;
}

function patchTogether(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';\n",
    "import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';\nimport { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';\n",
    'Together import',
  );
  next = replaceOnce(
    next,
    "      <View style={{ gap: theme.spacing.lg }}>\n        <PartnerPresencePill scope=\"together\" />\n",
    "      <View style={{ gap: theme.spacing.lg }}>\n        {/* E3_PAIRED_COUPLE_IDENTITY */}\n        <CoupleIdentitySignature detail=\"A space for the two of you to be present together.\" />\n        <PartnerPresencePill scope=\"together\" />\n",
    'Together paired signature',
  );
  return next;
}

function patchCoupleProfile(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { ConfirmDialog } from '@/components/common/ConfirmDialog';\n",
    "import { ConfirmDialog } from '@/components/common/ConfirmDialog';\nimport { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';\n",
    'Couple profile import',
  );
  next = replaceOnce(
    next,
    "    <Card participantColor=\"both\" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>\n",
    "    <Card participantColor=\"both\" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>\n      {/* E3_PAIRED_COUPLE_IDENTITY */}\n      <CoupleIdentitySignature detail=\"Two accounts · one shared relationship space.\" />\n",
    'Couple profile paired signature',
  );
  return next;
}

function audit() {
  const signature = read('src/components/common/CoupleIdentitySignature.tsx');
  const us = read('src/app/(tabs)/us.tsx');
  const together = read('src/app/(tabs)/together.tsx');
  const coupleProfile = read('src/app/features/couple-profile.tsx');
  const card = read('src/components/common/Card.tsx');
  const failures = [];

  if (!signature.includes(MARKER)) failures.push('CoupleIdentitySignature E3 marker missing');
  if (!signature.includes('myPalette.glowSoft') || !signature.includes('partnerPaletteValue.glowSoft')) failures.push('Paired two-colour wash missing');
  if (!signature.includes('myPalette.accent') || !signature.includes('partnerPaletteValue.accent')) failures.push('Paired identity accents missing');
  if (!signature.includes('>OURS<')) failures.push('OURS centre label missing');
  if (!signature.includes('participantColor={myColor}') || !signature.includes('participantColor={partnerColor}')) failures.push('Both participant avatars are not colour-bound');

  if (!us.includes(MARKER) || !us.includes('<CoupleIdentitySignature')) failures.push('Us space signature missing');
  if (!together.includes(MARKER) || !together.includes('<CoupleIdentitySignature')) failures.push('Together space signature missing');
  if (!coupleProfile.includes(MARKER) || !coupleProfile.includes('<CoupleIdentitySignature')) failures.push('Couple profile signature missing');

  // Preserve the earlier visual identity layers.
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 shared/Ours styling marker missing');
  if (!card.includes('E2_PERSONAL_COLOUR_IDENTITY')) failures.push('E2 personal colour styling marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[E3] ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[E3] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

const targets = [
  { path: 'src/app/(tabs)/us.tsx', patch: patchUs },
  { path: 'src/app/(tabs)/together.tsx', patch: patchTogether },
  { path: 'src/app/features/couple-profile.tsx', patch: patchCoupleProfile },
];

const prepared = [];
try {
  for (const target of targets) {
    const input = sourceWithEol(target.path);
    prepared.push({ path: target.path, eol: input.eol, source: target.patch(input.source) });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Only write after every target patch has been computed successfully.
for (const item of prepared) {
  fs.writeFileSync(path.join(root, item.path), restoreEol(item.source, item.eol), 'utf8');
}

const componentPath = path.join(root, 'src', 'components', 'common', 'CoupleIdentitySignature.tsx');
const componentEol = process.platform === 'win32' ? '\r\n' : '\n';
fs.writeFileSync(componentPath, restoreEol(signatureSource, componentEol), 'utf8');

console.log('[E3] Paired couple identity applied (or already present).');
audit();
console.log('[E3] Source audit passed.');

runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\n[E3] ALL VALIDATIONS PASSED');
console.log('[E3] Couple-owned spaces now visibly carry both participant identities.');
console.log('[E3] No third shared colour was introduced.');
console.log('[E3] E1 shared/Ours and E2 personal colour layers are preserved.');
console.log('[E3] No database migration was required.');
console.log('[E3] Do not run expo lint as part of this release.\n');
