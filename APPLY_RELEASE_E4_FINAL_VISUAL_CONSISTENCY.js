const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'E4 — Final Visual Consistency';
const MARKER = 'E4_FINAL_VISUAL_CONSISTENCY';
const root = process.cwd();

function fail(message) {
  console.error(`\n[E4] ${message}`);
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

function patchPageHeader(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { AppText } from './AppText';\n",
    "import { AppText } from './AppText';\nimport { EyebrowText } from './EyebrowText';\n",
    'PageHeader eyebrow import',
  );
  next = replaceOnce(
    next,
    "export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {\n",
    `// ${MARKER}: page headers use the same eyebrow treatment and internal title rhythm.\nexport function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {\n`,
    'PageHeader marker',
  );
  next = replaceOnce(
    next,
    "        <View style={{ flex: 1, paddingRight: theme.spacing.md }}>\n          {eyebrow ? <AppText variant=\"caption\" tone=\"accent\" style={{ textTransform: 'uppercase', letterSpacing: 1.1 }}>{eyebrow}</AppText> : null}\n",
    "        <View style={{ flex: 1, paddingRight: theme.spacing.md, gap: 3 }}>\n          {eyebrow ? <EyebrowText>{eyebrow}</EyebrowText> : null}\n",
    'PageHeader eyebrow usage',
  );
  return next;
}

function patchBackHeader(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { AppText } from './AppText';\n",
    "import { AppText } from './AppText';\nimport { EyebrowText } from './EyebrowText';\n",
    'BackHeader eyebrow import',
  );
  next = replaceOnce(
    next,
    "export function BackHeader({ eyebrow, title, subtitle, onBack }: { eyebrow?: string; title: string; subtitle?: string; onBack?: () => void }) {\n",
    `// ${MARKER}: detail headers share the same eyebrow treatment as top-level pages.\nexport function BackHeader({ eyebrow, title, subtitle, onBack }: { eyebrow?: string; title: string; subtitle?: string; onBack?: () => void }) {\n`,
    'BackHeader marker',
  );
  next = replaceOnce(
    next,
    "        {eyebrow ? <AppText variant=\"caption\" tone=\"accent\">{eyebrow.toUpperCase()}</AppText> : null}\n",
    "        {eyebrow ? <EyebrowText>{eyebrow}</EyebrowText> : null}\n",
    'BackHeader eyebrow usage',
  );
  return next;
}

function patchFeatureGroupCard(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { AppText } from '@/components/common/AppText';\n",
    "import { AppText } from '@/components/common/AppText';\nimport { EyebrowText } from '@/components/common/EyebrowText';\n",
    'FeatureGroupCard eyebrow import',
  );
  next = replaceOnce(
    next,
    "export function FeatureGroupCard({ eyebrow, title, subtitle, items, accent = false }: Props) {\n",
    `// ${MARKER}: grouped navigation shares one visual hierarchy and touch rhythm.\nexport function FeatureGroupCard({ eyebrow, title, subtitle, items, accent = false }: Props) {\n`,
    'FeatureGroupCard marker',
  );
  next = replaceOnce(
    next,
    `        {eyebrow ? (\n          <AppText variant="caption" tone={accent ? 'accent' : 'secondary'}>{eyebrow}</AppText>\n        ) : null}\n`,
    `        {eyebrow ? (\n          <EyebrowText tone={accent ? 'accent' : 'secondary'}>{eyebrow}</EyebrowText>\n        ) : null}\n`,
    'FeatureGroupCard eyebrow usage',
  );
  next = replaceOnce(
    next,
    "              minHeight: accent ? 58 : 56,\n",
    "              minHeight: 58,\n",
    'FeatureGroupCard row height',
  );
  next = replaceOnce(
    next,
    "              backgroundColor: pressed && !accent ? theme.colors.elevatedBackground : 'transparent',\n              borderRadius: pressed && !accent ? theme.radii.sm : 0,\n",
    "              backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',\n              borderRadius: pressed ? theme.radii.sm : 0,\n",
    'FeatureGroupCard press treatment',
  );
  next = replaceOnce(
    next,
    "                width: accent ? 36 : 32,\n                height: accent ? 36 : 32,\n                borderRadius: accent ? 12 : 11,\n",
    "                width: 36,\n                height: 36,\n                borderRadius: 12,\n",
    'FeatureGroupCard icon well size',
  );
  next = replaceOnce(
    next,
    "              {isAppIconName(item.icon)\n                ? <AppIcon name={item.icon} size={accent ? 19 : 17} color={accent ? theme.colors.accent : theme.colors.textSecondary} />\n                : <AppText variant=\"cardTitle\" tone={accent ? 'accent' : 'secondary'}>{item.icon}</AppText>}\n",
    "              {isAppIconName(item.icon)\n                ? <AppIcon name={item.icon} size={18} color={theme.colors.accent} />\n                : <AppText variant=\"cardTitle\" tone=\"accent\">{item.icon}</AppText>}\n",
    'FeatureGroupCard icon treatment',
  );
  next = replaceOnce(
    next,
    "              <AppText variant={accent ? 'cardTitle' : 'body'} style={{ fontWeight: '700' }}>{item.title}</AppText>\n",
    "              <AppText variant=\"cardTitle\">{item.title}</AppText>\n",
    'FeatureGroupCard title hierarchy',
  );
  return next;
}

function patchSectionHeader(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { AppText } from './AppText';\n",
    "import { AppText } from './AppText';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { useInteractionFeedback } from '@/hooks/useInteractionFeedback';\n",
    'SectionHeader shared imports',
  );
  next = replaceOnce(
    next,
    "export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {\n  return (\n",
    `// ${MARKER}: section actions use the same touch target and pressed affordance across the app.\nexport function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {\n  const theme = useAppTheme();\n  const feedback = useInteractionFeedback();\n  return (\n`,
    'SectionHeader marker and hooks',
  );
  next = replaceOnce(
    next,
    `        <Pressable accessibilityRole="button" onPress={onAction} disabled={!onAction}>\n          <AppText variant="bodySmall" tone="accent">{action}</AppText>\n        </Pressable>\n`,
    `        <Pressable\n          accessibilityRole="button"\n          accessibilityLabel={action}\n          accessibilityState={{ disabled: !onAction }}\n          disabled={!onAction}\n          hitSlop={4}\n          onPress={() => { if (!onAction) return; feedback(); onAction(); }}\n          style={({ pressed }) => ({\n            minHeight: 44,\n            minWidth: 44,\n            alignItems: 'center',\n            justifyContent: 'center',\n            paddingHorizontal: 10,\n            marginRight: -10,\n            borderRadius: theme.radii.pill,\n            backgroundColor: pressed && onAction ? theme.colors.accentSoft : 'transparent',\n            opacity: onAction ? (pressed ? 0.8 : 1) : 0.45,\n          })}\n        >\n          <AppText variant="bodySmall" tone="accent">{action}</AppText>\n        </Pressable>\n`,
    'SectionHeader action affordance',
  );
  return next;
}

const eyebrowPath = 'src/components/common/EyebrowText.tsx';
const eyebrowSource = `import type { ReactNode } from 'react';\nimport { AppText } from './AppText';\n\ntype Props = {\n  children: ReactNode;\n  tone?: 'accent' | 'secondary' | 'muted';\n};\n\n// ${MARKER}: one eyebrow style keeps page, detail, and grouped-section hierarchy aligned.\nexport function EyebrowText({ children, tone = 'accent' }: Props) {\n  return (\n    <AppText\n      variant="caption"\n      tone={tone}\n      style={{ textTransform: 'uppercase', letterSpacing: 1.1 }}\n    >\n      {children}\n    </AppText>\n  );\n}\n`;

function audit() {
  const page = read('src/components/common/PageHeader.tsx');
  const back = read('src/components/common/BackHeader.tsx');
  const group = read('src/components/navigation/FeatureGroupCard.tsx');
  const section = read('src/components/common/SectionHeader.tsx');
  const eyebrow = read(eyebrowPath);
  const failures = [];

  for (const [label, source] of [['PageHeader', page], ['BackHeader', back], ['FeatureGroupCard', group], ['SectionHeader', section], ['EyebrowText', eyebrow]]) {
    if (!source.includes(MARKER)) failures.push(`${label} E4 marker missing`);
  }
  if (!page.includes('<EyebrowText>{eyebrow}</EyebrowText>')) failures.push('PageHeader shared eyebrow missing');
  if (!back.includes('<EyebrowText>{eyebrow}</EyebrowText>')) failures.push('BackHeader shared eyebrow missing');
  if (!group.includes("<EyebrowText tone={accent ? 'accent' : 'secondary'}>{eyebrow}</EyebrowText>")) failures.push('FeatureGroupCard shared eyebrow missing');
  if (!eyebrow.includes("letterSpacing: 1.1")) failures.push('Eyebrow tracking missing');
  if (!group.includes('minHeight: 58')) failures.push('Feature group row rhythm missing');
  if (!group.includes('width: 36') || !group.includes('height: 36')) failures.push('Feature group icon sizing missing');
  if (!group.includes('size={18} color={theme.colors.accent}')) failures.push('Feature group icon treatment missing');
  if (!section.includes('minHeight: 44') || !section.includes("backgroundColor: pressed && onAction ? theme.colors.accentSoft : 'transparent'")) failures.push('Section action affordance missing');

  // Guardrails from prior visual identity phases.
  const card = read('src/components/common/Card.tsx');
  const coupleIdentity = read('src/components/common/CoupleIdentitySignature.tsx');
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 shared identity marker missing');
  if (!card.includes('E2_PERSONAL_COLOUR_IDENTITY')) failures.push('E2 personal identity marker missing');
  if (!coupleIdentity.includes('E3_PAIRED_COUPLE_IDENTITY')) failures.push('E3 paired identity marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[E4] ${label}`);
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
console.log(`[E4] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

const files = [
  ['src/components/common/PageHeader.tsx', patchPageHeader],
  ['src/components/common/BackHeader.tsx', patchBackHeader],
  ['src/components/navigation/FeatureGroupCard.tsx', patchFeatureGroupCard],
  ['src/components/common/SectionHeader.tsx', patchSectionHeader],
];

const pending = [];
try {
  for (const [relativePath, patcher] of files) {
    const input = sourceWithEol(relativePath);
    pending.push({ relativePath, eol: input.eol, source: patcher(input.source) });
  }

  const eyebrowFull = path.join(root, eyebrowPath);
  if (fs.existsSync(eyebrowFull)) {
    const existing = fs.readFileSync(eyebrowFull, 'utf8').replace(/\r\n/g, '\n');
    if (!existing.includes(MARKER)) throw new Error(`${eyebrowPath} already exists but is not the E4 shared eyebrow primitive.`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  fs.writeFileSync(path.join(root, item.relativePath), restoreEol(item.source, item.eol), 'utf8');
}
if (!fs.existsSync(path.join(root, eyebrowPath))) {
  fs.writeFileSync(path.join(root, eyebrowPath), eyebrowSource.replace(/\n/g, process.platform === 'win32' ? '\r\n' : '\n'), 'utf8');
}

console.log('[E4] Visual consistency patches applied (or already present).');
audit();
console.log('[E4] Source audit passed.');

runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\n[E4] ALL VALIDATIONS PASSED');
console.log('[E4] Shared headers, grouped navigation, and section actions now follow one visual rhythm.');
console.log('[E4] E1–E3 relationship identity styling remains intact.');
console.log('[E4] No database migration was required.');
console.log('[E4] Do not run expo lint as part of this release.\n');
