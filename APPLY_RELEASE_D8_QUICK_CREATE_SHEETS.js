const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/components/common/CollapsibleComposer.tsx';
const file = path.join(root, ...rel.split('/'));

function fail(message) {
  console.error(`\nD8 Quick Create Sheets FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}. Run this from the Togetherly project root.`);
}

const current = fs.readFileSync(file, 'utf8');

if (!current.includes('export function CollapsibleComposer')) {
  fail('CollapsibleComposer is not the expected Togetherly component.');
}

const replacement = `import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { AppIcon } from '@/components/art/AppIcon';

type Props = {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actionLabel?: string;
  closeLabel?: string;
  tone?: 'default' | 'accent' | 'secondary';
  style?: ViewStyle;
};

export function CollapsibleComposer({
  title,
  subtitle,
  open,
  onToggle,
  children,
  actionLabel = 'New',
  closeLabel = 'Close',
  tone = 'default',
  style,
}: Props) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();

  function toggle() {
    feedback();
    onToggle();
  }

  return (
    <>
      <Card
        tone="default"
        style={style ? [{ paddingVertical: theme.spacing.sm }, style] : { paddingVertical: theme.spacing.sm }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={\`\${actionLabel}: \${title}\`}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={({ pressed }) => ({
            minHeight: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            opacity: pressed ? 0.74 : 1,
          })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="section">{title}</AppText>
            {subtitle ? <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>{subtitle}</AppText> : null}
          </View>
          <View
            style={{
              minHeight: 38,
              paddingHorizontal: 14,
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppIcon name="plus" size={14} color={theme.colors.accent} />
              <AppText variant="bodySmall" tone="accent">{actionLabel}</AppText>
            </View>
          </View>
        </Pressable>
      </Card>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={toggle}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={toggle}
              style={{ flex: 1 }}
            />

            <View
              style={{
                maxHeight: '92%',
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
                borderWidth: 1,
                borderBottomWidth: 0,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 2,
                  alignSelf: 'center',
                  backgroundColor: theme.colors.border,
                  marginTop: 9,
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  paddingTop: theme.spacing.lg,
                  paddingBottom: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="caption" tone={tone === 'accent' ? 'accent' : 'secondary'}>
                    {open ? 'QUICK EDIT' : 'QUICK CREATE'}
                  </AppText>
                  <AppText variant="pageTitle">{title}</AppText>
                  {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  hitSlop={10}
                  onPress={toggle}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.elevatedBackground,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <AppIcon name="close" size={17} color={theme.colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: theme.spacing.lg,
                  paddingTop: theme.spacing.sm,
                  paddingBottom: theme.spacing.xxl,
                  gap: theme.spacing.lg,
                }}
              >
                {children}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
`;

fs.writeFileSync(file, replacement, 'utf8');
console.log(`Wrote ${rel}`);

const finalSource = fs.readFileSync(file, 'utf8');
const required = [
  "Modal",
  "KeyboardAvoidingView",
  "animationType=\"slide\"",
  "maxHeight: '92%'",
  "keyboardShouldPersistTaps=\"handled\"",
  "{children}",
];
for (const marker of required) {
  if (!finalSource.includes(marker)) fail(`Post-apply audit missing marker: ${marker}`);
}
console.log('D8 Quick Create Sheets audit clean.');

function run(args, label) {
  console.log(`\n> ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}.`);
}

run(['run', 'typecheck'], 'Frontend typecheck');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD8 Quick Create Sheets applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
