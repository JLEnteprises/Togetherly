const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'G6 — Composer Sheets';
const MARKER = 'G6_COMPOSER_SHEETS';
const root = process.cwd();

const composerSheetSource = "import type { ReactNode } from 'react';\nimport { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { useInteractionFeedback } from '@/hooks/useInteractionFeedback';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { AppText } from './AppText';\nimport { Card } from './Card';\n\nexport type ComposerSheetProps = {\n  title: string;\n  subtitle?: string;\n  open: boolean;\n  onToggle: () => void;\n  children: ReactNode;\n  actionLabel?: string;\n  closeLabel?: string;\n  tone?: 'default' | 'accent' | 'secondary';\n  style?: ViewStyle;\n  showLauncher?: boolean;\n};\n\n// G6_COMPOSER_SHEETS: explicit shared create/edit sheet keeps the page stable while forms live in a keyboard-safe modal surface.\nexport function ComposerSheet({\n  title,\n  subtitle,\n  open,\n  onToggle,\n  children,\n  actionLabel = 'New',\n  closeLabel = 'Close',\n  tone = 'default',\n  style,\n  showLauncher = true,\n}: ComposerSheetProps) {\n  const theme = useAppTheme();\n  const feedback = useInteractionFeedback();\n  const isEditing = /^edit\\b/i.test(title.trim());\n\n  function toggle() {\n    feedback();\n    onToggle();\n  }\n\n  return (\n    <>\n      {showLauncher ? (\n        <Card\n          tone=\"default\"\n          style={style ? [{ paddingVertical: theme.spacing.sm }, style] : { paddingVertical: theme.spacing.sm }}\n        >\n          <Pressable\n            accessibilityRole=\"button\"\n            accessibilityLabel={`${actionLabel}: ${title}`}\n            accessibilityState={{ expanded: open }}\n            onPress={toggle}\n            style={({ pressed }) => ({\n              minHeight: 46,\n              flexDirection: 'row',\n              alignItems: 'center',\n              justifyContent: 'space-between',\n              gap: theme.spacing.md,\n              opacity: pressed ? 0.74 : 1,\n            })}\n          >\n            <View style={{ flex: 1, gap: 2 }}>\n              <AppText variant=\"section\">{title}</AppText>\n              {subtitle ? <AppText variant=\"bodySmall\" tone=\"secondary\" numberOfLines={1}>{subtitle}</AppText> : null}\n            </View>\n\n            <View\n              style={{\n                minHeight: 38,\n                paddingHorizontal: 14,\n                borderRadius: theme.radii.pill,\n                borderWidth: 1,\n                borderColor: theme.colors.accent,\n                backgroundColor: theme.colors.accentSoft,\n                alignItems: 'center',\n                justifyContent: 'center',\n              }}\n            >\n              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>\n                <AppIcon name=\"plus\" size={14} color={theme.colors.accent} />\n                <AppText variant=\"bodySmall\" tone=\"accent\">{actionLabel}</AppText>\n              </View>\n            </View>\n          </Pressable>\n        </Card>\n      ) : null}\n\n      <Modal\n        visible={open}\n        transparent\n        animationType={theme.reducedMotion ? 'none' : 'slide'}\n        onRequestClose={toggle}\n        statusBarTranslucent\n      >\n        <KeyboardAvoidingView\n          style={{ flex: 1 }}\n          behavior={Platform.OS === 'ios' ? 'padding' : undefined}\n        >\n          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>\n            <Pressable\n              accessibilityRole=\"button\"\n              accessibilityLabel={closeLabel}\n              onPress={toggle}\n              style={{ flex: 1 }}\n            />\n\n            <View\n              style={{\n                maxHeight: '92%',\n                borderTopLeftRadius: theme.radii.xl,\n                borderTopRightRadius: theme.radii.xl,\n                borderWidth: 1,\n                borderBottomWidth: 0,\n                borderColor: theme.colors.border,\n                backgroundColor: theme.colors.background,\n                overflow: 'hidden',\n              }}\n            >\n              <View\n                style={{\n                  width: 42,\n                  height: 4,\n                  borderRadius: 2,\n                  alignSelf: 'center',\n                  backgroundColor: theme.colors.border,\n                  marginTop: 9,\n                }}\n              />\n\n              <View\n                style={{\n                  flexDirection: 'row',\n                  alignItems: 'flex-start',\n                  gap: theme.spacing.md,\n                  paddingHorizontal: theme.spacing.lg,\n                  paddingTop: theme.spacing.lg,\n                  paddingBottom: theme.spacing.sm,\n                }}\n              >\n                <View style={{ flex: 1, gap: 4 }}>\n                  <AppText variant=\"caption\" tone={tone === 'accent' ? 'accent' : 'secondary'}>\n                    {isEditing ? 'QUICK EDIT' : 'QUICK ADD'}\n                  </AppText>\n                  <AppText variant=\"pageTitle\">{title}</AppText>\n                  {subtitle ? <AppText variant=\"bodySmall\" tone=\"secondary\">{subtitle}</AppText> : null}\n                </View>\n\n                <Pressable\n                  accessibilityRole=\"button\"\n                  accessibilityLabel={closeLabel}\n                  hitSlop={10}\n                  onPress={toggle}\n                  style={({ pressed }) => ({\n                    width: 40,\n                    height: 40,\n                    borderRadius: 20,\n                    alignItems: 'center',\n                    justifyContent: 'center',\n                    backgroundColor: theme.colors.elevatedBackground,\n                    opacity: pressed ? 0.7 : 1,\n                  })}\n                >\n                  <AppIcon name=\"close\" size={17} color={theme.colors.textSecondary} />\n                </Pressable>\n              </View>\n\n              <ScrollView\n                keyboardShouldPersistTaps=\"handled\"\n                keyboardDismissMode=\"interactive\"\n                showsVerticalScrollIndicator={false}\n                contentContainerStyle={{\n                  paddingHorizontal: theme.spacing.lg,\n                  paddingTop: theme.spacing.sm,\n                  paddingBottom: theme.spacing.xxl,\n                  gap: theme.spacing.lg,\n                }}\n              >\n                {children}\n              </ScrollView>\n            </View>\n          </View>\n        </KeyboardAvoidingView>\n      </Modal>\n    </>\n  );\n}\n";
const legacyWrapperSource = "import type { ComponentProps } from 'react';\nimport { ComposerSheet } from './ComposerSheet';\n\nexport type CollapsibleComposerProps = ComponentProps<typeof ComposerSheet>;\n\n// G6_COMPOSER_SHEETS: compatibility wrapper for older call sites; all composer behavior now lives in ComposerSheet.\nexport function CollapsibleComposer(props: CollapsibleComposerProps) {\n  return <ComposerSheet {...props} />;\n}\n";
const migrateFiles = ["src/app/features/tasks.tsx", "src/app/features/calendar.tsx", "src/app/features/notes.tsx", "src/app/features/lists.tsx", "src/app/features/goals.tsx", "src/app/features/trips.tsx", "src/app/features/countdowns.tsx", "src/app/features/memories.tsx", "src/app/features/activities.tsx", "src/app/features/photos.tsx"];

function fail(message) {
  console.error(`\n[G6] ${message}`);
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

function guardCompletedPhases() {
  const guards = [
    ['src/components/common/Card.tsx', 'E1_SHARED_OURS_VISUAL_IDENTITY'],
    ['src/components/common/Card.tsx', 'E2_PERSONAL_COLOUR_IDENTITY'],
    ['src/components/common/CoupleIdentitySignature.tsx', 'E3_PAIRED_COUPLE_IDENTITY'],
    ['src/components/common/EyebrowText.tsx', 'E4_FINAL_VISUAL_CONSISTENCY'],
    ['src/components/dashboard/FirstTimeGuideCard.tsx', 'F1_FIRST_TIME_USER_GUIDANCE'],
    ['src/components/common/EmptyState.tsx', 'F2_EMPTY_STATE_COACHING'],
    ['src/components/common/IconButton.tsx', 'F3_ICON_POLISH_ACCESSIBILITY_FINISH'],
    ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/hooks/useExclusiveExpandedGroup.ts', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/HomeQuickActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/HomeTodayCard.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/LongDistanceOverviewCard.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/features/home-layout.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/components/together/TogetherHubGroups.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/app/(tabs)/plan.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
    ['src/components/plan/PlanHubGroups.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
    ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/us/UsStoryDashboard.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/app/features/memories.tsx', 'G5_US_STORY_CONSOLIDATION'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any G6 write:\n- ${failures.join('\n- ')}`);
}

function prepareComposerSheet(preferredEol) {
  const relativePath = 'src/components/common/ComposerSheet.tsx';
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { relativePath, output: composerSheetSource, eol: preferredEol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the G6 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function prepareLegacyWrapper() {
  const { source, eol } = sourceWithEol('src/components/common/CollapsibleComposer.tsx');
  if (source.includes(MARKER)) {
    return { relativePath: 'src/components/common/CollapsibleComposer.tsx', output: source, eol, write: false };
  }

  const required = ['KeyboardAvoidingView', 'Modal', 'ScrollView', 'actionLabel', 'onToggle'];
  for (const token of required) {
    if (!source.includes(token)) {
      throw new Error(`CollapsibleComposer baseline changed; missing ${token}. Refusing broad overwrite.`);
    }
  }

  return { relativePath: 'src/components/common/CollapsibleComposer.tsx', output: legacyWrapperSource, eol, write: true };
}

function migrateComposerFile(relativePath) {
  const { source, eol } = sourceWithEol(relativePath);
  if (source.includes(MARKER)) return { relativePath, output: source, eol, write: false };

  const importLine = "import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';\n";
  if (!source.includes(importLine) || !source.includes('<CollapsibleComposer') || !source.includes('</CollapsibleComposer>')) {
    throw new Error(`${relativePath} no longer matches the expected composer baseline.`);
  }

  let next = replaceOnce(
    source,
    importLine,
    "import { ComposerSheet } from '@/components/common/ComposerSheet';\n",
    `${relativePath} composer import`,
  );
  next = next.replace(/<CollapsibleComposer/g, '<ComposerSheet').replace(/<\/CollapsibleComposer>/g, '</ComposerSheet>');

  const exportNeedle = /export default function ([A-Za-z0-9_]+)\(\) \{\n/;
  const match = next.match(exportNeedle);
  if (!match) throw new Error(`${relativePath} export function anchor changed.`);
  next = next.replace(exportNeedle, `// ${MARKER}: major create/edit flow uses the explicit shared ComposerSheet primitive.\nexport default function ${match[1]}() {\n`);

  return { relativePath, output: next, eol, write: true };
}

function patchPhotosAlbumEdit(item) {
  if (!item.write) return item;

  let next = item.output;

  next = replaceOnce(
    next,
    '<View style={{ flexDirection: \'row\', gap: 8, flexWrap: \'wrap\' }}><AppButton compact variant="ghost" label={albumEditOpen ? \'Done\' : \'Edit\'} onPress={() => setAlbumEditOpen((value) => !value)} /><AppButton compact variant="secondary" label={pickerOpen ? \'Done adding\' : \'Add\'} onPress={() => setPickerOpen((value) => !value)} /></View>',
    '<View style={{ flexDirection: \'row\', gap: 8, flexWrap: \'wrap\' }}><AppButton compact variant="ghost" label="Edit" onPress={() => { setEditTitle(selected.title); setEditDescription(selected.description ?? \'\'); setAlbumEditOpen(true); }} /><AppButton compact variant="secondary" label={pickerOpen ? \'Done adding\' : \'Add\'} onPress={() => setPickerOpen((value) => !value)} /></View>',
    'Photos album edit launcher',
  );

  next = replaceOnce(
    next,
    '{albumEditOpen ? <View style={{ gap: theme.spacing.md }}><FormField label="ALBUM NAME" value={editTitle} onChangeText={setEditTitle} /><FormField label="DESCRIPTION · OPTIONAL" value={editDescription} onChangeText={setEditDescription} multiline /><AppButton compact label="Save changes" disabled={!editTitle.trim()} onPress={saveAlbumDetails} /></View> : null}',
    '',
    'Photos inline album editor',
  );

  next = replaceOnce(
    next,
    '{pickerOpen ? (',
    `<ComposerSheet
          title="Edit album"
          subtitle="Change the album name or description without moving the page underneath you."
          open={albumEditOpen}
          closeLabel="Cancel edit"
          showLauncher={false}
          onToggle={() => setAlbumEditOpen(false)}
        >
          <FormField label="ALBUM NAME" value={editTitle} onChangeText={setEditTitle} />
          <FormField label="DESCRIPTION · OPTIONAL" value={editDescription} onChangeText={setEditDescription} multiline />
          <AppButton label="Save changes" disabled={!editTitle.trim()} onPress={saveAlbumDetails} />
        </ComposerSheet>

        {pickerOpen ? (`,
    'Photos album edit sheet insertion',
  );

  return { ...item, output: next };
}

function audit() {
  const sheet = read('src/components/common/ComposerSheet.tsx').replace(/\r\n/g, '\n');
  const wrapper = read('src/components/common/CollapsibleComposer.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!sheet.includes(MARKER)) failures.push('ComposerSheet G6 marker missing');
  if (!sheet.includes('showLauncher?: boolean')) failures.push('ComposerSheet headless/edit mode missing');
  if (!sheet.includes('<Modal') || !sheet.includes('<KeyboardAvoidingView') || !sheet.includes('<ScrollView')) {
    failures.push('ComposerSheet lost modal/keyboard/scroll behavior');
  }

  if (!wrapper.includes(MARKER) || !wrapper.includes("import { ComposerSheet } from './ComposerSheet';")) {
    failures.push('CollapsibleComposer compatibility wrapper missing');
  }
  if (wrapper.includes('<Modal') || wrapper.includes('KeyboardAvoidingView')) {
    failures.push('Legacy CollapsibleComposer still owns duplicate sheet implementation');
  }

  for (const relativePath of migrateFiles) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(MARKER)) failures.push(`${relativePath} G6 marker missing`);
    if (!source.includes("import { ComposerSheet } from '@/components/common/ComposerSheet';")) failures.push(`${relativePath} ComposerSheet import missing`);
    if (source.includes('CollapsibleComposer')) failures.push(`${relativePath} still references CollapsibleComposer`);
    if (!source.includes('<ComposerSheet')) failures.push(`${relativePath} ComposerSheet usage missing`);
  }

  const photos = read('src/app/features/photos.tsx').replace(/\r\n/g, '\n');
  if (photos.includes("label={albumEditOpen ? 'Done' : 'Edit'}")) failures.push('Photos still toggles inline album edit');
  if (photos.includes('{albumEditOpen ? <View')) failures.push('Photos inline album editor still present');
  if (!photos.includes('title="Edit album"') || !photos.includes('showLauncher={false}')) failures.push('Photos album edit sheet missing');

  if (!read('src/app/(tabs)/us.tsx').includes('G5_US_STORY_CONSOLIDATION')) failures.push('G5 Us marker missing');
  if (!read('src/components/plan/PlanHubGroups.tsx').includes('G4_PLAN_EXPANDABLE_GROUPS')) failures.push('G4 Plan marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[G6] ${label}`);
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
console.log(`[G6] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const legacy = prepareLegacyWrapper();
  const sheet = prepareComposerSheet(legacy.eol);
  const migrated = migrateFiles.map((relativePath) => migrateComposerFile(relativePath));
  const photosIndex = migrated.findIndex((item) => item.relativePath === 'src/app/features/photos.tsx');
  migrated[photosIndex] = patchPhotosAlbumEdit(migrated[photosIndex]);
  pending = [sheet, legacy, ...migrated];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Every output is prepared before any source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[G6] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[G6] ${item.relativePath}: ready`);
}

console.log('\n[G6] Source audit');
audit();
console.log('[G6] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[G6] ALL VALIDATIONS PASSED');
console.log('[G6] No migration or dependency changes. Do not run expo lint for this release.');
