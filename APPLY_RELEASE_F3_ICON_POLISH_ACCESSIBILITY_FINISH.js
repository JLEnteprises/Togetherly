const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'F3 — Icon, Polish & Accessibility Finish';
const MARKER = 'F3_ICON_POLISH_ACCESSIBILITY_FINISH';
const root = process.cwd();

function fail(message) {
  console.error(`\n[F3] ${message}`);
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

function patchIconButton(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "  tone?: 'muted' | 'accent' | 'danger';\n  disabled?: boolean;\n",
    "  tone?: 'muted' | 'accent' | 'danger';\n  disabled?: boolean;\n  accessibilityHint?: string;\n",
    'IconButton accessibility hint prop',
  );
  next = replaceOnce(
    next,
    "export function IconButton({ icon, label, onPress, tone = 'muted', disabled = false }: IconButtonProps) {\n",
    `// ${MARKER}: icon-only actions use a true 44pt target and explicit accessibility metadata.\nexport function IconButton({ icon, label, onPress, tone = 'muted', disabled = false, accessibilityHint }: IconButtonProps) {\n`,
    'IconButton marker and signature',
  );
  next = replaceOnce(
    next,
    "      accessibilityLabel={label}\n      accessibilityState={{ disabled }}\n      disabled={disabled}\n",
    "      accessibilityLabel={label}\n      accessibilityHint={accessibilityHint}\n      accessibilityState={{ disabled }}\n      disabled={disabled}\n      hitSlop={4}\n",
    'IconButton accessibility metadata',
  );
  next = replaceOnce(
    next,
    "        width: 42,\n        height: 42,\n",
    "        width: 44,\n        height: 44,\n",
    'IconButton 44pt target',
  );
  return next;
}

function patchAppButton(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "export function AppButton({ label, onPress, variant = 'primary', compact = false, disabled = false, accessibilityHint, icon }: Props) {\n",
    `// ${MARKER}: visible buttons never announce themselves as actionable when no handler exists.\nexport function AppButton({ label, onPress, variant = 'primary', compact = false, disabled = false, accessibilityHint, icon }: Props) {\n`,
    'AppButton marker',
  );
  next = replaceOnce(
    next,
    "  const feedback = useInteractionFeedback();\n  const backgroundColor = variant === 'primary'\n",
    "  const feedback = useInteractionFeedback();\n  const unavailable = disabled || !onPress;\n  const backgroundColor = variant === 'primary'\n",
    'AppButton effective disabled state',
  );
  next = replaceOnce(
    next,
    "  function press() { if (disabled) return; feedback(); onPress?.(); }\n",
    "  function press() { if (unavailable) return; feedback(); onPress?.(); }\n",
    'AppButton press guard',
  );
  next = replaceOnce(
    next,
    "      accessibilityState={{ disabled }}\n      disabled={disabled}\n",
    "      accessibilityState={{ disabled: unavailable }}\n      disabled={unavailable}\n",
    'AppButton accessible disabled state',
  );
  next = replaceOnce(
    next,
    "        opacity: disabled ? 0.48 : pressed ? 0.82 : 1,\n",
    "        opacity: unavailable ? 0.48 : pressed ? 0.82 : 1,\n",
    'AppButton disabled styling',
  );
  return next;
}

function patchChoiceChips(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "export function ChoiceChips<T extends string>({ value, options, onChange }: { value: T | null; options: readonly Option<T>[]; onChange: (value: T) => void }) {\n",
    `// ${MARKER}: single-choice chips expose radio semantics instead of generic button semantics.\nexport function ChoiceChips<T extends string>({ value, options, onChange }: { value: T | null; options: readonly Option<T>[]; onChange: (value: T) => void }) {\n`,
    'ChoiceChips marker',
  );
  next = replaceOnce(
    next,
    "            accessibilityRole=\"button\"\n            accessibilityLabel={option.label}\n            accessibilityState={{ selected: active }}\n",
    "            accessibilityRole=\"radio\"\n            accessibilityLabel={option.label}\n            accessibilityState={{ selected: active, checked: active }}\n",
    'ChoiceChips radio semantics',
  );
  return next;
}

function patchProgressBar(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "export function ProgressBar({ value }: { value: number }) {\n",
    `// ${MARKER}: visual progress is also announced numerically by screen readers.\nexport function ProgressBar({ value, label = 'Progress' }: { value: number; label?: string }) {\n`,
    'ProgressBar marker and label prop',
  );
  next = replaceOnce(
    next,
    "    <View style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 99, overflow: 'hidden' }}>\n",
    "    <View accessibilityRole=\"progressbar\" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }} style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 99, overflow: 'hidden' }}>\n",
    'ProgressBar accessibility value',
  );
  return next;
}

function patchTabs(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "export default function TabsLayout() {\n",
    `// ${MARKER}: primary navigation has explicit, stable screen-reader labels.\nexport default function TabsLayout() {\n`,
    'Tabs marker',
  );
  const replacements = [
    ['index', 'Home', 'home', 'Home tab'],
    ['plan', 'Plan', 'plan', 'Plan tab'],
    ['together', 'Together', 'together', 'Together tab'],
    ['us', 'Us', 'us', 'Us tab'],
  ];
  for (const [name, title, icon, label] of replacements) {
    next = replaceOnce(
      next,
      `<Tabs.Screen name="${name}" options={{ title: '${title}', tabBarIcon: ({ color }) => <TabIcon name="${icon}" color={color} /> }} />`,
      `<Tabs.Screen name="${name}" options={{ title: '${title}', tabBarAccessibilityLabel: '${label}', tabBarIcon: ({ color }) => <TabIcon name="${icon}" color={color} /> }} />`,
      `${title} tab accessibility label`,
    );
  }
  next = replaceOnce(
    next,
    "<Tabs.Screen name=\"more\" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name=\"more\" color={color} size={20} /> }} />",
    "<Tabs.Screen name=\"more\" options={{ title: 'More', tabBarAccessibilityLabel: 'More tab', tabBarIcon: ({ color }) => <TabIcon name=\"more\" color={color} size={20} /> }} />",
    'More tab accessibility label',
  );
  return next;
}

function audit() {
  const iconButton = read('src/components/common/IconButton.tsx');
  const appButton = read('src/components/common/AppButton.tsx');
  const chips = read('src/components/common/ChoiceChips.tsx');
  const progress = read('src/components/common/ProgressBar.tsx');
  const tabs = read('src/app/(tabs)/_layout.tsx');
  const failures = [];

  for (const [label, source] of [
    ['IconButton', iconButton],
    ['AppButton', appButton],
    ['ChoiceChips', chips],
    ['ProgressBar', progress],
    ['Tabs', tabs],
  ]) {
    if (!source.includes(MARKER)) failures.push(`${label} F3 marker missing`);
  }

  if (!iconButton.includes('width: 44') || !iconButton.includes('height: 44') || !iconButton.includes('hitSlop={4}')) failures.push('IconButton 44pt target missing');
  if (!iconButton.includes('accessibilityHint={accessibilityHint}')) failures.push('IconButton hint support missing');
  if (!appButton.includes('const unavailable = disabled || !onPress;')) failures.push('AppButton effective disabled state missing');
  if (!appButton.includes('accessibilityState={{ disabled: unavailable }}')) failures.push('AppButton accessible disabled state missing');
  if (!chips.includes('accessibilityRole="radio"') || !chips.includes('checked: active')) failures.push('ChoiceChips radio semantics missing');
  if (!progress.includes('accessibilityRole="progressbar"') || !progress.includes('now: Math.round(clamped)')) failures.push('ProgressBar accessible value missing');
  for (const label of ['Home tab', 'Plan tab', 'Together tab', 'Us tab', 'More tab']) {
    if (!tabs.includes(`tabBarAccessibilityLabel: '${label}'`)) failures.push(`${label} accessibility label missing`);
  }

  // Completed-phase guardrails.
  const card = read('src/components/common/Card.tsx');
  const coupleIdentity = read('src/components/common/CoupleIdentitySignature.tsx');
  const eyebrow = read('src/components/common/EyebrowText.tsx');
  const firstTimeGuide = read('src/components/dashboard/FirstTimeGuideCard.tsx');
  const emptyState = read('src/components/common/EmptyState.tsx');
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 shared identity marker missing');
  if (!card.includes('E2_PERSONAL_COLOUR_IDENTITY')) failures.push('E2 personal identity marker missing');
  if (!coupleIdentity.includes('E3_PAIRED_COUPLE_IDENTITY')) failures.push('E3 paired identity marker missing');
  if (!eyebrow.includes('E4_FINAL_VISUAL_CONSISTENCY')) failures.push('E4 consistency marker missing');
  if (!firstTimeGuide.includes('F1_FIRST_TIME_USER_GUIDANCE')) failures.push('F1 guidance marker missing');
  if (!emptyState.includes('F2_EMPTY_STATE_COACHING')) failures.push('F2 empty-state marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[F3] ${label}`);
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
console.log(`[F3] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

const files = [
  ['src/components/common/IconButton.tsx', patchIconButton],
  ['src/components/common/AppButton.tsx', patchAppButton],
  ['src/components/common/ChoiceChips.tsx', patchChoiceChips],
  ['src/components/common/ProgressBar.tsx', patchProgressBar],
  ['src/app/(tabs)/_layout.tsx', patchTabs],
];

const pending = [];
try {
  // Precompute every patch before writing so an anchor failure never half-applies F3.
  for (const [relativePath, patch] of files) {
    const { source, eol } = sourceWithEol(relativePath);
    pending.push({ relativePath, eol, output: patch(source) });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  fs.writeFileSync(path.join(root, item.relativePath), restoreEol(item.output, item.eol), 'utf8');
  console.log(`[F3] ${item.relativePath}: ${item.output.includes(MARKER) ? 'ready' : 'unchanged'}`);
}

console.log('\n[F3] Source audit');
audit();
console.log('[F3] Source audit passed.');

runNpm(['run', 'typecheck'], 'Client typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');

console.log('\n[F3] ALL VALIDATIONS PASSED');
console.log('[F3] No migration or dependency changes. Do not run expo lint for this release.');
