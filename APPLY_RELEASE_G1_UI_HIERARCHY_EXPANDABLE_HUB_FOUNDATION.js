const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'G1 — UI Hierarchy / Expandable Hub Foundation';
const MARKER = 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION';
const root = process.cwd();

const expandableFeatureGroupSource = "import { useState, type ReactNode } from 'react';\nimport { Pressable, View } from 'react-native';\nimport { router } from 'expo-router';\nimport type { ParticipantColor } from '@/types/database';\nimport { AppIcon, isAppIconName } from '@/components/art/AppIcon';\nimport { AppText } from '@/components/common/AppText';\nimport { Card } from '@/components/common/Card';\nimport { EyebrowText } from '@/components/common/EyebrowText';\nimport { useInteractionFeedback } from '@/hooks/useInteractionFeedback';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\nexport type ExpandableFeatureGroupItem = {\n  key?: string;\n  icon?: string;\n  title: string;\n  subtitle?: string;\n  status?: string;\n  href?: string;\n  onPress?: () => void;\n  accessibilityLabel?: string;\n};\n\ntype Props = {\n  eyebrow?: string;\n  icon?: string;\n  title: string;\n  summary: string;\n  status?: string;\n  items?: readonly ExpandableFeatureGroupItem[];\n  children?: ReactNode;\n  expanded?: boolean;\n  defaultExpanded?: boolean;\n  onExpandedChange?: (expanded: boolean) => void;\n  accent?: boolean;\n  participantColor?: ParticipantColor | 'both';\n  accessibilityLabel?: string;\n  accessibilityHint?: string;\n};\n\n// G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION: compact summaries reveal navigation/actions progressively without duplicating feature homes.\nexport function ExpandableFeatureGroup({\n  eyebrow,\n  icon,\n  title,\n  summary,\n  status,\n  items = [],\n  children,\n  expanded,\n  defaultExpanded = false,\n  onExpandedChange,\n  accent = false,\n  participantColor,\n  accessibilityLabel,\n  accessibilityHint,\n}: Props) {\n  const theme = useAppTheme();\n  const feedback = useInteractionFeedback();\n  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);\n  const open = expanded ?? localExpanded;\n\n  function toggle() {\n    const next = !open;\n    feedback();\n    if (expanded === undefined) setLocalExpanded(next);\n    onExpandedChange?.(next);\n  }\n\n  return (\n    <Card\n      tone={accent ? 'accent' : 'default'}\n      participantColor={participantColor}\n      style={{ padding: 0, overflow: 'hidden' }}\n    >\n      <Pressable\n        accessibilityRole=\"button\"\n        accessibilityState={{ expanded: open }}\n        accessibilityLabel={accessibilityLabel ?? `${title}. ${summary}${status ? `. ${status}` : ''}`}\n        accessibilityHint={accessibilityHint ?? (open ? 'Collapse this section' : 'Expand this section')}\n        onPress={toggle}\n        style={({ pressed }) => ({\n          minHeight: 76,\n          flexDirection: 'row',\n          alignItems: 'center',\n          gap: theme.spacing.md,\n          paddingHorizontal: theme.spacing.lg,\n          paddingVertical: theme.spacing.md,\n          backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',\n          opacity: pressed ? 0.82 : 1,\n        })}\n      >\n        {icon ? (\n          <View\n            style={{\n              width: 40,\n              height: 40,\n              borderRadius: 13,\n              alignItems: 'center',\n              justifyContent: 'center',\n              backgroundColor: accent ? theme.colors.elevatedBackground : theme.colors.accentSoft,\n            }}\n          >\n            {isAppIconName(icon)\n              ? <AppIcon name={icon} size={19} color={theme.colors.accent} />\n              : <AppText variant=\"cardTitle\" tone=\"accent\">{icon}</AppText>}\n          </View>\n        ) : null}\n\n        <View style={{ flex: 1, gap: 3 }}>\n          {eyebrow ? <EyebrowText tone={accent ? 'accent' : 'secondary'}>{eyebrow}</EyebrowText> : null}\n          <AppText variant=\"section\">{title}</AppText>\n          <AppText variant=\"bodySmall\" tone=\"secondary\">{summary}</AppText>\n        </View>\n\n        {status ? (\n          <View\n            style={{\n              maxWidth: 120,\n              paddingHorizontal: 9,\n              paddingVertical: 5,\n              borderRadius: 999,\n              backgroundColor: theme.colors.elevatedBackground,\n            }}\n          >\n            <AppText variant=\"caption\" tone=\"secondary\" numberOfLines={1}>{status}</AppText>\n          </View>\n        ) : null}\n\n        <AppIcon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={theme.colors.textMuted} />\n      </Pressable>\n\n      {open ? (\n        <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>\n          {children ? (\n            <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>\n              {children}\n            </View>\n          ) : null}\n\n          {items.length ? (\n            <View style={{ paddingHorizontal: theme.spacing.sm }}>\n              {items.map((item, index) => {\n                const activate = item.onPress ?? (item.href ? () => router.push(item.href as never) : undefined);\n                const rowKey = item.key ?? item.href ?? item.title;\n                return (\n                  <Pressable\n                    key={rowKey}\n                    accessibilityRole=\"button\"\n                    accessibilityLabel={item.accessibilityLabel ?? [item.title, item.subtitle, item.status].filter(Boolean).join('. ')}\n                    accessibilityState={{ disabled: !activate }}\n                    disabled={!activate}\n                    onPress={() => {\n                      if (!activate) return;\n                      feedback();\n                      activate();\n                    }}\n                    style={({ pressed }) => ({\n                      minHeight: 58,\n                      flexDirection: 'row',\n                      alignItems: 'center',\n                      gap: theme.spacing.md,\n                      paddingHorizontal: theme.spacing.sm,\n                      paddingVertical: 10,\n                      borderTopWidth: index === 0 && !children ? 0 : 1,\n                      borderTopColor: theme.colors.border,\n                      backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',\n                      borderRadius: pressed ? theme.radii.sm : 0,\n                      opacity: !activate ? 0.52 : pressed ? 0.76 : 1,\n                    })}\n                  >\n                    {item.icon ? (\n                      <View\n                        style={{\n                          width: 36,\n                          height: 36,\n                          borderRadius: 12,\n                          alignItems: 'center',\n                          justifyContent: 'center',\n                          backgroundColor: theme.colors.accentSoft,\n                        }}\n                      >\n                        {isAppIconName(item.icon)\n                          ? <AppIcon name={item.icon} size={18} color={theme.colors.accent} />\n                          : <AppText variant=\"cardTitle\" tone=\"accent\">{item.icon}</AppText>}\n                      </View>\n                    ) : null}\n\n                    <View style={{ flex: 1, gap: 2 }}>\n                      <AppText variant=\"cardTitle\">{item.title}</AppText>\n                      {item.subtitle ? <AppText variant=\"caption\" tone=\"muted\">{item.subtitle}</AppText> : null}\n                    </View>\n\n                    {item.status ? (\n                      <AppText variant=\"caption\" tone=\"secondary\" numberOfLines={1}>{item.status}</AppText>\n                    ) : null}\n\n                    {activate ? <AppIcon name=\"chevron\" size={16} color={theme.colors.textMuted} /> : null}\n                  </Pressable>\n                );\n              })}\n            </View>\n          ) : null}\n        </View>\n      ) : null}\n    </Card>\n  );\n}\n";
const exclusiveExpandedGroupSource = "import { useCallback, useState } from 'react';\n\n// G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION: crowded hubs can keep at most one major feature group open at once.\nexport function useExclusiveExpandedGroup<Key extends string>(initialExpanded: Key | null = null) {\n  const [expandedGroup, setExpandedGroup] = useState<Key | null>(initialExpanded);\n\n  const isExpanded = useCallback(\n    (key: Key) => expandedGroup === key,\n    [expandedGroup],\n  );\n\n  const setExpanded = useCallback((key: Key, expanded: boolean) => {\n    setExpandedGroup((current) => {\n      if (expanded) return key;\n      return current === key ? null : current;\n    });\n  }, []);\n\n  const toggle = useCallback((key: Key) => {\n    setExpandedGroup((current) => current === key ? null : key);\n  }, []);\n\n  const collapseAll = useCallback(() => {\n    setExpandedGroup(null);\n  }, []);\n\n  return {\n    expandedGroup,\n    isExpanded,\n    setExpanded,\n    toggle,\n    collapseAll,\n  };\n}\n";

function fail(message) {
  console.error(`\n[G1] ${message}`);
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

function guardCompletedPhases() {
  const guards = [
    ['src/components/common/Card.tsx', 'E1_SHARED_OURS_VISUAL_IDENTITY'],
    ['src/components/common/Card.tsx', 'E2_PERSONAL_COLOUR_IDENTITY'],
    ['src/components/common/CoupleIdentitySignature.tsx', 'E3_PAIRED_COUPLE_IDENTITY'],
    ['src/components/common/EyebrowText.tsx', 'E4_FINAL_VISUAL_CONSISTENCY'],
    ['src/components/dashboard/FirstTimeGuideCard.tsx', 'F1_FIRST_TIME_USER_GUIDANCE'],
    ['src/components/common/EmptyState.tsx', 'F2_EMPTY_STATE_COACHING'],
    ['src/components/common/IconButton.tsx', 'F3_ICON_POLISH_ACCESSIBILITY_FINISH'],
    ['src/components/navigation/FeatureGroupCard.tsx', 'E4_FINAL_VISUAL_CONSISTENCY'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }
  if (failures.length) fail(`Completed-phase guard failed before any G1 write:\n- ${failures.join('\n- ')}`);
}

function prepareCreate(relativePath, source, preferredEol) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { relativePath, output: source, eol: preferredEol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const existing = raw.replace(/\r\n/g, '\n');
  if (!existing.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the G1 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: existing, eol, write: false };
}

function audit() {
  const group = read('src/components/navigation/ExpandableFeatureGroup.tsx').replace(/\r\n/g, '\n');
  const exclusive = read('src/hooks/useExclusiveExpandedGroup.ts').replace(/\r\n/g, '\n');
  const failures = [];

  if (!group.includes(MARKER)) failures.push('ExpandableFeatureGroup G1 marker missing');
  if (!group.includes('accessibilityState={{ expanded: open }}')) failures.push('ExpandableFeatureGroup expanded accessibility state missing');
  if (!group.includes('participantColor={participantColor}')) failures.push('ExpandableFeatureGroup participant identity passthrough missing');
  if (!group.includes("name={open ? 'chevronUp' : 'chevronDown'}")) failures.push('ExpandableFeatureGroup disclosure icon missing');
  if (!group.includes('children?: ReactNode;')) failures.push('ExpandableFeatureGroup custom child-content support missing');
  if (!group.includes('status?: string;')) failures.push('ExpandableFeatureGroup status support missing');

  if (!exclusive.includes(MARKER)) failures.push('Exclusive expanded-group G1 marker missing');
  if (!exclusive.includes('const [expandedGroup, setExpandedGroup]')) failures.push('Exclusive expanded-group state missing');
  if (!exclusive.includes('if (expanded) return key;')) failures.push('Exclusive one-open-at-a-time behavior missing');

  // Re-check completed phase markers after G1 writes.
  const card = read('src/components/common/Card.tsx');
  const coupleIdentity = read('src/components/common/CoupleIdentitySignature.tsx');
  const eyebrow = read('src/components/common/EyebrowText.tsx');
  const firstTimeGuide = read('src/components/dashboard/FirstTimeGuideCard.tsx');
  const emptyState = read('src/components/common/EmptyState.tsx');
  const iconButton = read('src/components/common/IconButton.tsx');
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 shared identity marker missing');
  if (!card.includes('E2_PERSONAL_COLOUR_IDENTITY')) failures.push('E2 personal identity marker missing');
  if (!coupleIdentity.includes('E3_PAIRED_COUPLE_IDENTITY')) failures.push('E3 paired identity marker missing');
  if (!eyebrow.includes('E4_FINAL_VISUAL_CONSISTENCY')) failures.push('E4 consistency marker missing');
  if (!firstTimeGuide.includes('F1_FIRST_TIME_USER_GUIDANCE')) failures.push('F1 guidance marker missing');
  if (!emptyState.includes('F2_EMPTY_STATE_COACHING')) failures.push('F2 empty-state marker missing');
  if (!iconButton.includes('F3_ICON_POLISH_ACCESSIBILITY_FINISH')) failures.push('F3 accessibility marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[G1] ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. G1 source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[G1] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

const { eol: navigationEol } = sourceWithEol('src/components/navigation/FeatureGroupCard.tsx');
const { eol: hookEol } = sourceWithEol('src/hooks/useInteractionFeedback.ts');

let pending;
try {
  // Precompute every G1 output before any source write. If either destination conflicts, nothing is changed.
  pending = [
    prepareCreate('src/components/navigation/ExpandableFeatureGroup.tsx', expandableFeatureGroupSource, navigationEol),
    prepareCreate('src/hooks/useExclusiveExpandedGroup.ts', exclusiveExpandedGroupSource, hookEol),
  ];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  if (!item.write) {
    console.log(`[G1] ${item.relativePath}: already ready`);
    continue;
  }
  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[G1] ${item.relativePath}: created`);
}

console.log('\n[G1] Source audit');
audit();
console.log('[G1] Source audit passed.');

runNpm(['run', 'typecheck'], 'Client typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');

console.log('\n[G1] ALL VALIDATIONS PASSED');
console.log('[G1] No migration or dependency changes. Do not run expo lint for this release.');
